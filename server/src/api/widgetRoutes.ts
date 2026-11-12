/** Widget keys (session, Settings) and the two routes a key opens, `/widget/data` and `/widget/script` (ADR 0044). */
import { createHash } from 'node:crypto';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { Ctx } from '../context.js';
import { localDateOf, formatInZone } from '../lib/time.js';
import { parse, widgetKeySchema } from '../lib/validation.js';
import { timelineDays } from '@calendar/shared/prefs';
import { readWidgetScript } from '../services/widgetScript.js';
import { body, range, readItems, type RouteDeps } from './routeHelpers.js';

const MAX_RANGE_DAYS = 14;
const PER_MINUTE = 30;
/** Clients share this many buckets, so wrong-key guessing from many addresses cannot grow the limiter's memory. */
const CLIENT_BUCKETS = 4096;

/** The caller: the address the trusted proxy (Caddy, Traefik) appended last to X-Forwarded-For, else the socket's. */
function clientOf(c: Context): string {
  const hops = (c.req.header('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  let who = hops.at(-1);
  if (!who) {
    try { who = getConnInfo(c).remote.address; } catch { /* no socket (tests) */ }
  }
  return String(createHash('sha256').update(who ?? 'direct').digest().readUInt16BE(0) % CLIENT_BUCKETS);
}

/** Registers `POST/GET/DELETE /api/widget-keys` for the signed-in person. */
export function registerWidgetKeys({ r, ctx, person }: RouteDeps): void {
  r.post('/widget-keys', async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(ctx.widgetKeys.create(person(c), parse(widgetKeySchema, await body(c)).name), 201);
  });
  r.get('/widget-keys', (c) => c.json(ctx.widgetKeys.list(person(c))));
  r.delete('/widget-keys/:id', (c) => {
    ctx.widgetKeys.revoke(person(c), c.req.param('id'));
    return c.body(null, 204);
  });
}

/** The routes a widget key opens; mounted before the session middleware, so a session cookie is never read here. */
export function widgetRoutes(ctx: Ctx): Hono {
  const r = new Hono<{ Variables: { widgetSub: string } }>();
  const perKey = new RateLimiterMemory({ points: PER_MINUTE, duration: 60 });
  // a wrong key is limited per client, so guessing cannot run at full speed
  const perClient = new RateLimiterMemory({ points: PER_MINUTE, duration: 60 });
  const tooMany = (c: Context, res: { msBeforeNext: number }) =>
    c.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429, { 'Retry-After': String(Math.ceil(res.msBeforeNext / 1000)) });

  const gate: MiddlewareHandler = async (c, next) => {
    const client = clientOf(c);
    const bearer = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    let who: { sub: string; id: string };
    try {
      who = ctx.widgetKeys.authenticate(bearer);
    } catch (e) {
      const over = await perClient.consume(client).then(() => null, (res: { msBeforeNext: number }) => res);
      if (over) return tooMany(c, over);
      throw e;
    }
    const over = await perKey.consume(who.id).then(() => null, (res: { msBeforeNext: number }) => res);
    if (over) return tooMany(c, over);
    c.set('widgetSub', who.sub);
    c.header('Cache-Control', 'no-store');
    return next();
  };
  r.use('/widget/data', gate);
  r.use('/widget/script', gate);

  r.get('/widget/script', (c) => c.body(readWidgetScript(ctx.config.widgetScriptPath).text, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }));

  r.get('/widget/data', async (c) => {
    const sub = c.get('widgetSub');
    const { from, to } = range(c, MAX_RANGE_DAYS);
    const cal = ctx.calendarFor(sub);
    // excludeHidden is forced on: the key cannot turn the one visibility rule off
    const { items } = await readItems(ctx, sub, cal, from, to, { excludeHidden: true });
    const now = ctx.clock.nowMs();
    const p = ctx.prefs.labsPrefs(sub);
    return c.json({
      generatedAt: formatInZone(now, ctx.config.tz), today: localDateOf(now, ctx.config.tz), scriptVersion: readWidgetScript(ctx.config.widgetScriptPath).version,
      items, minEventMinutes: p.minEventMinutes, weekSideBySide: p.weekSideBySide, taskCategories: p.taskCategories, widgetCircle: p.widgetCircle, widgetLayout: p.widgetLayout, widgetTimelineDays: timelineDays(p), widgetTimelineTextSize: p.widgetTimelineTextSize, widgetTimelineHours: p.widgetTimelineHours, language: p.language,
    });
  });
  // the typed variable of this router is its own business
  return r as unknown as Hono;
}
