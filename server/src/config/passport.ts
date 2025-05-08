import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import User from '../models/User';
import { config } from './env';
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

/**
 * Configure Passport with JWT strategy
 */
export const configurePassport = (): void => {
  // Options for JWT strategy
  const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.jwtSecret,
    ignoreExpiration: false,
    algorithms: ['HS256']
  };
  
  // Define JWT strategy
  passport.use(
    new JwtStrategy(options, async (jwtPayload, done) => {
      try {
        // Find user by ID from JWT payload
        const user = await User.findById(jwtPayload.id).select('-password');
        
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }
        
        if (!user.isActive) {
          return done(null, false, { message: 'User account is deactivated' });
        }
        
        // Update last activity if needed
        if (user.lastActive) {
          const now = new Date();
          const lastActive = new Date(user.lastActive);
          const diffHours = Math.abs(now.getTime() - lastActive.getTime()) / 36e5; // Convert ms to hours
          
          if (diffHours > 1) {
            user.lastActive = now;
            await user.save({ validateBeforeSave: false });
          }
        }
        
        // Return the user
        return done(null, user);
      } catch (error: any) {
        logger.error(`Error in JWT strategy: ${error.message}`);
        return done(error, false);
      }
    })
  );
};

// Initialize passport
export const initializePassport = (): void => {
  passport.initialize();
}

export default passport;