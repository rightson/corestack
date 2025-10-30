import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Centralized logger using Pino for structured logging
 *
 * Features:
 * - Structured JSON logging in production
 * - Pretty-printed logs in development
 * - Automatic timestamp and hostname
 * - Child loggers with context
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

/**
 * Create a child logger with additional context
 *
 * @param context - Additional context to include in all log messages
 * @returns Child logger instance
 *
 * @example
 * const wsLogger = createLogger({ service: 'websocket' });
 * wsLogger.info({ clientId: '123' }, 'Client connected');
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log levels:
 * - fatal (60): The service/app is going to stop or become unusable
 * - error (50): Fatal for a particular request, but the service/app continues
 * - warn (40): A note on something that should probably be looked at
 * - info (30): Detail on regular operation
 * - debug (20): Anything else, i.e. too verbose to be included in "info" level
 * - trace (10): Logging from external libraries used by your app
 */

// Export typed logger methods for convenience
export type Logger = pino.Logger;
