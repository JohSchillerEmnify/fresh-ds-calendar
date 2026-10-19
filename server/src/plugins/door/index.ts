/**
 * Door plugin (spec/features/door-board.feature, ADR 0003/0004): `GET /api/door` for one machine client — the e-ink
 * board inside the front door — authenticated by its own bearer key and bound to one person. Off unless
 * `DOOR_API_TOKEN` is set (a TEST_MODE override can set or take the key away at runtime).
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type { Ctx } from '../../context.js';
import { ApiException } from '../../lib/errors.js';
import { mockSub } from '../../auth/people.js';
import { LOCAL_PERSON } from '../../services/prefsStore.js';
import { doorAnswer } from './service.js';

/** Requests per minute one client may make before it is told to slow down. */
const RATE_PER_MINUTE = 60;

/** The key and person in force: the test override wins over the config; null means no door. */
export function doorConfig(ctx: Ctx): { token: string; person: string } | null {
  if (ctx.overrides.door !== undefined) return ctx.overrides.door;
  const { token, person } = ctx.config.door;
  return token ? { token, person: person ?? '' } : null;
}

/** Constant-time comparison of the presented key with the configured one (hashed first, so lengths never leak). */
function keyMatches(presented: string | undefined, token: string): boolean {
  if (!presented) return false;
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(token).digest();
  return timingSafeEqual(a, b);
}

/** The calendar and prefs key of the door's person; null when that person is unknown to this server. */
function personOf(ctx: Ctx, email: string): { sub: string | null; prefsKey: string } | null {
  if (!ctx.auth.on) return { sub: null, prefsKey: LOCAL_PERSON };
  const sub = ctx.mock ? mockSub(email) : ctx.people.all().find((p) => p.email === email.toLowerCase())?.sub ?? null;
  return sub ? { sub, prefsKey: sub } : null;
}

export const doorPlugin = {
  name: 'door',
  enabled: (ctx: Ctx) => doorConfig(ctx) !== null,
  routes(ctx: Ctx): Hono {
    const r = new Hono();
    const hits = new Map<string, { minute: number; n: number }>();
    const limit = (c: Context) => {
      const who = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      const minute = Math.floor(ctx.clock.real() / 60_000);
      const h = hits.get(who);
      const n = h && h.minute === minute ? h.n + 1 : 1;
      hits.set(who, { minute, n });
      if (hits.size > 1000) hits.clear(); // a bounded memory for a one-client endpoint
      if (n > RATE_PER_MINUTE) throw new ApiException('RATE_LIMITED', 429, 'Too many requests');
    };
    r.get('/', async (c) => {
      const door = doorConfig(ctx)!;
      limit(c);
      const auth = c.req.header('authorization') ?? '';
      const presented = auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
      if (!keyMatches(presented, door.token)) throw new ApiException('UNAUTHENTICATED', 401, 'A valid door key is required');
      const person = personOf(ctx, door.person);
      if (!person) throw new ApiException('PROVIDER_UNAVAILABLE', 503, 'The door\'s person has not signed in to this calendar yet');
      const today = ctx.motivation.today();
      return c.json(await doorAnswer(ctx.calendarFor(person.sub), new Set(ctx.prefs.hiddenCalendars(person.prefsKey)), today));
    });
    return r;
  },
};
