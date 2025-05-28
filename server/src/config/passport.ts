import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import User from '../models/User';
import { config } from './env';
import winston from 'winston';

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

export const configurePassport = (): void => {
  const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.jwtSecret,
    ignoreExpiration: false,
    algorithms: ['HS256']
  };
  
  passport.use(
    new JwtStrategy(options, async (jwtPayload, done) => {
      try {
        const user = await User.findById(jwtPayload.id).select('-password');
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }
        if (!user.active) {
          return done(null, false, { message: 'User account is deactivated' });
        }

        // Update lastActivity if needed
        if (user.lastActivity) {
          const now = new Date();
          const lastActivity = new Date(user.lastActivity);
          const diffHours = Math.abs(now.getTime() - lastActivity.getTime()) / 36e5;
          if (diffHours > 1) {
            user.lastActivity = now;
            await user.save({ validateBeforeSave: false });
          }
        }

        return done(null, user);
      } catch (error: any) {
        logger.error(`Error in JWT strategy: ${error.message}`);
        return done(error, false);
      }
    })
  );
};

export const initializePassport = (): void => {
  passport.initialize();
};

export default passport;
