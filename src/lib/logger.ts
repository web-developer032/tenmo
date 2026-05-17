import { pino } from 'pino';
import { getServerEnv } from '@/lib/env.server';

let cached: ReturnType<typeof pino> | null = null;

/**
 * Pino logger — structured JSON in prod, pretty in dev.
 * Redacts known PII paths to satisfy the "no PII in logs" non-negotiable.
 */
export function getLogger() {
  if (cached) return cached;

  const isDev = process.env.NODE_ENV !== 'production';
  const { LOG_LEVEL } = getServerEnv();

  cached = pino({
    level: LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'user.email',
        'user.contact_email',
        'user.contact_phone',
        'user.full_name',
        'profile.contact_email',
        'profile.contact_phone',
        'profile.full_name',
        'address.line1',
        'address.line2',
        'address.postcode',
        'body.email',
        'body.password',
      ],
      censor: '[REDACTED]',
    },
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
        }
      : undefined,
  });

  return cached;
}
