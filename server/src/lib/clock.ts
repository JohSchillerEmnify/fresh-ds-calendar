/**
 * The app clock. Every "now" in the server goes through a Clock instance (no scattered Date.now()).
 * - `now()`  : app "now", honours the test clock (frozen or running from a set instant).
 * - `real()` : wall clock, used for `updated` timestamps, etags and timers (API.md: the test clock affects only "now").
 */
export class Clock {
  private override: { at: number; frozen: boolean; setAtReal: number } | null = null;

  constructor(private readonly realNow: () => number = () => Date.now()) {}

  real(): number {
    return this.realNow();
  }

  nowMs(): number {
    const o = this.override;
    if (!o) return this.realNow();
    return o.frozen ? o.at : o.at + (this.realNow() - o.setAtReal);
  }

  now(): Date {
    return new Date(this.nowMs());
  }

  /** `null` clears the override. */
  set(at: number | null, frozen = true): void {
    this.override = at === null ? null : { at, frozen, setAtReal: this.realNow() };
  }

  get isSet(): boolean {
    return this.override !== null;
  }

  get frozen(): boolean {
    return this.override?.frozen ?? false;
  }
}
