import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { IUser } from '../models/User';

// Interface for JWT payload
interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number; // Issued at timestamp
  exp?: number; // Expiration timestamp
}

/**
 * Generate a JWT token for a user
 * @param {IUser} user - User document
 * @returns {string} JWT token
 */
export const generateToken = (user: IUser): string => {
  const payload: JwtPayload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {JwtPayload | null} Decoded payload or null if invalid
 */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return decoded;
  } catch (error) {
    // If token is invalid, expired, etc.
    return null;
  }
};

/**
 * Extract JWT token from authorization header
 * @param {string} authHeader - Authorization header
 * @returns {string | null} JWT token or null if not found
 */
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Format: "Bearer {token}"
  return authHeader.split(' ')[1];
};

/**
 * Decode JWT token without verification
 * Useful for debugging or when verification is handled elsewhere
 * @param {string} token - JWT token
 * @returns {JwtPayload | null} Decoded payload or null if invalid
 */
export const decodeToken = (token: string): JwtPayload | null => {
  try {
    // Decode without verification
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Check if a token has expired
 * @param {string} token - JWT token
 * @returns {boolean} True if expired, false otherwise
 */
export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
};

export default {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  decodeToken,
  isTokenExpired
};