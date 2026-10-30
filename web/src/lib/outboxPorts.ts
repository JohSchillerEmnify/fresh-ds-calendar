/** What the outbox needs from the stores that show and keep the data; they register here, so the outbox imports none of them. */
import type { CalendarItem } from '@/api/types';

/** The screen's copy of events and lists (the items store). */
interface ItemsPort {
  get(id: string): CalendarItem | undefined;
  /** Every cached item. */
  all(): CalendarItem[];
  upsert(item: CalendarItem): void;
  remove(id: string): void;
  hide(id: string): void;
  unhide(item: CalendarItem): void;
  beginPending(id: string): void;
  endPending(id: string): void;
  noteSeries(firstId: string, seriesId: string): void;
  seriesOf(id: string): string | undefined;
  forgetSeries(id: string): void;
}

/** The device copy (the device store). */
interface DevicePort {
  person(): string | null;
  find(id: string): CalendarItem | undefined;
  put(item: CalendarItem): void;
  drop(id: string, calendarId?: string): void;
}

export interface OutboxPorts {
  items?: ItemsPort;
  device?: DevicePort;
  /** Takes the server's state in again (the live sync of ADR 0030 tells the other apps). */
  resync?: () => void;
}

export const ports: OutboxPorts = {};
