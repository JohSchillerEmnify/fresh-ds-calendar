import { Hono } from 'hono';
import type { Ctx } from '../context.js';
import { ApiException, validation } from '../lib/errors.js';

/** Google OAuth routes. Only active for PROVIDER=google; the Google libraries are imported lazily. */
export function authRoutes(ctx: Ctx): Hono {
  const r = new Hono();
  const nf = () => new ApiException('NOT_FOUND', 404, 'Not found');

  r.get('/auth/google/start', async (c) => {
    if (ctx.config.provider !== 'google') throw nf();
    const auth = await import('../providers/google/auth.js');
    if (auth.hasStoredToken(ctx.config) && c.req.query('force') !== 'true') throw nf();
    return c.redirect(auth.startUrl(ctx.config), 302);
  });

  r.get('/auth/google/callback', async (c) => {
    if (ctx.config.provider !== 'google') throw nf();
    const auth = await import('../providers/google/auth.js');
    const code = c.req.query('code');
    const state = c.req.query('state');
    if (!code || !state || !auth.consumeState(state)) throw validation('Invalid state');
    await auth.exchangeAndStore(ctx.config, code);
    return c.redirect('/', 302);
  });

  return r;
}
