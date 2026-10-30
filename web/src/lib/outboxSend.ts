/** How an outbox entry becomes a request, and which answers are worth a resend (ADR 0031). */
import { api, ApiError, type RequestOptions } from '@/api/client';
import type { CalendarItem } from '@/api/types';
import type { Change, OutboxEntry } from './outbox';

/** Nothing the server could have decided differently on a resend: the network, Google, the session, a rate limit. */
export const retriable = (e: ApiError): boolean => e.isUnavailable || e.status === 0 || e.status >= 500 || e.status === 401 || e.status === 408 || e.status === 429;
/** Whether the entry carries the version it was based on. */
export const versioned = (c: Change): boolean => c.op === 'event.update' || c.op === 'event.delete' || (c.op === 'list.update' && c.scope !== 'following') || c.op === 'list.delete';
export const isEvent = (c: Change): boolean => c.op.startsWith('event.');
export const isCreate = (c: Change): boolean => c.op === 'event.create' || c.op === 'list.create';
export const isDelete = (c: Change): boolean => c.op === 'event.delete' || c.op === 'list.delete' || c.op === 'item.delete';

/** The request of an entry. */
export function perform(e: OutboxEntry): Promise<unknown> {
  const c = e.change;
  const o: RequestOptions = { idempotencyKey: e.key, ...(e.etag ? { ifMatch: e.etag } : {}) };
  const plain: RequestOptions = { idempotencyKey: e.key };
  switch (c.op) {
    case 'event.create': return api.createEvent(c.input, o);
    case 'event.update': return api.updateEvent(c.id, c.patch, o);
    case 'event.delete': return api.deleteEvent(c.id, o);
    case 'list.create': return api.createTaskList(c.input, o);
    case 'list.update': return api.updateTaskList(c.id, c.patch, c.scope === 'following' ? plain : o, c.scope);
    case 'list.delete': {
      // a repeating list deleted right after it was created goes as a whole: no If-Match, the etag is its first week's
      const series = e.series;
      return series ? api.deleteTaskList(series, plain) : api.deleteTaskList(c.id, o);
    }
    case 'item.add': return api.addTaskItem(c.id, { id: c.itemId, ...(c.strokes ? { strokes: c.strokes } : { title: c.title }) }, plain, c.scope);
    case 'item.ink': return api.putItemInk(c.id, c.itemId, { strokes: c.strokes, base: c.base, at: c.at }, plain);
    case 'item.patch': return api.updateTaskItem(c.id, c.itemId, c.patch, plain, c.scope);
    case 'item.delete': return api.deleteTaskItem(c.id, c.itemId, plain, c.scope);
    case 'item.order': return api.reorderTaskItems(c.id, c.itemIds, plain);
  }
}

/** The server's current version of what an entry changes. */
export const fetchCurrent = (c: Change): Promise<CalendarItem> => (isEvent(c) ? api.getEvent(c.id) : api.getTaskList(c.id));
