import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/error';
import validator from 'validator';
import winston from 'winston';
import { config } from '../config/env';

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
 * Validate user input for registration and login
 */
const validateUserInput = (email: string, password: string): string | null => {
  if (!email || !validator.isEmail(email)) {
    return 'Please provide a valid email address';
  }
  
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  
  return null;
};

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name, preferences } = req.body;
    
    // Validate input
    const validationError = validateUserInput(email, password);
    if (validationError) {
      throw new AppError(validationError, 400);
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }
    
    // Create new user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      preferences: preferences || {
        dietaryRestrictions: [],
        favoriteCuisines: [],
        allergies: [],
        dislikedIngredients: []
      },
      lastActive: new Date()
    });
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Remove password from response
    user.password = undefined as any;
    
    logger.info(`New user registered: ${user.email}`);
    
    // Send response
    res.status(201).json({
      status: 'success',
      token,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    const validationError = validateUserInput(email, password);
    if (validationError) {
      throw new AppError(validationError, 400);
    }
    
    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    // Check if user exists and password is correct
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }
    
    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated', 401);
    }
    
    // Update last active timestamp
    user.lastActive = new Date();
    await user.save({ validateBeforeSave: false });
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Remove password from response
    user.password = undefined as any;
    
    logger.info(`User logged in: ${user.email}`);
    
    // Send response
    res.status(200).json({
      status: 'success',
      token,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // User is already attached to req by auth middleware
    const user = req.user as IUser;
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PATCH /api/auth/me
 * @access Private
 */
export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { name, preferences } = req.body;
    
    // Disallow password update through this route
    if (req.body.password) {
      throw new AppError('This route is not for password updates. Please use /api/auth/update-password', 400);
    }
    
    // Update allowed fields
    if (name) user.name = name;
    if (preferences) {
      // Allow partial updates of preferences
      user.preferences = {
        ...user.preferences,
        ...preferences
      };
    }
    
    // Save user
    await user.save({ validateBeforeSave: true });
    
    logger.info(`User profile updated: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user password
 * @route PATCH /api/auth/update-password
 * @access Private
 */
export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      throw new AppError('Please provide both current and new password', 400);
    }
    
    if (newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }
    
    // Get user with password
    const user = await User.findById(req.user?._id).select('+password');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Check if current password is correct
    if (!(await user.comparePassword(currentPassword))) {
      throw new AppError('Your current password is incorrect', 401);
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Generate new token
    const token = generateToken(user);
    
    logger.info(`Password updated for user: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      token,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  getMe,
  updateMe,
  updatePassword
};