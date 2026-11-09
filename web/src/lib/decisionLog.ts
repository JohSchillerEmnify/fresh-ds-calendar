/** Device-log entries for what the app decided on its own against what the person did (feature device-log): no ids, no names. */
import { ApiError } from '@/api/client';
import { errorFacts, logDevice } from './deviceLog';

/** Logs that an optimistic change of kind `what` (for example "calendar colour") was put back after a failed save. */
export function logUndone(what: string, err: unknown): void {
  const facts = err instanceof ApiError ? { ...err.seen, status: err.status, code: err.code } : errorFacts(err);
  logDevice('decision', { what, decision: 'rolled back', ...facts });
}

/** Logs that a sync answer replaced a calendar setting this device changed `agoS` seconds ago. */
export function logReplaced(setting: string, agoS: number): void {
  logDevice('decision', { what: 'sync', decision: `replaced ${setting} set on this device ${agoS} s ago`, setting, agoS });
}
