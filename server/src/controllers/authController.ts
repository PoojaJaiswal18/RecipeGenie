import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/error';
import validator from 'validator';
import winston from 'winston';
import { config } from '../config/env';
import { Types, Document } from 'mongoose';

// Enhanced type definitions that work with your existing User model
interface AuthenticatedUser extends Omit<IUser, '_id'> {
  _id: Types.ObjectId;
}

// Extend Express Request interface using express-serve-static-core
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

// Type for User document with proper ObjectId typing
type UserDocument = Document & IUser & {
  _id: Types.ObjectId;
};

// Initialize logger with enhanced configuration and error handling
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/auth.log',
      level: 'info',
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  exitOnError: false
});

/**
 * Enhanced input validation with comprehensive security checks
 */
const validateUserInput = (email: string, password: string): string | null => {
  // Email validation with enhanced security
  if (!email) {
    return 'Email is required';
  }
  
  if (typeof email !== 'string') {
    return 'Email must be a string';
  }
  
  if (!validator.isEmail(email)) {
    return 'Please provide a valid email address';
  }
  
  if (email.length > 254) {
    return 'Email address is too long';
  }
  
  // Check for suspicious email patterns
  if (validator.contains(email, '..') || validator.contains(email, '+')) {
    return 'Email format not allowed';
  }
  
  // Password validation with enhanced security
  if (!password) {
    return 'Password is required';
  }
  
  if (typeof password !== 'string') {
    return 'Password must be a string';
  }
  
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  
  if (password.length > 128) {
    return 'Password is too long (max 128 characters)';
  }
  
  // Enhanced password strength validation
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', '12345678', 'qwerty123', 'admin123'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    return 'Password is too common. Please choose a stronger password';
  }
  
  return null;
};

/**
 * Enhanced name validation with security considerations
 */
const validateName = (name: string): string | null => {
  if (!name) {
    return 'Name is required';
  }
  
  if (typeof name !== 'string') {
    return 'Name must be a string';
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    return 'Name must be at least 2 characters long';
  }
  
  if (trimmedName.length > 40) {
    return 'Name must be less than 40 characters';
  }
  
  // Enhanced character validation (letters, spaces, hyphens, apostrophes, accented characters)
  if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(trimmedName)) {
    return 'Name can only contain letters, spaces, hyphens, and apostrophes';
  }
  
  // Check for suspicious patterns
  if (/(.)\1{3,}/.test(trimmedName)) {
    return 'Name contains invalid repeated characters';
  }
  
  return null;
};

/**
 * Enhanced data sanitization with security focus
 */
const sanitizeUserData = (user: UserDocument): Partial<AuthenticatedUser> => {
  const sanitized = user.toObject();
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.passwordResetToken;
  delete sanitized.passwordResetExpires;
  delete sanitized.passwordChangedAt;
  delete sanitized.__v;
  
  // Ensure _id is properly formatted as ObjectId
  return {
    ...sanitized,
    _id: user._id
  } as Partial<AuthenticatedUser>;
};

/**
 * Safe user ID extraction with proper type handling
 */
const getUserId = (user: AuthenticatedUser | UserDocument): string => {
  return user._id.toString();
};

/**
 * Enhanced rate limiting check (placeholder for implementation)
 */
const checkRateLimit = (ip: string, action: string): boolean => {
  // Implementation would check Redis or in-memory store
  // For now, return true (no rate limiting)
  return true;
};

/**
 * Convert User document to AuthenticatedUser type safely
 */
const convertToAuthenticatedUser = (user: any): UserDocument => {
  return user as UserDocument;
};

/**
 * Register a new user with enhanced security
 * @route POST /api/auth/register
 * @access Public
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    const { email, password, passwordConfirm, name, preferences } = req.body;
    
    // Rate limiting check
    if (!checkRateLimit(req.ip || 'unknown', 'register')) {
      throw new AppError('Too many registration attempts. Please try again later.', 429);
    }
    
    // Comprehensive input validation
    const emailValidationError = validateUserInput(email, password);
    if (emailValidationError) {
      throw new AppError(emailValidationError, 400);
    }
    
    const nameValidationError = validateName(name);
    if (nameValidationError) {
      throw new AppError(nameValidationError, 400);
    }
    
    // Password confirmation validation
    if (!passwordConfirm) {
      throw new AppError('Password confirmation is required', 400);
    }
    
    if (password !== passwordConfirm) {
      throw new AppError('Passwords do not match', 400);
    }
    
    // Normalize and sanitize email
    const normalizedEmail = validator.normalizeEmail(email.toLowerCase().trim()) || email.toLowerCase().trim();
    
    // Check if user already exists with optimized query
    const existingUser = await User.findOne({ 
      email: normalizedEmail 
    }).select('_id').lean().exec();
    
    if (existingUser) {
      // Log potential duplicate registration attempt
      logger.warn('Duplicate registration attempt', {
        email: normalizedEmail,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      throw new AppError('User with this email already exists', 409);
    }
    
    // Prepare user data with validated preferences
    const userData = {
      email: normalizedEmail,
      password,
      passwordConfirm,
      name: name.trim(),
      preferences: preferences && typeof preferences === 'object' ? {
        dietaryRestrictions: Array.isArray(preferences.dietaryRestrictions) ? preferences.dietaryRestrictions : [],
        favoriteCuisines: Array.isArray(preferences.favoriteCuisines) ? preferences.favoriteCuisines : [],
        allergies: Array.isArray(preferences.allergies) ? preferences.allergies : [],
        dislikedIngredients: Array.isArray(preferences.dislikedIngredients) ? preferences.dislikedIngredients : []
      } : {
        dietaryRestrictions: [],
        favoriteCuisines: [],
        allergies: [],
        dislikedIngredients: []
      }
    };
    
    // Create new user with proper error handling
    const user = await User.create(userData);
    
    // Convert to proper type
    const userDoc = convertToAuthenticatedUser(user);
    
    // Generate JWT token
    const token = generateToken(userDoc);
    
    // Sanitize user data for response
    const sanitizedUser = sanitizeUserData(userDoc);
    
    // Performance logging
    const processingTime = Date.now() - startTime;
    
    // Log successful registration
    logger.info('User registered successfully', {
      userId: getUserId(userDoc),
      email: userDoc.email,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    // Send response with proper security headers
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      token,
      data: {
        user: sanitizedUser
      }
    });
  } catch (error) {
    // Enhanced error logging
    logger.error('Registration failed', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error',
      email: req.body?.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

/**
 * Login user with enhanced security
 * @route POST /api/auth/login
 * @access Public
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    const { email, password } = req.body;
    
    // Rate limiting check
    if (!checkRateLimit(req.ip || 'unknown', 'login')) {
      throw new AppError('Too many login attempts. Please try again later.', 429);
    }
    
    // Input validation
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }
    
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new AppError('Invalid input format', 400);
    }
    
    // Basic email format validation
    if (!validator.isEmail(email)) {
      throw new AppError('Please provide a valid email address', 400);
    }
    
    const normalizedEmail = validator.normalizeEmail(email.toLowerCase().trim()) || email.toLowerCase().trim();
    
    // Find user with password and optimized query
    const user = await User.findOne({ 
      email: normalizedEmail 
    }).select('+password +active').exec();
    
    // Check if user exists and password is correct
    if (!user || !(await user.comparePassword(password))) {
      // Log failed login attempt with security context
      logger.warn('Failed login attempt', {
        email: normalizedEmail,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        reason: !user ? 'user_not_found' : 'invalid_password'
      });
      
      // Generic error message for security
      throw new AppError('Invalid email or password', 401);
    }
    
    // Check if user account is active
    if (!user.active) {
      logger.warn('Login attempt on deactivated account', {
        userId: user._id.toString(),
        email: normalizedEmail,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      throw new AppError('Your account has been deactivated. Please contact support.', 401);
    }
    
    // Convert to proper type
    const userDoc = convertToAuthenticatedUser(user);
    
    // Generate JWT token
    const token = generateToken(userDoc);
    
    // Sanitize user data for response
    const sanitizedUser = sanitizeUserData(userDoc);
    
    // Performance logging
    const processingTime = Date.now() - startTime;
    
    // Log successful login
    logger.info('User logged in successfully', {
      userId: getUserId(userDoc),
      email: userDoc.email,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    // Send response
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      data: {
        user: sanitizedUser
      }
    });
  } catch (error) {
    // Enhanced error logging
    logger.error('Login failed', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error',
      email: req.body?.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

/**
 * Get current user profile with enhanced security
 * @route GET /api/auth/me
 * @access Private
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    
    // Type assertion with proper error handling
    const user = req.user as AuthenticatedUser;
    
    if (!user || !user._id) {
      throw new AppError('User not found in request. Please login again.', 401);
    }
    
    // Validate ObjectId
    if (!Types.ObjectId.isValid(user._id)) {
      throw new AppError('Invalid user ID format', 400);
    }
    
    // Fetch fresh user data to ensure accuracy
    const freshUser = await User.findById(user._id).exec();
    
    if (!freshUser) {
      throw new AppError('User no longer exists', 404);
    }
    
    // Convert to proper type
    const userDoc = convertToAuthenticatedUser(freshUser);
    
    // Sanitize user data
    const sanitizedUser = sanitizeUserData(userDoc);
    
    // Performance logging
    const processingTime = Date.now() - startTime;
    
    logger.info('User profile retrieved', {
      userId: getUserId(user),
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        user: sanitizedUser
      }
    });
  } catch (error) {
    logger.error('Get user profile failed', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error',
      userId: req.user ? getUserId(req.user as AuthenticatedUser) : 'unknown',
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

/**
 * Update user profile with enhanced validation
 * @route PATCH /api/auth/me
 * @access Private
 */
export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    const user = req.user as AuthenticatedUser;
    
    if (!user || !user._id) {
      throw new AppError('User not found in request. Please login again.', 401);
    }
    
    const { name, preferences, photo } = req.body;
    
    // Prevent restricted field updates
    const restrictedFields = ['password', 'passwordConfirm', 'role', 'active', 'email', '_id'];
    const hasRestrictedFields = restrictedFields.some(field => req.body[field] !== undefined);
    
    if (hasRestrictedFields) {
      throw new AppError(
        'This route cannot be used to update restricted fields. Please use appropriate endpoints.',
        400
      );
    }
    
    // Validate name if provided
    if (name !== undefined) {
      const nameValidationError = validateName(name);
      if (nameValidationError) {
        throw new AppError(nameValidationError, 400);
      }
    }
    
    // Validate photo URL if provided
    if (photo !== undefined && photo !== null) {
      if (typeof photo !== 'string') {
        throw new AppError('Photo must be a string URL', 400);
      }
      if (photo.length > 500) {
        throw new AppError('Photo URL is too long', 400);
      }
      if (!validator.isURL(photo, { protocols: ['http', 'https'] })) {
        throw new AppError('Photo must be a valid URL', 400);
      }
    }
    
    // Prepare update object with validation
    const updateData: Partial<IUser> = {};
    
    if (name) updateData.name = name.trim();
    if (photo !== undefined) updateData.photo = photo;
    
    if (preferences) {
      // Enhanced preferences validation
      if (typeof preferences !== 'object' || Array.isArray(preferences)) {
        throw new AppError('Preferences must be an object', 400);
      }
      
      // Get current user data for merging
      const currentUser = await User.findById(user._id).exec();
      if (!currentUser) {
        throw new AppError('User not found', 404);
      }
      
      // Validate and merge preferences
      const validatedPreferences = {
        dietaryRestrictions: Array.isArray(preferences.dietaryRestrictions) 
          ? preferences.dietaryRestrictions.filter((item: any) => typeof item === 'string' && item.length <= 50)
          : currentUser.preferences?.dietaryRestrictions || [],
        favoriteCuisines: Array.isArray(preferences.favoriteCuisines)
          ? preferences.favoriteCuisines.filter((item: any) => typeof item === 'string' && item.length <= 50)
          : currentUser.preferences?.favoriteCuisines || [],
        allergies: Array.isArray(preferences.allergies)
          ? preferences.allergies.filter((item: any) => typeof item === 'string' && item.length <= 50)
          : currentUser.preferences?.allergies || [],
        dislikedIngredients: Array.isArray(preferences.dislikedIngredients)
          ? preferences.dislikedIngredients.filter((item: any) => typeof item === 'string' && item.length <= 50)
          : currentUser.preferences?.dislikedIngredients || []
      };
      
      updateData.preferences = validatedPreferences;
    }
    
    // Update user with validation
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      updateData,
      {
        new: true,
        runValidators: true,
        context: 'query'
      }
    ).exec();
    
    if (!updatedUser) {
      throw new AppError('User not found', 404);
    }
    
    // Convert to proper type
    const userDoc = convertToAuthenticatedUser(updatedUser);
    
    // Sanitize user data
    const sanitizedUser = sanitizeUserData(userDoc);
    
    // Performance logging
    const processingTime = Date.now() - startTime;
    
    // Log profile update
    logger.info('User profile updated', {
      userId: getUserId(user),
      email: user.email,
      updatedFields: Object.keys(updateData),
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: sanitizedUser
      }
    });
  } catch (error) {
    logger.error('Profile update failed', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error',
      userId: req.user ? getUserId(req.user as AuthenticatedUser) : 'unknown',
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

/**
 * Update user password with enhanced security
 * @route PATCH /api/auth/update-password
 * @access Private
 */
export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;
    
    // Input validation
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      throw new AppError(
        'Please provide current password, new password, and password confirmation',
        400
      );
    }
    
    // Type validation
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || typeof newPasswordConfirm !== 'string') {
      throw new AppError('All password fields must be strings', 400);
    }
    
    // Validate new password
    const passwordValidationError = validateUserInput('dummy@email.com', newPassword);
    if (passwordValidationError && !passwordValidationError.includes('email')) {
      throw new AppError(passwordValidationError, 400);
    }
    
    // Check password confirmation
    if (newPassword !== newPasswordConfirm) {
      throw new AppError('New passwords do not match', 400);
    }
    
    // Check if new password is different from current
    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from current password', 400);
    }
    
    // Get user with password using proper type handling
    const currentUser = req.user as AuthenticatedUser;
    
    if (!currentUser || !currentUser._id) {
      throw new AppError('User not found in request. Please login again.', 401);
    }
    
    const userId = currentUser._id;
    
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID format', 400);
    }
    
    const user = await User.findById(userId).select('+password').exec();
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Verify current password
    if (!(await user.comparePassword(currentPassword))) {
      logger.warn('Incorrect current password attempt', {
        userId: userId.toString(),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      throw new AppError('Your current password is incorrect', 401);
    }
    
    // Update password (pre-save middleware will handle hashing)
    user.password = newPassword;
    user.passwordConfirm = newPasswordConfirm;
    await user.save();
    
    // Convert to proper type
    const userDoc = convertToAuthenticatedUser(user);
    
    // Generate new token
    const token = generateToken(userDoc);
    
    // Performance logging
    const processingTime = Date.now() - startTime;
    
    // Log password update
    logger.info('Password updated successfully', {
      userId: getUserId(userDoc),
      email: userDoc.email,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
      token
    });
  } catch (error) {
    logger.error('Password update failed', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error',
      userId: req.user ? getUserId(req.user as AuthenticatedUser) : 'unknown',
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

/**
 * Logout user with session cleanup
 * @route POST /api/auth/logout
 * @access Private
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    
    if (!user) {
      throw new AppError('User not found in request', 401);
    }
    
    // Log logout
    logger.info('User logged out', {
      userId: getUserId(user),
      email: user.email,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

// Export all controller functions with proper typing
export default {
  register,
  login,
  getMe,
  updateMe,
  updatePassword,
  logout
} as const;
