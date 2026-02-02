import prisma from '../config/database';
import { ActionType, EntityType } from '@prisma/client';
import { auditLogService } from './auditLog.service';
import { sendAdminAlert } from './email.service';

const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const SECURITY_ALERT_COOLDOWN_MS = 30 * 60 * 1000;

const shouldSendSecurityAlert = async (ipAddress: string): Promise<boolean> => {
  const since = new Date(Date.now() - SECURITY_ALERT_COOLDOWN_MS);
  const existing = await prisma.auditLog.findFirst({
    where: {
      actionType: ActionType.SECURITY_ALERT,
      ipAddress,
      createdAt: {
        gte: since,
      },
    },
  });

  return !existing;
};

export const recordFailedLogin = async ({
  email,
  ipAddress,
  userAgent,
}: {
  email?: string;
  ipAddress: string;
  userAgent?: string;
}): Promise<void> => {
  await auditLogService.logAction({
    userId: undefined,
    actionType: ActionType.LOGIN_FAILED,
    entityType: EntityType.USER,
    entityId: email || 'unknown',
    ipAddress,
    newData: {
      email: email || 'unknown',
      userAgent,
    },
  });

  const windowStart = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);
  const failureCount = await prisma.auditLog.count({
    where: {
      actionType: ActionType.LOGIN_FAILED,
      ipAddress,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  if (failureCount >= FAILED_LOGIN_THRESHOLD && await shouldSendSecurityAlert(ipAddress)) {
    await auditLogService.logAction({
      userId: undefined,
      actionType: ActionType.SECURITY_ALERT,
      entityType: EntityType.USER,
      entityId: email || 'unknown',
      ipAddress,
      newData: {
        reason: 'Repeated failed logins',
        failureCount,
        windowMinutes: FAILED_LOGIN_WINDOW_MS / 60000,
      },
    });

    try {
      await sendAdminAlert({
        subject: 'Security alert: repeated failed logins',
        text: `Detected ${failureCount} failed login attempts within ${
          FAILED_LOGIN_WINDOW_MS / 60000
        } minutes from IP ${ipAddress}.`,
      });
    } catch (error) {
      console.error('Failed to send security alert email:', error);
    }
  }
};

export const recordFingerprintMismatch = async ({
  ipAddress,
  sessionId,
  expectedIp,
  currentIp,
  userAgent,
}: {
  ipAddress: string;
  sessionId: string;
  expectedIp: string;
  currentIp: string;
  userAgent?: string;
}): Promise<void> => {
  if (!await shouldSendSecurityAlert(ipAddress)) {
    return;
  }

  await auditLogService.logAction({
    userId: undefined,
    actionType: ActionType.SECURITY_ALERT,
    entityType: EntityType.USER,
    entityId: sessionId,
    ipAddress,
    newData: {
      reason: 'Family session fingerprint mismatch',
      expectedIp,
      currentIp,
      userAgent,
    },
  });

  try {
    await sendAdminAlert({
      subject: 'Security alert: family session fingerprint mismatch',
      text: `Family session fingerprint mismatch detected for session ${sessionId}. Expected IP ${expectedIp}, got ${currentIp}.`,
    });
  } catch (error) {
    console.error('Failed to send security alert email:', error);
  }
};
