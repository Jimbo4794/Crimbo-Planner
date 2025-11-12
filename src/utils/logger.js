/**
 * Logger utility for consistent logging across the application
 * Works in both browser and Node.js environments
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Determine environment
const isBrowser = typeof window !== 'undefined';
const isProduction = isBrowser 
  ? import.meta.env?.PROD || import.meta.env?.MODE === 'production'
  : process.env.NODE_ENV === 'production';

// Get log level from environment or default
const getLogLevel = () => {
  if (isBrowser) {
    const level = import.meta.env?.VITE_LOG_LEVEL?.toUpperCase();
    if (level && LOG_LEVELS[level] !== undefined) {
      return LOG_LEVELS[level];
    }
  } else {
    const level = process.env.LOG_LEVEL?.toUpperCase();
    if (level && LOG_LEVELS[level] !== undefined) {
      return LOG_LEVELS[level];
    }
  }
  
  // Default: show all in dev, only warn/error in production
  return isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
};

const currentLogLevel = getLogLevel();

// Format timestamp
const formatTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

// Format log message with context
const formatMessage = (level, context, ...args) => {
  const timestamp = formatTimestamp();
  const contextStr = context ? `[${context}]` : '';
  const levelStr = level.toUpperCase().padEnd(5);
  
  return {
    timestamp,
    level: levelStr,
    context: contextStr,
    message: args
  };
};

// Color codes for terminal (Node.js only)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

const getColorForLevel = (level) => {
  switch (level.toUpperCase()) {
    case 'ERROR': return colors.red;
    case 'WARN': return colors.yellow;
    case 'INFO': return colors.blue;
    case 'DEBUG': return colors.cyan;
    default: return colors.reset;
  }
};

// Output log message
const outputLog = (level, formatted) => {
  if (isBrowser) {
    // Browser: use console methods with appropriate styling
    const consoleMethod = level === 'error' ? console.error 
      : level === 'warn' ? console.warn 
      : level === 'info' ? console.info 
      : console.log;
    
    const prefix = `%c[${formatted.timestamp}] ${formatted.level}${formatted.context}`;
    const style = level === 'error' ? 'color: red; font-weight: bold;'
      : level === 'warn' ? 'color: orange; font-weight: bold;'
      : level === 'info' ? 'color: blue;'
      : 'color: gray;';
    
    consoleMethod(prefix, style, ...formatted.message);
  } else {
    // Node.js: use colors and format nicely
    const color = getColorForLevel(level);
    const prefix = `${colors.gray}[${formatted.timestamp}]${colors.reset} ${color}${formatted.level}${colors.reset}${formatted.context}`;
    const consoleMethod = level === 'error' ? console.error 
      : level === 'warn' ? console.warn 
      : console.log;
    
    consoleMethod(prefix, ...formatted.message);
  }
};

// Create logger instance with optional context
export const createLogger = (context = null) => {
  return {
    debug: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.DEBUG) {
        const formatted = formatMessage('debug', context, ...args);
        outputLog('debug', formatted);
      }
    },
    
    info: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        const formatted = formatMessage('info', context, ...args);
        outputLog('info', formatted);
      }
    },
    
    warn: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.WARN) {
        const formatted = formatMessage('warn', context, ...args);
        outputLog('warn', formatted);
      }
    },
    
    error: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.ERROR) {
        const formatted = formatMessage('error', context, ...args);
        outputLog('error', formatted);
      }
    }
  };
};

// Default logger instance
const defaultLogger = createLogger();

// Export default logger methods
export const logger = {
  debug: defaultLogger.debug,
  info: defaultLogger.info,
  warn: defaultLogger.warn,
  error: defaultLogger.error,
  create: createLogger
};

export default logger;

