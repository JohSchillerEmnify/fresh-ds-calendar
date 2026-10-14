/** Web Push endpoints (API.md "Web Push"): the VAPID key, a browser's subscription, and the reminder plan sent for it. */
import { Hono, type Context } from 'hono';
import type { Ctx } from '../context.js';
import { ApiException } from '../lib/errors.js';
import { parse, pushSubscribeSchema, pushUnsubscribeSchema, reminderPlanSchema } from '../lib/validation.js';
import { LOCAL_PERSON } from '../services/prefsStore.js';

/** Registers `/push/*` and `PUT /reminders/plan` for the signed-in person (`local` while sign-in is off). */
export function pushRoutes(ctx: Ctx): Hono {
  const r = new Hono();
  const person = (c: Context): string => (ctx.auth.on ? (c.get('person') as { sub: string } | undefined)?.sub : undefined) ?? LOCAL_PERSON;
  const body = async (c: Context): Promise<unknown> => { try { return await c.req.json(); } catch { return undefined; } };

  r.get('/push/key', (c) => c.json({ key: ctx.push.publicKey }));
  r.post('/push/subscriptions', async (c) => {
    if (!ctx.push.subscribe(person(c), parse(pushSubscribeSchema, await body(c)))) throw new ApiException('VALIDATION_ERROR', 400, 'Too many subscribed browsers');
    return c.body(null, 204);
  });
  r.delete('/push/subscriptions', async (c) => {
    ctx.push.unsubscribe(person(c), parse(pushUnsubscribeSchema, await body(c)).endpoint);
    return c.body(null, 204);
  });
  r.put('/reminders/plan', async (c) => {
    const b = parse(reminderPlanSchema, await body(c));
    if (!ctx.push.setPlan(person(c), b.endpoint, b.plan)) throw new ApiException('NOT_FOUND', 404, 'This browser is not subscribed');
    return c.body(null, 204);
  });
  return r;
}
