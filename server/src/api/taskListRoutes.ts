import type { InkStroke } from './types.js';
import { ApiException, notFound, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { isLocalDate } from '../lib/time.js';
import { mergeInk, visibleInk } from '@calendar/shared/ink';
import { INK_STROKES_MAX } from '@calendar/shared/limits';
import {
  addItemSchema, categoryShareSchema, createTaskListSchema, inkSchema, orderSchema, parse, patchItemSchema, shareSchema, updateTaskListSchema,
} from '../lib/validation.js';
import { isSharedId } from '../services/sharedLists.js';
import { body, scopeOf, type RouteDeps } from './routeHelpers.js';

/** How far ahead of the server's clock a device's stroke time may be (ms); beyond it the time is cut back. */
const INK_SKEW_MS = 5 * 60_000;
const inkIds = (l: { items: { id: string; ink?: true }[] }): string[] => l.items.filter((i) => i.ink).map((i) => i.id);

/** The list holds all the ink it may (decision Q3); the web app suggests a new list. */
const inkFull = () => new ApiException('PAYLOAD_TOO_LARGE', 413, 'This list is full of ink. Start a new list.', undefined, 'tasklist.inkFull');

/** Registers the task lists, their sharing and their handwritten items. */
export function registerTaskLists({ r, ctx, person, cal }: RouteDeps): void {
  r.get('/tasklists/open', async (c) => {
    const today = c.req.query('today') ?? ctx.motivation.today();
    if (!isLocalDate(today)) throw validation('today must be a date (YYYY-MM-DD)', 'today');
    const daysRaw = c.req.query('days');
    const days = daysRaw === undefined ? 30 : Number(daysRaw);
    if (!Number.isInteger(days) || days < 0 || days > 90) throw validation('days must be 0-90', 'days');
    return c.json(await cal(c).openTaskLists(today, days));
  });
  r.get('/tasklists/all-open', async (c) => {
    const today = c.req.query('today') ?? ctx.motivation.today();
    if (!isLocalDate(today)) throw validation('today must be a date (YYYY-MM-DD)', 'today');
    return c.json(await cal(c).allOpenTaskLists(today));
  });
  r.get('/tasklists/archive', async (c) => {
    const today = c.req.query('today') ?? ctx.motivation.today();
    if (!isLocalDate(today)) throw validation('today must be a date (YYYY-MM-DD)', 'today');
    return c.json(await cal(c).archivedTaskLists(today));
  });
  r.post('/tasklists', async (c) => {
    const input = parse(createTaskListSchema, await body(c));
    const kept = (input.items ?? []).filter((i) => i.title.trim() || i.strokes);
    if (!ctx.inks.fitsNew(kept.flatMap((i) => (i.strokes ? [i.strokes as InkStroke[]] : [])))) throw inkFull();
    const list = await cal(c).createTaskList(input);
    // ink items keep their strokes in the ink store, under the ids the list gave them (same order as the kept input)
    list.items.forEach((item, n) => { const s = kept[n]?.strokes; if (s) ctx.inks.set(person(c), list.id, item.id, s as InkStroke[]); });
    return c.json(list, 201);
  });
  r.get('/tasklists/:id', async (c) => c.json(await cal(c).getTaskList(c.req.param('id'))));
  r.patch('/tasklists/:id', async (c) => c.json(await cal(c).updateTaskList(c.req.param('id'), parse(updateTaskListSchema, await body(c)), c.req.header('If-Match'), scopeOf(c))));
  r.delete('/tasklists/:id', async (c) => {
    const before = await cal(c).getTaskList(c.req.param('id'));
    await cal(c).deleteTaskList(c.req.param('id'), c.req.header('If-Match'));
    if (!before.seriesId && !isSharedId(c.req.param('id'))) ctx.inks.remove(person(c), c.req.param('id'), inkIds(before));
    return c.body(null, 204);
  });
  // ---- sharing (feature shared-lists) ----
  r.get('/people', (c) => c.json({ people: ctx.shared.candidates(person(c)) }));
  r.post('/tasklists/:id/share', async (c) => c.json(await cal(c).shareTaskList(c.req.param('id'), parse(shareSchema, await body(c)).person)));
  r.delete('/tasklists/:id/share', async (c) => c.json(await cal(c).unshareTaskList(c.req.param('id'))));
  r.post('/tasklists/:id/leave', (c) => {
    cal(c).leaveTaskList(c.req.param('id'));
    return c.body(null, 204);
  });
  r.get('/categories/shares', (c) => c.json({ shares: ctx.shared.rulesOf(person(c)) }));
  r.put('/categories/:id/share', async (c) => c.json({ shares: await cal(c).shareCategory(c.req.param('id'), parse(categoryShareSchema, await body(c)).person) }));
  registerInkItems({ r, ctx, person, cal });
}

/** Registers the item routes, with the handwritten items whose strokes live in the ink store. */
function registerInkItems({ r, ctx, person, cal }: RouteDeps): void {
  // ---- handwritten items (feature handwritten-lists): the item is in the list, its strokes in the ink store ----
  r.get('/ink', (c) => c.json(ctx.inks.doc(person(c))));
  r.post('/tasklists/:id/items', async (c) => {
    const input = parse(addItemSchema, await body(c));
    const sub = person(c);
    const listId = c.req.param('id');
    if (input.strokes === undefined) {
      if (input.title === undefined) throw validation('Item title is required', 'title');
      return c.json(await cal(c).addItem(listId, { ...input, title: input.title }, scopeOf(c)), 201);
    }
    if (input.title !== undefined) throw validation('An ink item has no title', 'title');
    const itemId = input.id ?? nanoid();
    const strokes = input.strokes as InkStroke[];
    const before = await cal(c).getTaskList(listId);
    if (!ctx.inks.fits(sub, listId, inkIds(before), itemId, strokes)) throw inkFull();
    const list = await cal(c).addItem(listId, { ...input, id: itemId, title: '', ink: true }, scopeOf(c));
    // a repeated request finds the item already there: its ink is stored once, and only for an ink item
    if (list.items.find((i) => i.id === itemId)?.ink) ctx.inks.set(sub, listId, itemId, strokes);
    return c.json(list, 201);
  });
  r.put('/tasklists/:id/items/:itemId/ink', async (c) => {
    const { strokes: sent, base, at } = parse(inkSchema, await body(c));
    const sub = person(c);
    const [listId, itemId] = [c.req.param('id'), c.req.param('itemId')];
    const list = await cal(c).getTaskList(listId);
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw notFound('Item not found');
    if (!item.ink) throw validation('Only a handwritten item holds ink', 'itemId');
    // a change that says where it started from is merged with what other devices wrote meanwhile (decision G5)
    // the wall clock, as the devices' own clocks are (the app clock of a test can stand still)
    const nowMs = ctx.clock.real();
    // a stroke time far ahead of the server's clock would make the stroke survive every erase: it counts as at most a little ahead
    const drawn = (sent as InkStroke[]).map((s) => (s.t !== undefined && s.t > nowMs + INK_SKEW_MS ? { ...s, t: nowMs + INK_SKEW_MS } : s));
    const strokes = base ? mergeInk(ctx.inks.get(sub, listId, itemId), drawn, base, Math.min(at ?? nowMs, nowMs)) : drawn;
    // a merge can add to what the device saw: what one item holds stays within what a request may carry
    if (visibleInk(strokes).length > INK_STROKES_MAX || !ctx.inks.fits(sub, listId, inkIds(list), itemId, strokes)) throw inkFull();
    ctx.inks.set(sub, listId, itemId, strokes);
    // the answer carries what the item holds now: a merge may have added strokes the device has not seen
    return c.json({ ...(await cal(c).getTaskList(listId)), ink: { [itemId]: strokes } });
  });
  r.put('/tasklists/:id/items/order', async (c) => c.json(await cal(c).reorder(c.req.param('id'), parse(orderSchema, await body(c)).itemIds)));
  r.patch('/tasklists/:id/items/:itemId', async (c) => c.json(await cal(c).patchItem(c.req.param('id'), c.req.param('itemId'), parse(patchItemSchema, await body(c)), scopeOf(c))));
  r.delete('/tasklists/:id/items/:itemId', async (c) => {
    const [listId, itemId, scope] = [c.req.param('id'), c.req.param('itemId'), scopeOf(c)];
    const before = await cal(c).getTaskList(listId);
    const list = await cal(c).deleteItem(listId, itemId, scope);
    // one occurrence of a repeating list losing the item leaves it to the others (the ink is shared by item id)
    if (before.items.find((i) => i.id === itemId)?.ink && (scope === 'following' || !before.seriesId)) ctx.inks.remove(person(c), listId, [itemId]);
    return c.json(list);
  });
}
