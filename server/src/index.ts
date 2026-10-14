import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { VERSION } from './context.js';
import { logEvent } from './lib/diag.js';

const config = loadConfig();
fs.mkdirSync(config.dataDir, { recursive: true });

let opts = {};
if (config.provider === 'google') {
  // Lazy: the Google client libraries are only loaded when PROVIDER=google.
  const { createGoogleProvider } = await import('./providers/google/GoogleProvider.js');
  // The shared provider has no person behind it; every signed-in person gets their own (ctx.calendarFor).
  const { GoogleDrive } = await import('./providers/google/GoogleDrive.js');
  const { getUserClient } = await import('./providers/google/auth.js');
  opts = {
    provider: createGoogleProvider(config, 'anonymous'), personProvider: (sub: string) => createGoogleProvider(config, sub),
    driveFor: (sub: string) => new GoogleDrive(getUserClient(config, sub)),
  };
}
const app = buildApp(config, opts);
if (config.provider === 'mock' && config.seed && !config.testMode && app.ctx.mock && !app.ctx.mock.loadedFromDisk) {
  await app.ctx.seed();
}

app.ctx.backup.start();
app.ctx.push.start();

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`calendar server listening on http://${info.address}:${info.port} (provider=${config.provider}${config.testMode ? ', TEST_MODE' : ''})`);
  // one line per boot, to correlate restarts (deploys, crashes) with the errors people see
  logEvent('startup', { version: VERSION, provider: config.provider, node: process.version, pid: process.pid });
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    app.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
