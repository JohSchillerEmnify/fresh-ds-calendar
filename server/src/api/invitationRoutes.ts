import type { Ctx } from '../context.js';
import type { InvitationsAnswer } from './types.js';
import { logEvent } from '../lib/diag.js';
import { ApiException, notFound } from '../lib/errors.js';
import { formatInZone } from '../lib/time.js';
import { CalendarPermissionMissingError, ProviderUnavailableError, ReauthRequiredError } from '../providers/CalendarProvider.js';
import type { Invitation } from '../services/invitations.js';
import type { RouteDeps } from './routeHelpers.js';

/** What the person's own invitations look like: those waiting for their address, and those they sent. Nothing of anybody else. */
export function invitationsOf(ctx: Ctx, sub: string): InvitationsAnswer {
  const at = (i: Invitation) => formatInZone(i.expires, ctx.config.tz);
  const mine = ctx.people.get(sub)?.email;
  // an invitation of somebody who may no longer use the calendar is not shown
  const waiting = mine && ctx.shared.permitted(sub) ? ctx.shared.invitations.incoming(mine).filter((i) => ctx.shared.permitted(i.owner)) : [];
  const owners = new Map(waiting.map((i) => [i.owner, ctx.people.get(i.owner)?.email]));
  return {
    invitations: waiting.filter((i) => owners.get(i.owner)).map((i) => ({ id: i.id, kind: i.kind, title: i.title, from: owners.get(i.owner)!, expires: at(i) })),
    sent: ctx.shared.invitations.sent(sub).map((i) => ({ id: i.id, kind: i.kind, target: i.target, address: i.address, expires: at(i) })),
  };
}

/** Lets the devices of the invited person look again; says nothing when nobody uses the address (and nothing reaches the sender either way). */
export function tellInvitee(ctx: Ctx, address: string): void {
  const p = ctx.shared.personAt(address.trim().toLowerCase());
  if (p) ctx.changes.emit([p.sub], 'shares');
}

/** Registers the invitations: the person's own, and answering or withdrawing one (feature shared-lists, ADR 0047). */
export function registerInvitations({ r, ctx, person }: RouteDeps): void {
  const store = ctx.shared.invitations;
  /** The invitation addressed to this person; anybody else, a declined or an unknown one is a 404. */
  const addressedTo = (sub: string, id: string): Invitation => {
    const mine = ctx.people.get(sub)?.email;
    const inv = store.get(id);
    if (!inv || inv.declined || !mine || inv.address !== mine || !ctx.shared.permitted(sub) || !ctx.shared.permitted(inv.owner)) throw notFound('Invitation not found');
    return inv;
  };
  r.get('/invitations', (c) => c.json(invitationsOf(ctx, person(c))));
  r.post('/invitations/:id/accept', async (c) => {
    const me = person(c);
    const inv = addressedTo(me, c.req.param('id'));
    const owner = ctx.calendarFor(inv.owner);
    try {
      const listId = inv.kind === 'list' ? await owner.grantList(inv.target, me) : (await owner.grantCategory(inv.target, me), null);
      // the sharer withdrew while the move ran: the person leaves again
      if (!store.get(inv.id)) {
        if (inv.kind === 'list') await owner.revokeList(listId!, me);
        else await owner.shareCategory(inv.target, null);
        throw notFound('Invitation not found');
      }
      store.remove(inv.id);
      logEvent('invitation_answered', { action: 'accepted', kind: inv.kind });
      ctx.changes.emit([me, inv.owner], 'taskLists');
      ctx.changes.emit([me, inv.owner], 'shares');
      return c.json({ listId });
    } catch (e) {
      // the list or category is gone, or began to repeat: the invitation is of no use any more
      if (e instanceof ApiException && (e.status === 404 || e.key === 'sharing.repeating')) {
        store.remove(inv.id);
        throw notFound('Invitation not found');
      }
      // the sharer's Google is not the invited person's: say "later", never "sign in again"
      if (e instanceof ReauthRequiredError || e instanceof CalendarPermissionMissingError || e instanceof ProviderUnavailableError) {
        throw new ApiException('PROVIDER_UNAVAILABLE', 503, 'The invitation could not be accepted right now. Try again later.', undefined, 'sharing.invite.acceptLater');
      }
      throw e;
    }
  });
  r.post('/invitations/:id/decline', (c) => {
    const me = person(c);
    const inv = addressedTo(me, c.req.param('id'));
    store.decline(inv.id);
    logEvent('invitation_answered', { action: 'declined', kind: inv.kind });
    ctx.changes.emit([me], 'shares');
    return c.json({ ok: true });
  });
  r.post('/invitations/:id/withdraw', (c) => {
    const me = person(c);
    const inv = store.get(c.req.param('id'));
    if (!inv || inv.owner !== me) throw notFound('Invitation not found');
    store.remove(inv.id);
    logEvent('invitation_answered', { action: 'withdrawn', kind: inv.kind });
    ctx.changes.emit([me], 'shares');
    tellInvitee(ctx, inv.address);
    return c.json({ ok: true });
  });
}
