/**
 * Calendar backends live here (see spec/ARCHITECTURE.md):
 * - MockGoogleProvider: emulates Google Calendar API v3, persists JSON in DATA_DIR.
 * - GoogleProvider: `@googleapis/calendar` + `google-auth-library` (never the full `googleapis`).
 * Selected by PROVIDER=mock|google via loadConfig().
 */
export type ProviderKind = 'mock' | 'google';
