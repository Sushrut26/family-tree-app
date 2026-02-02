import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from './config/passport';
import config from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { familyPasswordCheck } from './middleware/familyPasswordCheck';

// Import routes
import authRoutes from './routes/auth.routes';
import familyConfigRoutes from './routes/familyConfig.routes';
import personRoutes from './routes/person.routes';
import relationshipRoutes from './routes/relationship.routes';
import exportRoutes from './routes/export.routes';
import auditLogRoutes from './routes/auditLog.routes';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - general API limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Rate limiting for family password verification
const familyPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { error: 'Too many family password attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // In development, allow localhost origins
    if (config.nodeEnv === 'development') {
      if (!origin || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
    }

    // In production, strictly check against configured frontend URL
    if (origin === config.frontendUrl) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Family-Session'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());
// Apply to all requests (exemptions handled inside middleware)
app.use(familyPasswordCheck);

// Health check (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes with specific rate limits
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/family-config', familyPasswordLimiter, familyConfigRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/audit', auditLogRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Frontend URL: ${config.frontendUrl}`);
});

export default app;
