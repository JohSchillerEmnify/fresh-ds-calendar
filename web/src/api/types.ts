import type { ConfigResponse, DateTime, HealthResponse, LocalDate, SummaryDay } from '@calendar/shared/api';
import type { SupportCat } from '@calendar/shared/prefs';

/** REST contract types (spec/API.md) live in `shared/api.d.ts`; this file re-exports them plus the web-only ones below. */
export type * from '@calendar/shared/api';
export type * from '@calendar/shared/prefs';
/** How often the emotional support cat comes by (per person, `GET/PATCH /api/prefs`). */
export type SupportCatSetting = SupportCat;


/** `GET /api/backup` (API.md "Backups"). */
export interface BackupStatus {
  available: boolean;
  permission: 'granted' | 'missing';
  state: 'off' | 'never' | 'ok' | 'failed';
  lastBackupAt: DateTime | null;
  error: string | null;
  keep: number;
}

/** `/api/auth/me`: both null while sign-in is off. */
export interface Me {
  email: string | null;
  name: string | null;
}

/** Which occurrences of a repeating task list a change is for (feature tasklist-repeating): the shown one, or it and all later ones. */
export type ChangeScope = 'this' | 'following';

export type Health = HealthResponse;

export interface AppConfig extends ConfigResponse {
  /** The APK the server offers (`scripts/android-build.sh`), or null. */
  apk: { versionCode: number; versionName: string; certSha256?: string } | null;
  /** Names of the optional plugins this deployment turned on (ADR 0004), e.g. `door`. */
  plugins: string[];
  /** The place search (Photon) the device asks directly for location suggestions (feature event-location). */
  placeSearchUrl: string;
  /** The map picture template with `{z}`, `{x}`, `{y}` (OpenStreetMap tiles). */
  mapTileUrl: string;
}

/** One plain-English line of CHANGELOG.md (`GET /api/release-notes`). */
export interface ReleaseNote {
  id: string;
  date: string;
  text: string;
}

export type DaySummary = SummaryDay;
export interface SummaryResponse {
  days: Record<LocalDate, DaySummary>;
}
