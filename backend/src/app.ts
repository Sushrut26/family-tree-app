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

// Trust proxy for Railway/Heroku/etc (required for rate limiting behind reverse proxy)
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

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
  // Enable HSTS in production (tells browsers to always use HTTPS)
  hsts: config.nodeEnv === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// Rate limiting - general API limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req, _res) => _req.method === 'OPTIONS', // Skip rate limiting for CORS preflight
});

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for CORS preflight
});

// Rate limiting for family password verification
const familyPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { error: 'Too many family password attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for CORS preflight
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// CORS configuration
// Log CORS config at startup for debugging
console.log('CORS Config - Frontend URL:', config.frontendUrl);
console.log('CORS Config - Node ENV:', config.nodeEnv);

app.use(cors({
  origin: function(origin, callback) {
    // Log every CORS request for debugging
    console.log('CORS Request - Origin:', origin, '| Expected:', config.frontendUrl, '| Match:', origin === config.frontendUrl);

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

    // Also allow requests with no origin (like health checks, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    console.log('CORS Rejected - Origin:', origin);
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
  // Only log frontend URL in development (avoid exposing config in production logs)
  if (config.nodeEnv === 'development') {
    console.log(`Frontend URL: ${config.frontendUrl}`);
  }
});

export default app;
