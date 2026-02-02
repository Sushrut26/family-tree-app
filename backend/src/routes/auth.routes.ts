import express from 'express';
import passport from 'passport';
import {
  register,
  login,
  getCurrentUser,
  googleCallback,
  getAllUsers,
  updateUserRole
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Email/Password authentication
router.post('/register', register);
router.post('/login', login);

// Get current user
router.get('/me', authenticate, getCurrentUser);

// Admin endpoints
router.get('/users', authenticate, getAllUsers);
router.put('/users/:id/role', authenticate, updateUserRole);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=auth_failed',
  }),
  googleCallback
);

export default router;
