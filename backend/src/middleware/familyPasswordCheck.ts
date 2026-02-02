import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Session expiry time (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Routes that don't require family password verification
const EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/family-config/verify',
  '/api/health',
  '/health',
];

/**
 * Create a fingerprint hash from IP and User-Agent for session hijacking detection
 */
const createFingerprint = (ipAddress: string, userAgent: string): string => {
  return crypto
    .createHash('sha256')
    .update(`${ipAddress}:${userAgent}`)
    .digest('hex');
};

/**
 * Extract IP address from request (handles proxies via X-Forwarded-For)
 */
const getClientIp = (req: AuthRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export const familyPasswordCheck = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Allow preflight requests through
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Check if route is exempt
  if (EXEMPT_ROUTES.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Get family session ID from header
  const familySessionId = req.headers['x-family-session'] as string;

  if (!familySessionId) {
    res.status(403).json({
      error: 'Family password verification required',
      code: 'FAMILY_PASSWORD_REQUIRED',
    });
    return;
  }

  try {
    // Check if session exists in database
    const session = await prisma.familySession.findUnique({
      where: { sessionToken: familySessionId },
    });

    if (!session) {
      res.status(403).json({
        error: 'Invalid family session',
        code: 'FAMILY_PASSWORD_REQUIRED',
      });
      return;
    }

    // Check if session is expired
    const now = new Date();
    if (now > session.expiresAt) {
      // Session expired, remove it from database
      await prisma.familySession.delete({
        where: { id: session.id },
      });

      res.status(403).json({
        error: 'Family session expired',
        code: 'FAMILY_PASSWORD_REQUIRED',
      });
      return;
    }

    // Optional: Session fingerprinting for hijacking detection
    // Only enforce if fingerprint was stored during creation
    if (session.ipAddress && session.userAgent) {
      const currentIp = getClientIp(req);
      const currentUserAgent = req.headers['user-agent'] || '';
      const currentFingerprint = createFingerprint(currentIp, currentUserAgent);
      const sessionFingerprint = createFingerprint(
        session.ipAddress,
        session.userAgent
      );

      if (currentFingerprint !== sessionFingerprint) {
        console.warn(
          `Potential session hijacking detected for session ${session.id}. ` +
          `IP mismatch: ${session.ipAddress} vs ${currentIp}`
        );

        // In production, you might want to invalidate the session here
        // For now, we'll allow it but log the warning
      }
    }

    // Session is valid, proceed
    next();
  } catch (error) {
    console.error('Family password check error:', error);
    res.status(500).json({ error: 'Internal server error during session validation' });
  }
};

/**
 * Helper function to create a new family session with fingerprinting
 */
export const createFamilySession = async (
  sessionId: string,
  req?: AuthRequest
): Promise<void> => {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  if (req) {
    ipAddress = getClientIp(req);
    userAgent = req.headers['user-agent'] || undefined;
  }

  await prisma.familySession.create({
    data: {
      sessionToken: sessionId,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });
};

/**
 * Helper function to cleanup expired sessions (call periodically)
 */
export const cleanupExpiredSessions = async (): Promise<void> => {
  const now = new Date();

  const result = await prisma.familySession.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  if (result.count > 0) {
    console.log(`Cleaned up ${result.count} expired family sessions`);
  }
};

// Cleanup expired sessions every hour
setInterval(() => {
  cleanupExpiredSessions().catch((error) => {
    console.error('Error cleaning up expired sessions:', error);
  });
}, 60 * 60 * 1000);
