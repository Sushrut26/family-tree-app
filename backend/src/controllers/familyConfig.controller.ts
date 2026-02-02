import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { createFamilySession } from '../middleware/familyPasswordCheck';

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
    const config = await prisma.familyConfig.findFirst();

    if (!config) {
      res.status(500).json({ error: 'Family password not configured' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, config.passwordHash);

    if (!isValid) {
      res.status(401).json({ error: 'Incorrect family password' });
      return;
    }

    // Generate session ID with fingerprinting
    const sessionId = randomUUID();
    await createFamilySession(sessionId, req);

    res.json({
      success: true,
      sessionId,
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

    const config = await prisma.familyConfig.findFirst();

    if (!config) {
      res.status(500).json({ error: 'Family password not configured' });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, config.passwordHash);

    if (!isValid) {
      res.status(401).json({ error: 'Incorrect current password' });
      return;
    }

    // Hash and update new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.familyConfig.update({
      where: { id: config.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ message: 'Family password updated successfully' });
  } catch (error) {
    console.error('Update family password error:', error);
    res.status(500).json({ error: 'Update failed' });
  }
};
