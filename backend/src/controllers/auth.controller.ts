import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import config from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { getCookie } from '../utils/cookies';
import { auditLogService } from '../services/auditLog.service';
import { sendAdminAlert } from '../services/email.service';
import { recordFailedLogin } from '../services/securityAlert.service';
import { getClientIp } from '../utils/requestHelpers';
import { ActionType, EntityType } from '@prisma/client';

const parseDurationMs = (value: string): number | undefined => {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (multipliers[unit] || 0);
};

const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
  path: '/',
} as const);

const getAuthCookieMaxAge = () => {
  return parseDurationMs(config.jwt.expiry) ?? 7 * 24 * 60 * 60 * 1000;
};

// Password strength requirements for production
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const BCRYPT_ROUNDS = 12;

const validatePassword = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
  }
  return null;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Email, password, first name, and last name are required' });
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password with strong cost factor
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry } as jwt.SignOptions
    );

    res.cookie('auth_token', token, {
      ...getAuthCookieOptions(),
      maxAge: getAuthCookieMaxAge(),
    });

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
      void recordFailedLogin({
        email,
        ipAddress,
        userAgent: userAgent,
      }).catch((error) => {
        console.error('Failed to record failed login:', error);
      });
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      void recordFailedLogin({
        email,
        ipAddress,
        userAgent: userAgent,
      }).catch((error) => {
        console.error('Failed to record failed login:', error);
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.passwordHash) {
      void recordFailedLogin({
        email,
        ipAddress,
        userAgent: userAgent,
      }).catch((error) => {
        console.error('Failed to record failed login:', error);
      });
      res.status(400).json({ error: 'Please use Google login for this account' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      void recordFailedLogin({
        email,
        ipAddress,
        userAgent: userAgent,
      }).catch((error) => {
        console.error('Failed to record failed login:', error);
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry } as jwt.SignOptions
    );

    res.cookie('auth_token', token, {
      ...getAuthCookieOptions(),
      maxAge: getAuthCookieMaxAge(),
    });

    try {
      await auditLogService.logAction({
        userId: user.id,
        actionType: ActionType.LOGIN,
        entityType: EntityType.USER,
        entityId: user.id,
        ipAddress,
        newData: {
          email: user.email,
        },
      });
    } catch (error) {
      console.error('Failed to log login action:', error);
    }

    void sendAdminAlert({
      subject: 'User login',
      text: `${user.firstName} ${user.lastName} (${user.email}) logged in from IP ${ipAddress}.`,
    }).catch((error) => {
      console.error('Failed to send login alert email:', error);
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    // User is attached to req by passport
    const user = req.user as any;

    if (!user) {
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry } as jwt.SignOptions
    );

    res.cookie('auth_token', token, {
      ...getAuthCookieOptions(),
      maxAge: getAuthCookieMaxAge(),
    });

    // Redirect to frontend after setting cookie
    res.redirect(`${config.frontendUrl}/`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionToken = getCookie(req, 'family_session_id');
    if (sessionToken) {
      await prisma.familySession.deleteMany({
        where: { sessionToken },
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  }

  try {
    const ipAddress = getClientIp(req);
    await auditLogService.logAction({
      userId: (req as AuthRequest).user?.id,
      actionType: ActionType.LOGOUT,
      entityType: EntityType.USER,
      entityId: (req as AuthRequest).user?.id || 'unknown',
      ipAddress,
    });
  } catch (error) {
    console.error('Failed to log logout action:', error);
  }

  res.clearCookie('auth_token', getAuthCookieOptions());
  res.clearCookie('family_session_id', getAuthCookieOptions());
  res.json({ message: 'Logged out' });
};

// Admin-only endpoint: Get all users
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

// Admin-only endpoint: Update user role
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const userId = req.params.id as string;
    const { role } = req.body;

    if (!role || !['USER', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'Valid role is required (USER or ADMIN)' });
      return;
    }

    // Prevent self-demotion
    if (userId === req.user.id && role === 'USER') {
      res.status(400).json({ error: 'Cannot demote yourself' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    try {
      await auditLogService.logAction({
        userId: req.user.id,
        actionType: ActionType.UPDATE,
        entityType: EntityType.USER,
        entityId: user.id,
        ipAddress: getClientIp(req),
        oldData: { role: existingUser.role },
        newData: { role: user.role },
      });
    } catch (error) {
      console.error('Failed to log user role change:', error);
    }

    res.json({
      message: 'User role updated successfully',
      user,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};
