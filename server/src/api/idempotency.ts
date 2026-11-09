/** Outbox write middleware (ADR 0031): `Idempotency-Key` replay and the refuse-next-write test hook. */
import type { Context, MiddlewareHandler } from 'hono';
import type { Ctx } from '../context.js';
import { ApiException } from '../lib/errors.js';
import type { AuthEnv } from '../auth/middleware.js';
import { LOCAL_PERSON } from '../services/prefsStore.js';

const MAX_KEY_LENGTH = 64;
const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

interface Answer { status: number; body: string; type: string | null }
interface Running { signature: string; answer: Promise<Answer | null> }

/** True for an event or task list write. */
function isOutboxWrite(c: Context): boolean {
  return !READ_ONLY.has(c.req.method) && /^\/api\/(events|tasklists|calendars)(\/|$)/.test(c.req.path);
}

/** Test hook: the next event, task list or calendar write is refused. */
export function refuseNextWrite(ctx: Ctx): MiddlewareHandler {
  return async (c, next) => {
    const status = ctx.overrides.refuseNextWrite;
    if (status === undefined || !isOutboxWrite(c)) return next();
    ctx.overrides.refuseNextWrite = undefined;
    if (status === 404) throw new ApiException('NOT_FOUND', 404, 'Not found');
    throw new ApiException('VALIDATION_ERROR', 400, 'The server refused this change');
  };
}

const replay = (a: Answer) => new Response(a.body || null, { status: a.status, headers: a.type ? { 'content-type': a.type } : {} });

/** Replays the first answer of a write with an `Idempotency-Key` (per person, 24 h, durable, successes only); equal requests at once share one run. */
export function idempotency(ctx: Ctx): MiddlewareHandler<AuthEnv> {
  const running = new Map<string, Running>();
  return async (c, next) => {
    const key = c.req.header('Idempotency-Key');
    if (key === undefined || READ_ONLY.has(c.req.method)) return next();
    if (key === '' || key.length > MAX_KEY_LENGTH) throw new ApiException('VALIDATION_ERROR', 400, `Idempotency-Key must be 1 to ${MAX_KEY_LENGTH} characters`);

    const sub = c.get('person')?.sub ?? LOCAL_PERSON;
    const now = ctx.clock.now().getTime();
    const signature = `${c.req.method} ${c.req.path}`;
    const reused = () => new ApiException('IDEMPOTENCY_KEY_REUSED', 422, 'This Idempotency-Key was used for another request');
    const stored = ctx.idempotency.get(sub, key, now);
    if (stored) {
      if (stored.signature !== signature) throw reused();
      return replay(stored);
    }
    const id = `${sub}\n${key}`;
    const hit = running.get(id);
    if (hit) {
      if (hit.signature !== signature) throw reused();
      // an equal request still running is awaited; a failed first try runs again
      const answer = await hit.answer;
      if (answer) return replay(answer);
    }

    let settle!: (a: Answer | null) => void;
    running.set(id, { signature, answer: new Promise((r) => { settle = r; }) });
    await next();
    running.delete(id);
    if (c.res.status >= 200 && c.res.status < 300) {
      const answer = { status: c.res.status, body: await c.res.clone().text(), type: c.res.headers.get('content-type') };
      ctx.idempotency.put(sub, key, { ...answer, signature, at: now }, now);
      settle(answer);
    } else settle(null);
  };
}
