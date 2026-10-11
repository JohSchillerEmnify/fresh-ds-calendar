import { Hono } from 'hono';
import type { AppConfig } from '../config.js';

export const VERSION = process.env.APP_VERSION ?? '0.1.0';

export function healthRoutes(config: AppConfig) {
  return new Hono().get('/health', (c) =>
    c.json({
      status: 'ok',
      version: VERSION,
      provider: config.provider,
      time: new Date().toISOString(),
    }),
  );
}
