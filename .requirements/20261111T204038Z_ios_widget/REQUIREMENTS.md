# iPhone widget through Scriptable (issue 95)

## As Is
Android has native widgets (week, day, clock) that read `GET /api/items?excludeHidden=1` with the app's session cookie.
iPhone has none; docs/IOS-OPTIONS.md settled on a Scriptable script with a per-device token.

## To Be
A person creates a widget key in Settings, copies a ready script (key and server URL inside) into the free Scriptable app,
adds a Scriptable widget, and sees today, the next days or the week, on the home screen or lock screen. Spec:
`spec/features/app/iphone-widget.feature`, ADR 0043, `spec/API.md` ("Widget keys and the iPhone widget data").

## How Scriptable fits (docs.scriptable.app, read 2026-11-11)
- `ListWidget` / `WidgetStack` / `WidgetText` and `DrawContext` draw; `config.widgetFamily` is `small|medium|large|extraLarge|
  accessoryRectangular|accessoryInline|accessoryCircular` (accessory = iOS 16 lock screen); `args.widgetParameter` is the
  free text field of the widget; `ListWidget.url` is the tap target; `refreshAfterDate` is the earliest next redraw, not a
  promise (iOS decides; low battery or a rarely seen widget get fewer).
- `Request` takes `headers` (Bearer works), `loadJSON()`; `FileManager.local()` keeps the last answer on the phone;
  `Keychain` stores secrets. Scripts have a memory limit in widgets.
- URL scheme: `scriptable:///add` opens an empty new script, `scriptable:///run/<name>`, `scriptable:///open/<name>`; the
  docs show no parameter that carries script text, so the one-tap way is clipboard paste. Not verified on a device.

## Requirements and acceptance
Each requirement is the scenario of the same name in the feature file.
1. Setup: create key, copy script, open Scriptable; script needs nothing filled in; key shown once.
2. Keys: list with device name and last use, revoke, revoked key explained in the widget, read-only, hash only, rate limit.
3. Content: small = today, medium = today + tomorrow, large = week, lock screen = what runs now / next; tap opens the day.
4. Per person, hidden calendars and plans left out through the one server rule.
5. Offline: last answer kept, age note when stale (older than 2 h while a refresh was due), first-run message.
6. Refresh: asks iOS for the next change (event start/end) or at most 30 min ahead; the user is told iOS decides.

## Testing plan
- Server (Vitest, `server/test`): key create/list/revoke, hash at rest, foreign id 404, key on other routes 401, session on
  the widget route 401, forced `excludeHidden`, range limit, 429, `lastUsedAt` throttle, revoked/unknown codes, backup includes the file.
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
Listed in the report of the spec gate; answers are recorded here after they are given.
1. The script is pasted by the person (no import by URL); the key and URL are inside it.
2. Content split: small today, medium today + tomorrow, large week, lock screen = now/next; extraLarge (iPad) not supported.
3. Tap opens `https://<server>/day/<date>`, which Safari or the installed web app handles (iOS decides which).
4. Stale = last answer older than 2 hours; shown as "Updated 06:00".
5. Key shown once; 10 keys per person; 30 requests per minute; revoked records kept 90 days.
6. Scriptable's Keychain is not used: the key sits in the script text (simplest, one paste).
7. New script versions are copied again by the person; no auto-update.
8. Language and theme: the script follows the iPhone's language, with the app's strings; calendar colours come from the items.
