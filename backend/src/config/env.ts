import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Validate JWT_SECRET strength (minimum 32 characters)
if (process.env.JWT_SECRET!.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

// Normalize JWT_EXPIRY (trim whitespace and validate format)
let jwtExpiry = (process.env.JWT_EXPIRY || '7d').trim();

// Validate JWT_EXPIRY format - must be like "7d", "24h", "30m", "1800s"
const validExpiryRegex = /^(\d+[smhd])$/;
if (!validExpiryRegex.test(jwtExpiry)) {
  console.warn(`Invalid JWT_EXPIRY format: "${jwtExpiry}". Using default: "7d"`);
  jwtExpiry = '7d';
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiry: jwtExpiry,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

export default config;
