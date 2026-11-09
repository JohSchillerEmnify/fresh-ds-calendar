/** Types of the time zone helpers in `zone.js`. */

/** The wall-clock fields of an instant in a zone. */
export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}
/** The wall-clock fields of the instant `ms` in `tz`. */
export declare function zonedParts(ms: number, tz: string): ZonedParts;
/** Offset of the zone from UTC at the instant, in minutes east of UTC. */
export declare function offsetMinutes(ms: number, tz: string): number;
