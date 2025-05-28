import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Interface for config object
interface Config {
  nodeEnv: string;
  port: number;
  mongoURI: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  spoonacularApiKey: string;
  spoonacularBaseUrl: string;
  aiServiceUrl: string;
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  corsOrigin: string;
}

// Export configuration object
export const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongoURI: process.env.NODE_ENV === 'production' 
    ? process.env.MONGODB_URI_PROD || ''
    : process.env.MONGODB_URI || 'mongodb://localhost:27017/recipe-genie',
  jwtSecret: process.env.JWT_SECRET || 'your-fallback-secret', // Always a string
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d', // e.g., '7d', '1h'
  spoonacularApiKey: process.env.SPOONACULAR_API_KEY || '0fe2bd6d0c3e4951bfab386b377752a6',
  spoonacularBaseUrl: process.env.SPOONACULAR_BASE_URL || 'https://api.spoonacular.com',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:5001/api/enhance-recipes',
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
};

// Validate critical configuration
const validateConfig = (): void => {
  if (!config.jwtSecret || config.jwtSecret === 'default_jwt_secret_change_this') {
    if (config.nodeEnv === 'production') {
      throw new Error('JWT_SECRET is required in production environment');
    } else {
      console.warn('Warning: Using default JWT_SECRET. This is insecure for production use.');
    }
  }

  if (!config.spoonacularApiKey) {
    console.warn('Warning: SPOONACULAR_API_KEY is not set. API functionality will be limited.');
  }

  if (!config.mongoURI) {
    throw new Error('MongoDB URI is required');
  }
};

validateConfig();

export default config;