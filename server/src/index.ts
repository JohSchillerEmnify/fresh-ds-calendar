import fs from 'node:fs';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
fs.mkdirSync(config.dataDir, { recursive: true });

const app = await buildApp(config, { logger: true });
try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    app.close().then(() => process.exit(0));
  });
}
