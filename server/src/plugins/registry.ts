/**
 * Plugin registry (ADR 0004): optional integrations live in `plugins/<name>/`, one folder each, and are mounted
 * under `/api/<name>` only while their configuration enables them. A disabled plugin's paths do not exist (404).
 * The core never imports a plugin by name beyond this list; the health and config answers name the enabled ones.
 */
import { Hono } from 'hono';
import type { Ctx } from '../context.js';
import { notFound } from '../lib/errors.js';

export interface Plugin {
  /** Path segment under `/api/` and the name the health answer lists. */
  name: string;
  /** Whether the deployment (or a TEST_MODE override) turned the plugin on. Evaluated per request. */
  enabled(ctx: Ctx): boolean;
  /** The plugin's routes, mounted under `/api/<name>`; they answer without a browser session. */
  routes(ctx: Ctx): Hono;
}

export const plugins: Plugin[] = [];

/** Names of the plugins that are on right now. */
export const enabledPlugins = (ctx: Ctx): string[] => plugins.filter((p) => p.enabled(ctx)).map((p) => p.name);

/** Every plugin's routes behind a per-request gate: off means the path is not there. */
export function pluginRoutes(ctx: Ctx): Hono {
  const r = new Hono();
  for (const p of plugins) {
    const gate = async (_c: unknown, next: () => Promise<void>) => {
      if (!p.enabled(ctx)) throw notFound();
      await next();
    };
    r.use(`/${p.name}`, gate);
    r.use(`/${p.name}/*`, gate);
    r.route(`/${p.name}`, p.routes(ctx));
  }
  return r;
}
