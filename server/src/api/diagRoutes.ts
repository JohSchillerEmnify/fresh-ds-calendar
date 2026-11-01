/**
 * `POST /api/diag/sync-error` (API.md "Diagnostics"): the web app tells the server when it shows the "Can't reach
 * Google Calendar" banner, so the cause can be found in the server log next to the Google errors. Logging only.
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import * as v from 'valibot';
import type { Ctx } from '../context.js';
import { SESSION_COOKIE } from '../auth/sessions.js';
import { ApiException, validation } from '../lib/errors.js';
import { logEvent, subHash } from '../lib/diag.js';
import { parse } from '../lib/validation.js';
import type { AuthEnv } from '../auth/middleware.js';

/** At most one beacon per client in this window. */
const BEACON_EVERY_MS = 60_000;
const MAX_BODY_BYTES = 1024;

const beaconSchema = v.strictObject({
  kind: v.picklist(['network', 'timeout', 'http', 'abort'], 'kind must be network, timeout, http or abort'),
  status: v.optional(v.pipe(v.number('status must be a number'), v.integer('status must be a whole number'), v.minValue(100, 'status must be 100-599'), v.maxValue(599, 'status must be 100-599'))),
  task: v.pipe(v.string('task must be text'), v.regex(/^[A-Za-z0-9_.:-]{1,32}$/, 'task must be 1-32 characters of A-Z a-z 0-9 _ . : -')),
  online: v.boolean('online must be true or false'),
  resumed: v.boolean('resumed must be true or false'),
  app: v.boolean('app must be true or false'),
  ageSec: v.optional(v.pipe(v.number('ageSec must be a number'), v.integer('ageSec must be a whole number'), v.minValue(0, 'ageSec must be 0-604800'), v.maxValue(604_800, 'ageSec must be 0-604800'))),
});

export function diagRoutes(ctx: Ctx): Hono<AuthEnv> {
  const r = new Hono<AuthEnv>();
  /** Last accepted beacon per client (session id, or "local" while sign-in is off). */
  const last = new Map<string, number>();

  r.post(
    '/diag/sync-error',
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: { code: 'VALIDATION_ERROR', message: 'Body too large' } }, 400) }),
    async (c) => {
      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        throw validation('Request body must be valid JSON');
      }
      const b = parse(beaconSchema, raw);
      const now = ctx.clock.real();
      for (const [k, t] of last) if (now - t >= BEACON_EVERY_MS) last.delete(k);
      const client = getCookie(c, SESSION_COOKIE) ?? 'local';
      if (last.has(client)) throw new ApiException('RATE_LIMITED', 429, 'At most one report per minute');
      last.set(client, now);
      logEvent('client_sync_error', { subHash: subHash(c.get('person')?.sub), ...b });
      return c.body(null, 204);
    },
  );
  return r;
}
