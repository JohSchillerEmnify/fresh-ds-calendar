# iPhone widget through Scriptable (issue 95)

## Decisions
Owner, 2026-11-11, on issue 95:
1. Route, answering "is there any other better solution? if not then yes copy paste is fine. and with better solution i also mean a better app or any other better route": after the research the owner chose "Scriptable + installer". A tiny installer is copied and pasted once; it downloads the real widget script from the server with the key and saves it with FileManager; the widget script checks for a newer version and updates itself, so the user never pastes again.
2. Key storage: "Fine (Recommended)". The key in the script or Scriptable's storage is OK even with iCloud sync.
3. Stale note: "After 2 hours".
4. Sizes, the owner asked "can we have a scrollable day/week view? or are contents fixed?": WidgetKit widgets cannot scroll and Scriptable widgets have no buttons, so the iPhone widget is a fixed snapshot. The split (small today, medium today + tomorrow, large the week, lock screen now/next) is kept as an assumption the mockup confirms.
5. ADR number 0044 (0043 is taken on `feat/93-contact-birthdays`).

## As Is
Android has native widgets (week, day, clock) that read `GET /api/items?excludeHidden=1` with the app's session cookie.
iPhone has none; docs/IOS-OPTIONS.md settled on a Scriptable script with a per-device token.

## To Be
A person creates a widget key in Settings, copies a ready script (key and server URL inside) into the free Scriptable app,
adds a Scriptable widget, and sees today, the next days or the week, on the home screen or lock screen. Spec:
`spec/features/app/iphone-widget.feature`, ADR 0044, `spec/API.md` ("Widget keys and the iPhone widget data").

## How Scriptable fits (docs.scriptable.app, read 2026-11-11)
- `ListWidget` / `WidgetStack` / `WidgetText` and `DrawContext` draw; `config.widgetFamily` is `small|medium|large|extraLarge|
  accessoryRectangular|accessoryInline|accessoryCircular` (accessory = iOS 16 lock screen); `args.widgetParameter` is the
  free text field of the widget; `ListWidget.url` is the tap target; `refreshAfterDate` is the earliest next redraw, not a
  promise (iOS decides; low battery or a rarely seen widget get fewer).
- `Request` takes `headers` (Bearer works), `loadJSON()`; `FileManager.local()` keeps the last answer on the phone;
  `Keychain` stores secrets. Scripts have a memory limit in widgets.
- URL scheme: `scriptable:///add` opens an empty new script, `scriptable:///run/<name>`, `scriptable:///open/<name>`; the
  docs show no parameter that carries script text, so the person pastes once. Not verified on a device.
- Saving a downloaded script: `FileManager.documentsDirectory()` is where Scriptable keeps its scripts (iCloud folder when
  iCloud is on, else the local one), so `FileManager.writeString(joinPath(documentsDirectory(), "Calendar.js"), body)` makes
  it a normal Scriptable script. `importModule(name)` only loads existing files from Scriptable's folders and does not
  download, so it is not needed. The key and server URL go in `Keychain.set`; the real script holds no secret.

## Requirements and acceptance
Each requirement is the scenario of the same name in the feature file.
1. Setup: create key, copy the installer, open Scriptable, run it; nothing to fill in; key shown once; the installer downloads the script (`GET /api/widget/script`, key-authenticated, no secrets inside); the script updates itself and a failed update keeps the old one.
2. Keys: list with device name and last use, revoke, revoked key explained in the widget, read-only, hash only, rate limit.
3. Content: small = today, medium = today + tomorrow, large = week, lock screen = what runs now / next; tap opens the day.
4. Per person, hidden calendars and plans left out through the one server rule.
5. Offline: last answer kept, age note when stale (older than 2 hours), first-run message.
6. Refresh: asks iOS for the next change (event start/end) or at most 30 min ahead; the user is told iOS decides.

## Testing plan
- Server (Vitest, `server/test`): key create/list/revoke, hash at rest, foreign id 404, key on other routes 401, session on
  the widget route 401, forced `excludeHidden`, range limit, 429, `lastUsedAt` throttle, revoked/unknown codes, backup leaves the file out.
- Script (Node, `ios/widget/test`, fake `Request`/`FileManager`/`ListWidget`): layout per family, offline and age note,
  revoked message, `refreshAfterDate`, tap URL `/day/<date>`, no secret in logs. Unit tests are named in `# unit:` comments when built.
- Web (Vitest + e2e): the Settings section only. Device: a person checks the three sizes and the lock screen once.
- Mockup before UI: see below.

## Implementation plan (PR-sized units)
1. Server: store, hash, routes, rate limit, tests (mergeable alone).
2. Script in `ios/widget/` with its tests; the shared layout rules reused where they are plain TypeScript in `shared/`
   (otherwise a small port, as the Android week layout is).
3. Settings section, copy and open buttons, i18n (all locales), e2e of the Settings scenarios.

## Mockup must show (not made yet)
Settings: the new section "iPhone widget" (placement in "Account & app" or its own group, to be agreed), empty state,
create dialog (device name), the one-time key screen with "Copy script" and "Open Scriptable" and the 3 steps, the key
list (name, created, last used, never used, revoke with confirmation), the limit-reached state, dark, German.
Widget: small, medium, large, lock screen rectangular/inline/circular; light and dark; busy and empty day; all-day and
multi-day; stale note; revoked message; "no data yet"; calendar colours as on Android.

## Assumptions and open questions
Closed by the decisions above: paste route (1), key storage (2), stale after 2 hours (3), script updates (8 now automatic).
Open, for the mockup or the owner:
1. Content split (small today, medium today + tomorrow, large week, lock screen now/next; no iPad extra-large) is an assumption the mockup confirms; the widget cannot scroll or page.
2. Tap opens `https://<server>/day/<date>`; iOS picks Safari or the installed web app.
3. 10 keys per person, 30 requests per key per minute, `lastUsedAt` at most hourly, revoked records 90 days.
4. Key `cwk_<id>_<secret>` with a plain SHA-256 hash; in-memory id index at start; keys are not part of backups (a lost key is created again).
5. A key reaches two routes: `/api/widget/data` and `/api/widget/script`; the script is the same for everyone and holds no secret.
6. Update rule: the data answer carries `scriptVersion`; the script downloads only a newer one and writes it only after the first line parses.
7. The script follows the iPhone's language; colours come from the items.
8. Settings placement ("Account & app" or its own group) and the Scriptable memory limit for the large drawing: the mockup and a device check settle them.
