/** Holiday calendars of a region (feature holiday-regions, ADR 0039): the verified offer, and subscribing and unsubscribing in the person's Google list. */
import type { HolidayRegion } from '@calendar/shared/api';
import { notFound, validation } from '../lib/errors.js';
import { ProviderError, type CalendarProvider, type ProviderCalendar } from '../providers/CalendarProvider.js';
import {
  HOLIDAY_REGIONS, HOLIDAY_VARIANTS, holidayCalendarId, holidayLang, isHolidayCalendarId, parseHolidayCalendarId,
} from '../providers/holidayRegions.js';

/** How long a checked id is trusted: Google's holiday calendars hardly ever appear or vanish. */
const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000;
const CHECKS_AT_ONCE = 6;
/** Public calendars are the same for everyone, so one answer serves every person of the process. */
const verified = new Map<string, { at: number; exists: boolean }>();

export class HolidayCalendars {
  constructor(
    private readonly provider: CalendarProvider,
    private readonly now: () => number,
    private readonly listCalendars: () => Promise<ProviderCalendar[]>,
    private readonly dropCalendars: () => void,
  ) {}

  /** Whether Google has the calendar; a failed check is not kept, so an outage does not hide a region for a day. */
  private async exists(id: string): Promise<boolean> {
    const known = verified.get(id);
    if (known && this.now() - known.at < VERIFIED_TTL_MS) return known.exists;
    const exists = await this.provider.publicCalendarExists(id);
    verified.set(id, { at: this.now(), exists });
    return exists;
  }

  /** Runs the checks `CHECKS_AT_ONCE` at a time; the first failure ends the call. */
  private async existing(ids: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    let next = 0;
    let failed = false;
    const worker = async (): Promise<void> => {
      // after a failure the other workers stop, so an outage does not keep spending Google quota
      for (let i = next++; i < ids.length && !failed; i = next++) {
        try {
          if (await this.exists(ids[i]!)) found.add(ids[i]!);
        } catch (e) {
          failed = true;
          throw e;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CHECKS_AT_ONCE, ids.length) }, worker));
    return found;
  }

  /** The countries with at least one existing calendar in the language, and which variants the person already has. */
  async regions(langParam: unknown): Promise<HolidayRegion[]> {
    const lang = holidayLang(langParam);
    const codes = Object.keys(HOLIDAY_REGIONS);
    const ids = codes.flatMap((code) => HOLIDAY_VARIANTS.map((v) => holidayCalendarId(code, lang, v)));
    const [found, list] = await Promise.all([this.existing(ids), this.listCalendars()]);
    const have = list.map((c) => parseHolidayCalendarId(c.id)).filter((p) => p !== null);
    return codes
      .map((code) => ({
        code,
        variants: HOLIDAY_VARIANTS.filter((v) => found.has(holidayCalendarId(code, lang, v))),
        added: HOLIDAY_VARIANTS.filter((v) => have.some((p) => p.code === code && p.variant === v)),
      }))
      .filter((r) => r.variants.length > 0);
  }

  /** Adds the region's calendar to the person's list; `created` is false when they had that region and variant already. */
  async add(code: unknown, variant: unknown, langParam: unknown): Promise<{ calendar: ProviderCalendar; created: boolean }> {
    if (typeof code !== 'string' || !(code in HOLIDAY_REGIONS)) throw validation('code is not a known region', 'code');
    if (variant !== 'official' && variant !== 'all') throw validation('variant must be official or all', 'variant');
    const list = await this.listCalendars();
    const have = list.find((c) => { const p = parseHolidayCalendarId(c.id); return p?.code === code && p.variant === variant; });
    if (have) return { calendar: have, created: false };
    const id = holidayCalendarId(code, holidayLang(langParam), variant);
    if (!(await this.exists(id))) throw notFound('Holiday calendar not found');
    try {
      const calendar = await this.provider.subscribeCalendar(id);
      this.dropCalendars();
      return { calendar, created: true };
    } catch (e) {
      // another device added it a moment ago (Google 409): the person has it, which is what they asked for
      if (!(e instanceof ProviderError)) throw e;
      this.dropCalendars();
      const now = (await this.listCalendars()).find((c) => c.id === id);
      if (!now) throw e;
      return { calendar: now, created: false };
    }
  }

  /** Removes a holiday calendar from the person's list; nothing else can be removed here. */
  async remove(id: string): Promise<void> {
    if (!isHolidayCalendarId(id) || !(await this.listCalendars()).some((c) => c.id === id)) throw notFound('Holiday calendar not found');
    await this.provider.unsubscribeCalendar(id);
    this.dropCalendars();
  }
}

/** Forgets every checked id (test reset). */
export function forgetVerifiedHolidays(): void {
  verified.clear();
}
