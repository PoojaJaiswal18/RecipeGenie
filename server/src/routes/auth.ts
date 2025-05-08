import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from './error';
import User, { IUser } from '../models/User';
import winston from 'winston';

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

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
    }
  }
}

/**
 * Middleware to protect routes that require authentication
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1) Check if token exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      throw new AppError('You are not logged in. Please log in to get access.', 401);
    }

    // 2) Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!currentUser) {
      throw new AppError(
        'The user belonging to this token no longer exists.',
        401
      );
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      throw new AppError(
        'User recently changed password! Please log in again.',
        401
      );
    }

    // Grant access to protected route
    req.user = currentUser;
    req.token = token;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      logger.error(`JWT error: ${err.message}`);
      next(new AppError('Invalid token. Please log in again!', 401));
    } else if (err instanceof jwt.TokenExpiredError) {
      logger.error(`JWT expired: ${err.message}`);
      next(new AppError('Your token has expired! Please log in again.', 401));
    } else {
      next(err);
    }
  }
};

/**
 * Optional authentication middleware - attaches user if token exists but doesn't require it
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1) Check if token exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(); // No token, but that's ok - continue without user
    }

    // 2) Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(); // User no longer exists, but that's ok - continue without user
    }

    // Attach user to request
    req.user = currentUser;
    req.token = token;
    next();
  } catch (err) {
    // If token validation fails, just continue without a user
    logger.warn(`Optional auth failed: ${err}`);
    next();
  }
};

/**
 * Middleware to restrict access to certain user roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user exists and has required role
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

/**
 * Middleware to check if user is accessing their own resource
 */
export const isResourceOwner = (paramIdField: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params[paramIdField];
    const userId = req.user?._id.toString();
    
    if (!userId || resourceId !== userId) {
      return next(
        new AppError('You do not have permission to access this resource', 403)
      );
    }
    next();
  };
};