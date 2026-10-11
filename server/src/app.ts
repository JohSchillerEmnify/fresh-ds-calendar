import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { AppConfig } from './config.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp(config: AppConfig, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(healthRoutes, { config });
  // Later: register event / tasklist routes backed by a CalendarProvider here.

  const hasWeb = config.webDist !== null && fs.existsSync(config.webDist);
  if (hasWeb) {
    await app.register(fastifyStatic, { root: config.webDist!, wildcard: false });
  }

  app.setNotFoundHandler((req, reply) => {
    const isApi = req.url.startsWith('/api');
    if (!isApi && hasWeb && req.method === 'GET') {
      // SPA fallback: client-side router handles the path.
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not Found', path: req.url });
  });

  return app;
}
