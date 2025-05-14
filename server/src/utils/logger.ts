/**
 * Logger utility for consistent logging across the application
 */

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
}

/**
 * Default configuration
 */
const defaultConfig: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false
};

/**
 * Logger implementation
 */
class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Format log message with timestamp
   */
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Write log to console and/or file
   */
  private log(level: LogLevel, message: string): void {
    // Skip logging if the level is below configuration
    const logLevels = Object.values(LogLevel);
    if (logLevels.indexOf(level) > logLevels.indexOf(this.config.level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message);

    // Console logging
    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
      }
    }

    // File logging could be implemented here if needed
    if (this.config.enableFile && this.config.filePath) {
      // Implementation for file logging would go here
      // Using Node.js fs module to append to log file
    }
  }

  /**
   * Log error message
   */
  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  /**
   * Log info message
   */
  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  /**
   * Log debug message
   */
  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }
}

/**
 * Export singleton logger instance
 */
export const logger = new Logger();