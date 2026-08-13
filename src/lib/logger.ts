/**
 * Production Logger
 *
 * Structured logging utility for the Innovion platform.
 * In production, logs are structured JSON for ingestion by log aggregators.
 * In development, logs are human-readable with colour coding.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error('service', 'Operation failed', { context });
 *   logger.warn('service', 'Degraded state', { context });
 *   logger.info('service', 'Operation succeeded', { context });
 *   logger.debug('service', 'Verbose detail', { context });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

const isDev = process.env.NODE_ENV !== 'production';

function formatEntry(entry: LogEntry): string {
  if (isDev) {
    const prefix = {
      debug: '🔍 DEBUG',
      info:  '✅ INFO ',
      warn:  '⚠️  WARN ',
      error: '❌ ERROR',
    }[entry.level];
    const ctx = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
    const err = entry.error ? ` | ${entry.error}` : '';
    return `[${entry.timestamp}] ${prefix} [${entry.service}] ${entry.message}${ctx}${err}`;
  }
  return JSON.stringify(entry);
}

function log(level: LogLevel, service: string, message: string, context?: Record<string, unknown>, err?: unknown): void {
  const entry: LogEntry = {
    level,
    service,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  if (err instanceof Error) {
    entry.error = err.message;
    if (isDev) entry.stack = err.stack;
  } else if (err !== undefined) {
    entry.error = String(err);
  }

  const formatted = formatEntry(entry);

  switch (level) {
    case 'debug': if (isDev) console.info(formatted); break;
    case 'info':  if (isDev) console.info(formatted); break;
    case 'warn':  if (isDev) console.warn(formatted); break;
    case 'error': if (isDev) console.error(formatted); break;
  }
}

export const logger = {
  debug: (service: string, message: string, context?: Record<string, unknown>) =>
    log('debug', service, message, context),
  info: (service: string, message: string, context?: Record<string, unknown>) =>
    log('info', service, message, context),
  warn: (service: string, message: string, context?: Record<string, unknown>) =>
    log('warn', service, message, context),
  error: (service: string, message: string, context?: Record<string, unknown>, err?: unknown) =>
    log('error', service, message, context, err),
};

export default logger;
