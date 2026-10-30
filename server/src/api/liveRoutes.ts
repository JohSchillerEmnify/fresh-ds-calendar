/**
 * `GET /api/events/stream` (ADR 0030): one Server-Sent Events connection per open app. The only event is the content-free
 * `changed` nudge (the data is just the kind of what changed); the app answers it with `GET /api/changes`.
 */
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { streamSSE, type SSEStreamingApi } from 'hono/streaming';
import type { Ctx } from '../context.js';
import { SESSION_COOKIE } from '../auth/sessions.js';
import { ApiException } from '../lib/errors.js';
import { LOCAL_PERSON } from '../services/prefsStore.js';

/** A comment line this often keeps proxies from closing an idle stream. */
export const HEARTBEAT_MS = 25_000;

export function liveRoutes(ctx: Ctx): Hono {
  const r = new Hono();
  r.get('/events/stream', (c) => {
    const person = c.get('person' as never) as { sub: string } | undefined;
    const sub = ctx.auth.on ? person?.sub : LOCAL_PERSON;
    if (!sub) throw new ApiException('UNAUTHENTICATED', 401, 'Sign in required');
    const session = ctx.auth.on ? getCookie(c, SESSION_COOKIE) ?? null : null;
    c.header('X-Accel-Buffering', 'no');
    let finish!: () => void;
    const ended = new Promise<void>((resolve) => { finish = resolve; });
    let stream: SSEStreamingApi | null = null;
    const remove = ctx.live.add({
      sub, session,
      send: (kind) => { void stream?.writeSSE({ event: 'changed', data: kind }).catch(finish); },
      close: finish,
    });
    // at the limit the browser gets a refusal and stops retrying; its poll still syncs
    if (!remove) throw new ApiException('RATE_LIMITED', 429, 'Too many open streams');
    return streamSSE(c, async (s) => {
      stream = s;
      s.onAbort(finish);
      let open = true;
      void ended.then(() => { open = false; remove(); });
      // the first comment flushes the headers, so the browser's `open` fires at once
      await s.write('retry: 1000\n: connected\n\n');
      while (open) {
        await Promise.race([ended, s.sleep(HEARTBEAT_MS)]);
        if (open) await s.write(': keep-alive\n\n');
      }
    });
  });
  return r;
}
