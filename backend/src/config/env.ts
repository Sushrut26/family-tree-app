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

// Log JWT_EXPIRY for debugging
const jwtExpiry = (process.env.JWT_EXPIRY || '7d').trim();
console.log('JWT_EXPIRY raw from env:', JSON.stringify(process.env.JWT_EXPIRY));
console.log('JWT_EXPIRY after trim:', JSON.stringify(jwtExpiry));
console.log('JWT_EXPIRY length:', jwtExpiry.length);
console.log('JWT_EXPIRY charCodes:', jwtExpiry.split('').map(c => c.charCodeAt(0)));

// Validate JWT_EXPIRY format
const validExpiryFormats = /^(\d+[smhd])$/;
if (!validExpiryFormats.test(jwtExpiry)) {
  console.error('Invalid JWT_EXPIRY format:', jwtExpiry, '- must be like "7d", "24h", "30m", or "1800s"');
  console.error('Using default: 7d');
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiry: validExpiryFormats.test(jwtExpiry) ? jwtExpiry : '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

export default config;
