import jwt, { SignOptions, Secret, JwtPayload as JwtPayloadType } from 'jsonwebtoken';
import { config } from '../config/env';
import { IUser } from '../models/User';

// Interface for JWT payload
export interface JwtPayload extends JwtPayloadType {
  id: string;
  email: string;
  role: string;
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

  // Cast expiresIn to 'any' to satisfy type checker, since library supports string durations
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as any };
  const secret: Secret = config.jwtSecret;

  return jwt.sign(payload, secret, options);
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {JwtPayload | null} Decoded payload or null if invalid
 */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    const secret: Secret = config.jwtSecret;
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch {
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
    const decoded = jwt.decode(token) as JwtPayload | null;
    return decoded;
  } catch {
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
