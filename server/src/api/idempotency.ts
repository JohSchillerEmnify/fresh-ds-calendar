/** Outbox write middleware (ADR 0031): `Idempotency-Key` replay and the refuse-next-write test hook. */
import type { Context, MiddlewareHandler } from 'hono';
import type { Ctx } from '../context.js';
import { ApiException } from '../lib/errors.js';
import type { AuthEnv } from '../auth/middleware.js';

const IDEMPOTENCY_TTL_MS = 24 * 3600 * 1000;
const MAX_KEY_LENGTH = 64;
const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

interface Answer { status: number; body: string; type: string | null }
interface Entry { signature: string; at: number; answer: Promise<Answer | null> }

/** True for an event or task list write. */
function isOutboxWrite(c: Context): boolean {
  return !READ_ONLY.has(c.req.method) && /^\/api\/(events|tasklists)(\/|$)/.test(c.req.path);
}

/** Test hook: the next event or task list write is refused. */
export function refuseNextWrite(ctx: Ctx): MiddlewareHandler {
  return async (c, next) => {
    const status = ctx.overrides.refuseNextWrite;
    if (status === undefined || !isOutboxWrite(c)) return next();
    ctx.overrides.refuseNextWrite = undefined;
    if (status === 404) throw new ApiException('NOT_FOUND', 404, 'Not found');
    throw new ApiException('VALIDATION_ERROR', 400, 'The server refused this change');
  };
}

/** Keeps the answer of a successful write, or forgets the key so a failed write's resend runs again. */
async function settleAnswer(c: Context, seen: Map<string, Entry>, id: string, settle: (a: Answer | null) => void): Promise<void> {
  if (c.res.status >= 200 && c.res.status < 300) {
    settle({ status: c.res.status, body: await c.res.clone().text(), type: c.res.headers.get('content-type') });
  } else {
    seen.delete(id);
    settle(null);
  }
}

/** Replays the first answer of a write with an `Idempotency-Key`, per person for 24 hours (successes only). */
export function idempotency(ctx: Ctx): MiddlewareHandler<AuthEnv> {
  const seen = new Map<string, Entry>();
  return async (c, next) => {
    const key = c.req.header('Idempotency-Key');
    if (key === undefined || READ_ONLY.has(c.req.method)) return next();
    if (key === '' || key.length > MAX_KEY_LENGTH) throw new ApiException('VALIDATION_ERROR', 400, `Idempotency-Key must be 1 to ${MAX_KEY_LENGTH} characters`);

    // expired keys go so the map stays small
    const now = ctx.clock.now().getTime();
    for (const [k, e] of seen) if (now - e.at > IDEMPOTENCY_TTL_MS) seen.delete(k);

    const id = `${c.get('person')?.sub ?? ''}\n${key}`;
    const signature = `${c.req.method} ${c.req.path}`;
    const hit = seen.get(id);
    if (hit) {
      if (hit.signature !== signature) throw new ApiException('IDEMPOTENCY_KEY_REUSED', 422, 'This Idempotency-Key was used for another request');
      // an equal request still running is awaited; a failed first try runs again
      const answer = await hit.answer;
      if (answer) return new Response(answer.body || null, { status: answer.status, headers: answer.type ? { 'content-type': answer.type } : {} });
    }

    let settle!: (a: Answer | null) => void;
    seen.set(id, { signature, at: now, answer: new Promise((r) => { settle = r; }) });
    await next();
    await settleAnswer(c, seen, id, settle);
  };
}
