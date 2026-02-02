import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import crypto from 'crypto';
import prisma from '../config/database';
import { getCookie } from '../utils/cookies';
import { getClientIp } from '../utils/requestHelpers';
import { recordFingerprintMismatch } from '../services/securityAlert.service';

// Session expiry time (24 hours)
export const FAMILY_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Routes that don't require family password verification
const EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/logout',
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

  // Get family session ID from header or cookie
  const familySessionId =
    (req.headers['x-family-session'] as string) ||
    getCookie(req, 'family_session_id');

  if (!familySessionId) {
    const cookieHeader = req.headers.cookie || 'none';
    const headerSession = (req.headers['x-family-session'] as string) || 'none';
    console.warn(
      `[FamilySession] Missing session. path=${req.path} origin=${req.headers.origin || 'none'} ` +
      `cookieHeader=${cookieHeader} x-family-session=${headerSession}`
    );
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
      const tokenPreview = `${familySessionId.slice(0, 6)}...${familySessionId.slice(-4)}`;
      console.warn(`[FamilySession] Invalid session token ${tokenPreview} path=${req.path}`);
      res.status(403).json({
        error: 'Invalid family session',
        code: 'FAMILY_PASSWORD_REQUIRED',
      });
      return;
    }

    // Check if session is expired
    const now = new Date();
    if (now > session.expiresAt) {
      console.warn(`[FamilySession] Expired session id=${session.id} path=${req.path}`);
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

        void recordFingerprintMismatch({
          ipAddress: currentIp,
          sessionId: session.id,
          expectedIp: session.ipAddress,
          currentIp,
          userAgent: currentUserAgent,
        }).catch((error) => {
          console.error('Failed to record fingerprint mismatch:', error);
        });
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
  const expiresAt = new Date(Date.now() + FAMILY_SESSION_EXPIRY_MS);

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
