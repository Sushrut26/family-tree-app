import express from 'express';
import passport from 'passport';
import { register, login, getCurrentUser, googleCallback } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Email/Password authentication
router.post('/register', register);
router.post('/login', login);

// Get current user
router.get('/me', authenticate, getCurrentUser);

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
