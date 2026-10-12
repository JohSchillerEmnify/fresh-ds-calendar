import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
fs.mkdirSync(config.dataDir, { recursive: true });

let provider;
if (config.provider === 'google') {
  // Lazy: the Google client libraries are only loaded when PROVIDER=google.
  const { createGoogleProvider } = await import('./providers/google/GoogleProvider.js');
  provider = createGoogleProvider(config);
}
const app = buildApp(config, provider ? { provider } : {});
if (config.provider === 'mock' && config.seed && !config.testMode && app.ctx.mock && !app.ctx.mock.loadedFromDisk) {
  await app.ctx.seed();
}

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`calendar server listening on http://${info.address}:${info.port} (provider=${config.provider}${config.testMode ? ', TEST_MODE' : ''})`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    app.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
