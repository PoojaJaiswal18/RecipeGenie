import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { connectDB } from './config/db';
import { configurePassport } from './config/passport';
// FIX: Use named import for auth middleware, not default import
import * as authMiddleware from './middleware/auth';
import recipeRoutes from './routes/recipes';
import { errorHandler } from './middleware/error';
import winston from 'winston';
import authRoutes from './routes/auth';


// --- Winston Logger Setup (Production-grade, multi-transport) ---
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// --- Uncaught Exception Handler ---
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(`${err.name}: ${err.message}\n${err.stack}`);
  process.exit(1);
});

// --- Express App Initialization ---
const app: Application = express();

// --- Trust Proxy for Rate Limiting & Security (Cloud/Proxy Ready) ---
app.set('trust proxy', 1);

// --- MongoDB Connection ---
connectDB();

// --- Passport Configuration ---
configurePassport();

// --- Security Headers ---
app.use(helmet());

// --- CORS Configuration ---
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// --- HTTP Request Logging (Morgan + Winston) ---
app.use(morgan('dev', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// --- Body Parsers ---
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Compression (Performance) ---
app.use(compression());

// --- Rate Limiting (Security) ---
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api', limiter);

// --- Health Check Endpoint ---
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// --- API Routes ---
// If you have auth routes, import and use them here, e.g.:
// import authRoutes from './routes/auth';
// app.use('/api/auth', authRoutes);

// If you want to expose some of the auth middleware as routes, you can do so here
// (otherwise, REMOVE the following line, since auth middleware is not a router!)
// app.use('/api/auth', authRoutes); // <-- Only if you have an auth router
app.use('/api/auth', authRoutes);

app.use('/api/recipes', recipeRoutes);

// --- 404 Handler ---
app.all('*', (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// --- Global Error Handler ---
app.use(errorHandler);

// --- Server Startup ---
const PORT = config.port || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});

// --- Unhandled Promise Rejection Handler ---
process.on('unhandledRejection', (err: any) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(`${err.name}: ${err.message}\n${err.stack}`);
  server.close(() => {
    process.exit(1);
  });
});

// --- SIGTERM Handler (Graceful Shutdown) ---
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.info('💥 Process terminated!');
  });
});

export default server;
