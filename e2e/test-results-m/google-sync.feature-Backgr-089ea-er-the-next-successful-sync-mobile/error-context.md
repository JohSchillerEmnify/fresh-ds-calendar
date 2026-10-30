# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: google/sync.feature.spec.js >> Background sync with Google Calendar >> The banner disappears by itself after the next successful sync
- Location: .features-gen/google/sync.feature.spec.js:107:3

# Error details

```
Error: No automatic sync within 7000 ms
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [aria-hidden]:
      - generic:
        - generic [aria-hidden]:
          - generic [aria-hidden]:
            - img [aria-hidden]:
              - generic: z
    - generic [ref=e6]:
      - button "12 – 18 Oct 2026" [ref=e7] [cursor=pointer]
      - generic [ref=e11]:
        - button "Previous period" [ref=e12] [cursor=pointer]
        - button "Today" [ref=e15] [cursor=pointer]
        - button "Next period" [ref=e17] [cursor=pointer]
      - status "Sync problem" [ref=e21]
      - generic [ref=e24]:
        - button "Filters" [ref=e26] [cursor=pointer]
        - button "Settings" [ref=e29] [cursor=pointer]
  - alert [ref=e32]:
    - generic [ref=e35]: Can't reach Google Calendar. Showing the last known data.
    - button "Retry" [ref=e36] [cursor=pointer]
  - status [ref=e37]: Last updated 08:00
  - generic [ref=e39]:
    - main [ref=e40]:
      - generic [ref=e43]:
        - generic [ref=e44]:
          - button "Mon 12" [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: Mon
            - generic [ref=e48]: "12"
          - button "Tue 13" [ref=e49] [cursor=pointer]:
            - generic [ref=e50]: Tue
            - generic [ref=e51]: "13"
          - button "Wed 14" [ref=e52] [cursor=pointer]:
            - generic [ref=e53]: Wed
            - generic [ref=e54]: "14"
          - button "Thu 15" [ref=e55] [cursor=pointer]:
            - generic [ref=e56]: Thu
            - generic [ref=e57]: "15"
          - button "Fri 16" [ref=e58] [cursor=pointer]:
            - generic [ref=e59]: Fri
            - generic [ref=e60]: "16"
          - button "Sat 17" [ref=e61] [cursor=pointer]:
            - generic [ref=e62]: Sat
            - generic [ref=e63]: "17"
          - button "Sun 18" [ref=e64] [cursor=pointer]:
            - generic [ref=e65]: Sun
            - generic [ref=e66]: "18"
        - generic [ref=e67]:
          - 'button "Tasks: Titles only. Tap to change" [ref=e69] [cursor=pointer]':
            - generic [ref=e70]: "1"
          - button "Groceries, 0 of 2 done" [ref=e76] [cursor=pointer]:
            - generic [ref=e77]:
              - generic [ref=e79]: Groceries
              - generic: 0/2
        - generic [ref=e87]:
          - generic [ref=e88]:
            - generic [ref=e90]: 01:00
            - generic [ref=e91]: 02:00
            - generic [ref=e92]: 03:00
            - generic [ref=e93]: 04:00
            - generic [ref=e94]: 05:00
            - generic [ref=e95]: 06:00
            - generic [ref=e96]: 07:00
            - generic [ref=e97]: 08:00
            - generic [ref=e98]: 09:00
            - generic [ref=e99]: 10:00
            - generic [ref=e100]: 11:00
            - generic [ref=e101]: 12:00
            - generic [ref=e102]: 13:00
            - generic [ref=e103]: 14:00
            - generic [ref=e104]: 15:00
            - generic [ref=e105]: 16:00
            - generic [ref=e106]: 17:00
            - generic [ref=e107]: 18:00
            - generic [ref=e108]: 19:00
            - generic [ref=e109]: 20:00
            - generic [ref=e110]: 21:00
            - generic [ref=e111]: 22:00
            - generic [ref=e112]: 23:00
          - generic [ref=e113]:
            - button "Create at 2026-10-12 00:00" [ref=e114] [cursor=pointer]
            - button "Create at 2026-10-12 01:00" [ref=e115] [cursor=pointer]
            - button "Create at 2026-10-12 02:00" [ref=e116] [cursor=pointer]
            - button "Create at 2026-10-12 03:00" [ref=e117] [cursor=pointer]
            - button "Create at 2026-10-12 04:00" [ref=e118] [cursor=pointer]
            - button "Create at 2026-10-12 05:00" [ref=e119] [cursor=pointer]
            - button "Create at 2026-10-12 06:00" [ref=e120] [cursor=pointer]
            - button "Create at 2026-10-12 07:00" [ref=e121] [cursor=pointer]
            - button "Create at 2026-10-12 08:00" [ref=e122] [cursor=pointer]
            - button "Create at 2026-10-12 09:00" [ref=e123] [cursor=pointer]
            - button "Create at 2026-10-12 10:00" [ref=e124] [cursor=pointer]
            - button "Create at 2026-10-12 11:00" [ref=e125] [cursor=pointer]
            - button "Create at 2026-10-12 12:00" [ref=e126] [cursor=pointer]
            - button "Create at 2026-10-12 13:00" [ref=e127] [cursor=pointer]
            - button "Create at 2026-10-12 14:00" [ref=e128] [cursor=pointer]
            - button "Create at 2026-10-12 15:00" [ref=e129] [cursor=pointer]
            - button "Create at 2026-10-12 16:00" [ref=e130] [cursor=pointer]
            - button "Create at 2026-10-12 17:00" [ref=e131] [cursor=pointer]
            - button "Create at 2026-10-12 18:00" [ref=e132] [cursor=pointer]
            - button "Create at 2026-10-12 19:00" [ref=e133] [cursor=pointer]
            - button "Create at 2026-10-12 20:00" [ref=e134] [cursor=pointer]
            - button "Create at 2026-10-12 21:00" [ref=e135] [cursor=pointer]
            - button "Create at 2026-10-12 22:00" [ref=e136] [cursor=pointer]
            - button "Create at 2026-10-12 23:00" [ref=e137] [cursor=pointer]
            - img "Now, 08:00"
          - generic [ref=e138]:
            - button "Create at 2026-10-13 00:00" [ref=e139] [cursor=pointer]
            - button "Create at 2026-10-13 01:00" [ref=e140] [cursor=pointer]
            - button "Create at 2026-10-13 02:00" [ref=e141] [cursor=pointer]
            - button "Create at 2026-10-13 03:00" [ref=e142] [cursor=pointer]
            - button "Create at 2026-10-13 04:00" [ref=e143] [cursor=pointer]
            - button "Create at 2026-10-13 05:00" [ref=e144] [cursor=pointer]
            - button "Create at 2026-10-13 06:00" [ref=e145] [cursor=pointer]
            - button "Create at 2026-10-13 07:00" [ref=e146] [cursor=pointer]
            - button "Create at 2026-10-13 08:00" [ref=e147] [cursor=pointer]
            - button "Create at 2026-10-13 09:00" [ref=e148] [cursor=pointer]
            - button "Create at 2026-10-13 10:00" [ref=e149] [cursor=pointer]
            - button "Create at 2026-10-13 11:00" [ref=e150] [cursor=pointer]
            - button "Create at 2026-10-13 12:00" [ref=e151] [cursor=pointer]
            - button "Create at 2026-10-13 13:00" [ref=e152] [cursor=pointer]
            - button "Create at 2026-10-13 14:00" [ref=e153] [cursor=pointer]
            - button "Create at 2026-10-13 15:00" [ref=e154] [cursor=pointer]
            - button "Create at 2026-10-13 16:00" [ref=e155] [cursor=pointer]
            - button "Create at 2026-10-13 17:00" [ref=e156] [cursor=pointer]
            - button "Create at 2026-10-13 18:00" [ref=e157] [cursor=pointer]
            - button "Create at 2026-10-13 19:00" [ref=e158] [cursor=pointer]
            - button "Create at 2026-10-13 20:00" [ref=e159] [cursor=pointer]
            - button "Create at 2026-10-13 21:00" [ref=e160] [cursor=pointer]
            - button "Create at 2026-10-13 22:00" [ref=e161] [cursor=pointer]
            - button "Create at 2026-10-13 23:00" [ref=e162] [cursor=pointer]
          - generic [ref=e163]:
            - button "Create at 2026-10-14 00:00" [ref=e164] [cursor=pointer]
            - button "Create at 2026-10-14 01:00" [ref=e165] [cursor=pointer]
            - button "Create at 2026-10-14 02:00" [ref=e166] [cursor=pointer]
            - button "Create at 2026-10-14 03:00" [ref=e167] [cursor=pointer]
            - button "Create at 2026-10-14 04:00" [ref=e168] [cursor=pointer]
            - button "Create at 2026-10-14 05:00" [ref=e169] [cursor=pointer]
            - button "Create at 2026-10-14 06:00" [ref=e170] [cursor=pointer]
            - button "Create at 2026-10-14 07:00" [ref=e171] [cursor=pointer]
            - button "Create at 2026-10-14 08:00" [ref=e172] [cursor=pointer]
            - button "Create at 2026-10-14 09:00" [ref=e173] [cursor=pointer]
            - button "Create at 2026-10-14 10:00" [ref=e174] [cursor=pointer]
            - button "Create at 2026-10-14 11:00" [ref=e175] [cursor=pointer]
            - button "Create at 2026-10-14 12:00" [ref=e176] [cursor=pointer]
            - button "Create at 2026-10-14 13:00" [ref=e177] [cursor=pointer]
            - button "Create at 2026-10-14 14:00" [ref=e178] [cursor=pointer]
            - button "Create at 2026-10-14 15:00" [ref=e179] [cursor=pointer]
            - button "Create at 2026-10-14 16:00" [ref=e180] [cursor=pointer]
            - button "Create at 2026-10-14 17:00" [ref=e181] [cursor=pointer]
            - button "Create at 2026-10-14 18:00" [ref=e182] [cursor=pointer]
            - button "Create at 2026-10-14 19:00" [ref=e183] [cursor=pointer]
            - button "Create at 2026-10-14 20:00" [ref=e184] [cursor=pointer]
            - button "Create at 2026-10-14 21:00" [ref=e185] [cursor=pointer]
            - button "Create at 2026-10-14 22:00" [ref=e186] [cursor=pointer]
            - button "Create at 2026-10-14 23:00" [ref=e187] [cursor=pointer]
            - button "Dentist, 09:00–10:00" [ref=e189] [cursor=pointer]:
              - generic [ref=e190]: Dentist
              - generic [ref=e191]: 09:00–10:00
          - generic [ref=e193]:
            - button "Create at 2026-10-15 00:00" [ref=e194] [cursor=pointer]
            - button "Create at 2026-10-15 01:00" [ref=e195] [cursor=pointer]
            - button "Create at 2026-10-15 02:00" [ref=e196] [cursor=pointer]
            - button "Create at 2026-10-15 03:00" [ref=e197] [cursor=pointer]
            - button "Create at 2026-10-15 04:00" [ref=e198] [cursor=pointer]
            - button "Create at 2026-10-15 05:00" [ref=e199] [cursor=pointer]
            - button "Create at 2026-10-15 06:00" [ref=e200] [cursor=pointer]
            - button "Create at 2026-10-15 07:00" [ref=e201] [cursor=pointer]
            - button "Create at 2026-10-15 08:00" [ref=e202] [cursor=pointer]
            - button "Create at 2026-10-15 09:00" [ref=e203] [cursor=pointer]
            - button "Create at 2026-10-15 10:00" [ref=e204] [cursor=pointer]
            - button "Create at 2026-10-15 11:00" [ref=e205] [cursor=pointer]
            - button "Create at 2026-10-15 12:00" [ref=e206] [cursor=pointer]
            - button "Create at 2026-10-15 13:00" [ref=e207] [cursor=pointer]
            - button "Create at 2026-10-15 14:00" [ref=e208] [cursor=pointer]
            - button "Create at 2026-10-15 15:00" [ref=e209] [cursor=pointer]
            - button "Create at 2026-10-15 16:00" [ref=e210] [cursor=pointer]
            - button "Create at 2026-10-15 17:00" [ref=e211] [cursor=pointer]
            - button "Create at 2026-10-15 18:00" [ref=e212] [cursor=pointer]
            - button "Create at 2026-10-15 19:00" [ref=e213] [cursor=pointer]
            - button "Create at 2026-10-15 20:00" [ref=e214] [cursor=pointer]
            - button "Create at 2026-10-15 21:00" [ref=e215] [cursor=pointer]
            - button "Create at 2026-10-15 22:00" [ref=e216] [cursor=pointer]
            - button "Create at 2026-10-15 23:00" [ref=e217] [cursor=pointer]
          - generic [ref=e218]:
            - button "Create at 2026-10-16 00:00" [ref=e219] [cursor=pointer]
            - button "Create at 2026-10-16 01:00" [ref=e220] [cursor=pointer]
            - button "Create at 2026-10-16 02:00" [ref=e221] [cursor=pointer]
            - button "Create at 2026-10-16 03:00" [ref=e222] [cursor=pointer]
            - button "Create at 2026-10-16 04:00" [ref=e223] [cursor=pointer]
            - button "Create at 2026-10-16 05:00" [ref=e224] [cursor=pointer]
            - button "Create at 2026-10-16 06:00" [ref=e225] [cursor=pointer]
            - button "Create at 2026-10-16 07:00" [ref=e226] [cursor=pointer]
            - button "Create at 2026-10-16 08:00" [ref=e227] [cursor=pointer]
            - button "Create at 2026-10-16 09:00" [ref=e228] [cursor=pointer]
            - button "Create at 2026-10-16 10:00" [ref=e229] [cursor=pointer]
            - button "Create at 2026-10-16 11:00" [ref=e230] [cursor=pointer]
            - button "Create at 2026-10-16 12:00" [ref=e231] [cursor=pointer]
            - button "Create at 2026-10-16 13:00" [ref=e232] [cursor=pointer]
            - button "Create at 2026-10-16 14:00" [ref=e233] [cursor=pointer]
            - button "Create at 2026-10-16 15:00" [ref=e234] [cursor=pointer]
            - button "Create at 2026-10-16 16:00" [ref=e235] [cursor=pointer]
            - button "Create at 2026-10-16 17:00" [ref=e236] [cursor=pointer]
            - button "Create at 2026-10-16 18:00" [ref=e237] [cursor=pointer]
            - button "Create at 2026-10-16 19:00" [ref=e238] [cursor=pointer]
            - button "Create at 2026-10-16 20:00" [ref=e239] [cursor=pointer]
            - button "Create at 2026-10-16 21:00" [ref=e240] [cursor=pointer]
            - button "Create at 2026-10-16 22:00" [ref=e241] [cursor=pointer]
            - button "Create at 2026-10-16 23:00" [ref=e242] [cursor=pointer]
          - generic [ref=e243]:
            - button "Create at 2026-10-17 00:00" [ref=e244] [cursor=pointer]
            - button "Create at 2026-10-17 01:00" [ref=e245] [cursor=pointer]
            - button "Create at 2026-10-17 02:00" [ref=e246] [cursor=pointer]
            - button "Create at 2026-10-17 03:00" [ref=e247] [cursor=pointer]
            - button "Create at 2026-10-17 04:00" [ref=e248] [cursor=pointer]
            - button "Create at 2026-10-17 05:00" [ref=e249] [cursor=pointer]
            - button "Create at 2026-10-17 06:00" [ref=e250] [cursor=pointer]
            - button "Create at 2026-10-17 07:00" [ref=e251] [cursor=pointer]
            - button "Create at 2026-10-17 08:00" [ref=e252] [cursor=pointer]
            - button "Create at 2026-10-17 09:00" [ref=e253] [cursor=pointer]
            - button "Create at 2026-10-17 10:00" [ref=e254] [cursor=pointer]
            - button "Create at 2026-10-17 11:00" [ref=e255] [cursor=pointer]
            - button "Create at 2026-10-17 12:00" [ref=e256] [cursor=pointer]
            - button "Create at 2026-10-17 13:00" [ref=e257] [cursor=pointer]
            - button "Create at 2026-10-17 14:00" [ref=e258] [cursor=pointer]
            - button "Create at 2026-10-17 15:00" [ref=e259] [cursor=pointer]
            - button "Create at 2026-10-17 16:00" [ref=e260] [cursor=pointer]
            - button "Create at 2026-10-17 17:00" [ref=e261] [cursor=pointer]
            - button "Create at 2026-10-17 18:00" [ref=e262] [cursor=pointer]
            - button "Create at 2026-10-17 19:00" [ref=e263] [cursor=pointer]
            - button "Create at 2026-10-17 20:00" [ref=e264] [cursor=pointer]
            - button "Create at 2026-10-17 21:00" [ref=e265] [cursor=pointer]
            - button "Create at 2026-10-17 22:00" [ref=e266] [cursor=pointer]
            - button "Create at 2026-10-17 23:00" [ref=e267] [cursor=pointer]
          - generic [ref=e268]:
            - button "Create at 2026-10-18 00:00" [ref=e269] [cursor=pointer]
            - button "Create at 2026-10-18 01:00" [ref=e270] [cursor=pointer]
            - button "Create at 2026-10-18 02:00" [ref=e271] [cursor=pointer]
            - button "Create at 2026-10-18 03:00" [ref=e272] [cursor=pointer]
            - button "Create at 2026-10-18 04:00" [ref=e273] [cursor=pointer]
            - button "Create at 2026-10-18 05:00" [ref=e274] [cursor=pointer]
            - button "Create at 2026-10-18 06:00" [ref=e275] [cursor=pointer]
            - button "Create at 2026-10-18 07:00" [ref=e276] [cursor=pointer]
            - button "Create at 2026-10-18 08:00" [ref=e277] [cursor=pointer]
            - button "Create at 2026-10-18 09:00" [ref=e278] [cursor=pointer]
            - button "Create at 2026-10-18 10:00" [ref=e279] [cursor=pointer]
            - button "Create at 2026-10-18 11:00" [ref=e280] [cursor=pointer]
            - button "Create at 2026-10-18 12:00" [ref=e281] [cursor=pointer]
            - button "Create at 2026-10-18 13:00" [ref=e282] [cursor=pointer]
            - button "Create at 2026-10-18 14:00" [ref=e283] [cursor=pointer]
            - button "Create at 2026-10-18 15:00" [ref=e284] [cursor=pointer]
            - button "Create at 2026-10-18 16:00" [ref=e285] [cursor=pointer]
            - button "Create at 2026-10-18 17:00" [ref=e286] [cursor=pointer]
            - button "Create at 2026-10-18 18:00" [ref=e287] [cursor=pointer]
            - button "Create at 2026-10-18 19:00" [ref=e288] [cursor=pointer]
            - button "Create at 2026-10-18 20:00" [ref=e289] [cursor=pointer]
            - button "Create at 2026-10-18 21:00" [ref=e290] [cursor=pointer]
            - button "Create at 2026-10-18 22:00" [ref=e291] [cursor=pointer]
            - button "Create at 2026-10-18 23:00" [ref=e292] [cursor=pointer]
    - complementary [ref=e293]:
      - button "No open tasks" [ref=e294] [cursor=pointer]
  - button "Create" [ref=e299] [cursor=pointer]
  - navigation "Views" [ref=e303]:
    - tablist [ref=e304]:
      - tab "Year" [ref=e305] [cursor=pointer]
      - tab "Month" [ref=e310] [cursor=pointer]
      - tab "Week" [selected] [ref=e315] [cursor=pointer]
      - tab "Day" [ref=e320] [cursor=pointer]
      - tab "Tasks" [ref=e325] [cursor=pointer]
```

# Test source

```ts
  1   | /** Sync and network steps (STEPS.md "Sync and network"). */
  2   | import { expect } from '@playwright/test';
  3   | import { Then, When } from './fixtures.js';
  4   | import { setVisibility } from './support/visibility.js';
  5   | import type { World } from './support/world.js';
  6   | 
  7   | /** The app's focus debounce (feature background-sync). */
  8   | const FOCUS_DEBOUNCE_MS = 500;
  9   | 
  10  | When('the network connection is lost', async function (this: World) {
  11  |   // The connection drops after the open page has loaded (its lazy chunks and first fetches), not in the middle of it.
  12  |   if (this.page.url().startsWith('http')) await this.page.waitForLoadState('networkidle').catch(() => undefined);
  13  |   await this.context.setOffline(true);
  14  | });
  15  | 
  16  | When('the network connection is restored', async function (this: World) {
  17  |   await this.context.setOffline(false);
  18  | });
  19  | 
  20  | When('the app regains focus', async function (this: World) {
  21  |   await setVisibility(this.page, 'visible');
  22  |   // The app also syncs 500 ms after `focus` (debounced). Let that sync finish so it cannot land in a later step.
  23  |   await this.page.waitForTimeout(FOCUS_DEBOUNCE_MS + 250);
  24  |   await expect(this.page.getByTestId('sync-status').first()).not.toHaveAttribute('data-state', 'syncing');
  25  | });
  26  | 
  27  | When('the app is hidden', async function (this: World) {
  28  |   await setVisibility(this.page, 'hidden');
  29  | });
  30  | 
  31  | /**
  32  |  * Waits for the next completed sync attempt after this step started: a finished `/api/items` response or a change of
  33  |  * `data-last-sync` (whichever comes first), then for `sync-status` to leave `syncing`. Bounded by poll interval + 5 s.
  34  |  */
  35  | When('I wait for the automatic sync', async function (this: World) {
  36  |   const status = this.page.getByTestId('sync-status').first();
  37  |   const before = await status.getAttribute('data-last-sync').catch(() => null);
  38  |   const timeout = (this.pollIntervalMs || 30_000) + 5_000;
  39  |   this.extendTimeout(timeout);
  40  |   const response = this.page
  41  |     .waitForResponse((r) => new URL(r.url()).pathname === '/api/items', { timeout })
  42  |     .then(() => 'response', () => null);
  43  |   const changed = expect
  44  |     .poll(() => status.getAttribute('data-last-sync').catch(() => null), { timeout })
  45  |     .not.toBe(before)
  46  |     .then(() => 'last-sync', () => null);
  47  |   // Both only reject on timeout; the loser is left to settle quietly.
> 48  |   if (!(await Promise.race([response, changed]))) throw new Error(`No automatic sync within ${timeout} ms`);
      |                                                         ^ Error: No automatic sync within 7000 ms
  49  |   await expect(status).not.toHaveAttribute('data-state', 'syncing');
  50  | });
  51  | 
  52  | /** Waits out Google's slow-down (`world.slowDownUntil`), then for the event within one poll interval + 5 s. */
  53  | Then('once the slow-down is over I see the event {string} on {date}', async function (this: World, title: string, date: string) {
  54  |   const wait = Math.max(0, this.slowDownUntil - Date.now());
  55  |   const timeout = (this.pollIntervalMs || 30_000) + 5_000;
  56  |   this.extendTimeout(wait + timeout);
  57  |   await this.page.waitForTimeout(wait);
  58  |   await expect(this.eventChip(title, date)).toBeVisible({ timeout });
  59  | });
  60  | 
  61  | When('I retry the sync', async function (this: World) {
  62  |   await this.page.getByTestId('sync-retry').click();
  63  | });
  64  | 
  65  | Then('I see the sync error banner', async function (this: World) {
  66  |   await expect(this.page.getByTestId('sync-error-banner')).toBeVisible();
  67  | });
  68  | 
  69  | Then('I do not see the sync error banner', async function (this: World) {
  70  |   await this.calendarShown();
  71  |   await expect(this.page.getByTestId('sync-error-banner')).toBeHidden();
  72  | });
  73  | 
  74  | /** The version the last "a new version of the app is deployed" step announced. */
  75  | let deployedVersion = '';
  76  | 
  77  | When('a new version of the app is deployed', async function (this: World) {
  78  |   deployedVersion = `e2e-${Date.now()}`;
  79  |   // No service worker may serve the old index.html on reload: the version check must work without one.
  80  |   await this.page.evaluate(async () => {
  81  |     for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
  82  |     for (const key of await caches.keys()) await caches.delete(key);
  83  |   });
  84  |   await this.api.post('/api/__test/version', { version: deployedVersion });
  85  | });
  86  | 
  87  | /** A focus-triggered sync, which also re-reads /api/config. */
  88  | When('the app syncs', async function (this: World) {
  89  |   await setVisibility(this.page, 'visible');
  90  | });
  91  | 
  92  | Then('I am told a new version is available', async function (this: World) {
  93  |   await expect(this.page.getByTestId('update-available')).toBeVisible();
  94  | });
  95  | 
  96  | When('I choose to reload', async function (this: World) {
  97  |   await Promise.all([
  98  |     this.page.waitForEvent('load'),
  99  |     this.page.getByTestId('update-reload').click(),
  100 |   ]);
  101 | });
  102 | 
  103 | Then('the app runs the new version', async function (this: World) {
  104 |   await expect(this.page.locator('html')).toHaveAttribute('data-app-version', deployedVersion);
  105 | });
  106 | 
```