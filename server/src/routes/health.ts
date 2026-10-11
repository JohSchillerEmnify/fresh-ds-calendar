import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';

export const VERSION = process.env.APP_VERSION ?? '0.1.0';

export async function healthRoutes(app: FastifyInstance, opts: { config: AppConfig }) {
  app.get('/api/health', async () => ({
    status: 'ok',
    version: VERSION,
    provider: opts.config.provider,
    time: new Date().toISOString(),
  }));
}
