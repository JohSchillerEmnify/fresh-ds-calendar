import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  provider: 'mock' | 'google';
  /** Directory of the built web app; null disables static serving. */
  webDist: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    dataDir: env.DATA_DIR ?? path.resolve('data'),
    provider: env.PROVIDER === 'google' ? 'google' : 'mock',
    webDist: env.WEB_DIST ?? path.resolve(here, '../../web/dist'),
  };
}
