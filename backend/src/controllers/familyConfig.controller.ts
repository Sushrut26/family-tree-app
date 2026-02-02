import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import config from '../config/env';
import { createFamilySession, FAMILY_SESSION_EXPIRY_MS } from '../middleware/familyPasswordCheck';
import { auditLogService } from '../services/auditLog.service';
import { getClientIp } from '../utils/requestHelpers';
import { ActionType, EntityType } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

export const verifyFamilyPassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Password required' });
      return;
    }

    // Get family password from database
    const familyConfig = await prisma.familyConfig.findFirst();

    if (!familyConfig) {
      res.status(500).json({ error: 'Family password not configured' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, familyConfig.passwordHash);

    if (!isValid) {
      res.status(401).json({ error: 'Incorrect family password' });
      return;
    }

    const cookieOptions = {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: FAMILY_SESSION_EXPIRY_MS,
    } as const;

    // Generate session ID with fingerprinting
    const sessionId = randomUUID();
    await createFamilySession(sessionId, req);

    console.log(
      `[FamilySession] Setting cookie. origin=${req.headers.origin || 'none'} ` +
      `ua=${req.headers['user-agent'] || 'unknown'} secure=${cookieOptions.secure} ` +
      `sameSite=${cookieOptions.sameSite} maxAgeMs=${cookieOptions.maxAge}`
    );

    res.cookie('family_session_id', sessionId, cookieOptions);
    res.json({
      success: true,
      message: 'Family password verified',
    });
  } catch (error) {
    console.error('Family password verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

export const updateFamilyPassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only admin can update family password
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Both passwords required' });
      return;
    }

    const familyConfig = await prisma.familyConfig.findFirst();

    if (!familyConfig) {
      res.status(500).json({ error: 'Family password not configured' });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, familyConfig.passwordHash);

    if (!isValid) {
      res.status(401).json({ error: 'Incorrect current password' });
      return;
    }

    // Hash and update new password with strong cost factor
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.familyConfig.update({
      where: { id: familyConfig.id },
      data: { passwordHash: newPasswordHash },
    });

    try {
      await auditLogService.logAction({
        userId: req.user.id,
        actionType: ActionType.UPDATE,
        entityType: EntityType.FAMILY_CONFIG,
        entityId: familyConfig.id,
        ipAddress: getClientIp(req),
        newData: { changed: true },
      });
    } catch (error) {
      console.error('Failed to log family password update:', error);
    }

    res.json({ message: 'Family password updated successfully' });
  } catch (error) {
    console.error('Update family password error:', error);
    res.status(500).json({ error: 'Update failed' });
  }
};
