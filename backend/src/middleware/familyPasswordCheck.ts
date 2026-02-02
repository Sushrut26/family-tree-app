import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Store family sessions in memory (for production, use Redis)
const familySessions = new Map<string, Date>();

// Session expiry time (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Routes that don't require family password verification
const EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/me',
  '/api/family-config/verify',
  '/api/health',
  '/health',
];

export const familyPasswordCheck = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
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

  // Check if session exists and is not expired
  const sessionCreatedAt = familySessions.get(familySessionId);

  if (!sessionCreatedAt) {
    res.status(403).json({
      error: 'Invalid family session',
      code: 'FAMILY_PASSWORD_REQUIRED',
    });
    return;
  }

  // Check if session is expired
  const now = new Date();
  const sessionAge = now.getTime() - sessionCreatedAt.getTime();

  if (sessionAge > SESSION_EXPIRY_MS) {
    // Session expired, remove it
    familySessions.delete(familySessionId);
    res.status(403).json({
      error: 'Family session expired',
      code: 'FAMILY_PASSWORD_REQUIRED',
    });
    return;
  }

  // Session is valid, proceed
  next();
};

// Helper function to create a new family session
export const createFamilySession = (sessionId: string): void => {
  familySessions.set(sessionId, new Date());
};

// Helper function to cleanup expired sessions (call periodically)
export const cleanupExpiredSessions = (): void => {
  const now = new Date();
  for (const [sessionId, createdAt] of familySessions.entries()) {
    if (now.getTime() - createdAt.getTime() > SESSION_EXPIRY_MS) {
      familySessions.delete(sessionId);
    }
  }
};

// Cleanup expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
