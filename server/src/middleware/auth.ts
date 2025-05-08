import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { IUser } from '../models/User';
import winston from 'winston';
import { config } from '../config/env';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// Initialize logger
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
    })
  ]
});

/**
 * Check if user is authenticated
 * Uses passport JWT strategy
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('jwt', { session: false }, (err: Error, user: IUser, info: any) => {
    if (err) {
      logger.error(`Authentication error: ${err.message}`);
      return next(err);
    }
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: info?.message || 'Unauthorized - Authentication required'
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Check if user has required role
 * @param {string[]} roles - Array of allowed roles
 */
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized - Authentication required'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden - Insufficient permissions'
      });
    }
    
    next();
  };
};

/**
 * Lighter version of authentication for optional auth
 * If token exists and is valid, attaches user to request
 * If no token or invalid token, continues without error
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    return next();
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return next();
  }
  
  // Use passport for consistency
  passport.authenticate('jwt', { session: false }, (err: Error, user: IUser) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
};

export default {
  authenticate,
  authorize,
  optionalAuth
};