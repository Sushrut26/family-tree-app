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

// Log startup config
console.log('CORS Config - Frontend URL:', config.frontendUrl);
console.log('CORS Config - Node ENV:', config.nodeEnv);

// Request logging middleware - FIRST to see all incoming requests
app.use((req, res, next) => {
  const start = Date.now();
  const origin = req.headers.origin || 'none';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const reqId = Math.random().toString(36).slice(2, 10);
  (req as any)._reqId = reqId;
  console.log(`[${new Date().toISOString()}] [${reqId}] ${req.method} ${req.path} - Origin: ${origin}`);
  console.log(`[${new Date().toISOString()}] [${reqId}] UA: ${userAgent}`);
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${reqId}] ${req.method} ${req.path} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// CORS configuration - MUST be BEFORE helmet and other middleware
// Using permissive CORS temporarily to debug
app.use(cors({
  origin: true, // Accept ALL origins temporarily for debugging
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Family-Session'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  optionsSuccessStatus: 200,
}));

// Security headers - AFTER CORS
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
  crossOriginResourcePolicy: { policy: 'cross-origin' },
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
// Note: In production, set to max: 5 per hour. For development/testing, use max: 20
const familyPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.nodeEnv === 'production' ? 5 : 20, // 5 per hour in prod, 20 in dev
  message: { error: 'Too many family password attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for CORS preflight
});

// Apply general rate limiting to all requests (AFTER CORS)
app.use(generalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());
// Apply to all requests (exemptions handled inside middleware)
app.use(familyPasswordCheck);

// Health check (no rate limiting)
app.get('/health', (req, res) => {
  const reqId = (req as any)._reqId || 'unknown';
  console.log(`[${new Date().toISOString()}] [${reqId}] Health check responding`);
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

// Crash visibility
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

export default app;
