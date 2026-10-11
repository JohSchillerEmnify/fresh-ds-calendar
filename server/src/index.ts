import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
fs.mkdirSync(config.dataDir, { recursive: true });

const app = buildApp(config);
const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`calendar server listening on http://${info.address}:${info.port} (provider=${config.provider})`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
