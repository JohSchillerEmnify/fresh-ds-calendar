# iPhone widget through Scriptable (issue 95)

## Decisions
Owner, 2026-11-11, on issue 95:
1. Route, answering "is there any other better solution? if not then yes copy paste is fine. and with better solution i also mean a better app or any other better route": after the research the owner chose "Scriptable + installer". A tiny installer is copied and pasted once; it downloads the real widget script from the server with the key and saves it with FileManager; the widget script checks for a newer version and updates itself, so the user never pastes again.
2. Key storage: "Fine (Recommended)". The key in the script or Scriptable's storage is OK even with iCloud sync.
3. Stale note: "After 2 hours".
4. Sizes, the owner asked "can we have a scrollable day/week view? or are contents fixed?": WidgetKit widgets cannot scroll and Scriptable widgets have no buttons, so the iPhone widget is a fixed snapshot. The split (small today, medium today + tomorrow, large the week, lock screen now/next) is kept as an assumption the mockup confirms.
5. Sizes, owner: "week and day are fine for now in ios." Then, correcting an agent's reading that today + tomorrow was dropped, owner: "when did i say that today+tomorow should be dropped???? is htis scrollable? if not then we can't do it that way." So: small = Day, medium = today + tomorrow, large = Week. Every size reads top-down: big date, the next entry as a large coloured block, the rest of today small, a compact "Tomorrow" section (medium), a "+N more" line on overflow. No time strip on any size (a widget cannot scroll, a full day does not fit).
6. Lock screen, owner, later: "i like the idea of a lock screen panel, i just didn't like the clock there." The lock-screen widgets are back: inline (next entry), circular (start time or countdown, point 11) and rectangular (now/next) (`accessoryInline`, `accessoryCircular`, `accessoryRectangular`, `presentAccessory*`, iOS 16+). The widget draws no clock of its own; iOS shows its clock on the lock screen.
7. ADR number 0044 (0043 is taken on `feat/93-contact-birthdays`).

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
3. Content: small Day, medium today + tomorrow, large Week (lock screen: inline, circular, rectangular); tap opens the day.
4. Per person, hidden calendars and plans left out through the one server rule.
5. Offline: last answer kept, age note when stale (older than 2 hours), first-run message.
6. Refresh: asks iOS for the next change (event start/end) or at most 30 min ahead; the user is told iOS decides.

8. Setup link (owner, on the setup steps: "yes fairly clear, can we somehow add a link or something like that?"): step 1 has a "Get Scriptable" link to https://apps.apple.com/app/id1405459188; Scriptable's URL scheme has no parameter that carries a script, so the installer stays copy + "Open Scriptable" (`scriptable:///add`). Scenario "The setup offers a link to get Scriptable".

9. Foolproof setup (owner: "the instructions need to be foolproof for scriptable."): a 7-step guide, each step one action plus a grey line saying what the person should see, except step 2 (owner: a hint describing the button's own feedback is "BS"; the button just turns into "Copied ✓") (scenario "The setup is a guide of seven steps"). The installer's first comment line is "Calendar widget installer"; it shows "Installed. Now add the widget." in a Scriptable Alert and clear failure texts (key not valid, key removed, no connection, server not answering) that say what to do next. The saved script is named "Calendar" so step 7's "Script > Calendar" matches. "Widget connected ✓ — device, time" shows when the key's first data read arrives; the Settings guide re-reads the key list every few seconds while it is open (no new push channel). A widget run without a widget context or without a key shows a short "how to add me" text instead of failing.
   **Check on a real iPhone before release:** iOS and Scriptable menu names ("Edit › Add Widget", "Select script in widget configurator", "Script › Calendar") change between versions; the exact wording of steps 3 and 5-7 is unverified until then.

10. Texts follow the settings audit (owner: "apply it's learnings here too!"; commits 2f3aa706, 9e7409c7): plain language, at most one short hint, no narration of what the UI shows, no "key"/"script"/"server" where avoidable, German like a native speaker. Final guide: section text "Your calendar on the iPhone home screen and lock screen."; 1 "Install the free Scriptable app:" + "Get Scriptable" (hint "Come back here afterwards."); 2 button "Copy installer"; 3 button "Open Scriptable" (hint "If a welcome screen appears, close it and tap the button again."); 4 "Tap the empty page, then tap Paste."; 5 "Tap ▶ at the bottom right. When “Installed” appears, close Scriptable."; 6 "On the home screen, press and hold an empty spot. Tap Edit › Add Widget, search for Scriptable, pick a size and tap Add Widget."; 7 "Tap the new widget, then Script › Calendar."; under the buttons "The installer only works for this iPhone and is shown only once."; status "Widget connected ✓ – <device>, <time>". This supersedes the 7-step wording in point 9 (the grey "see" lines of steps 4-7 are gone, 3 and 1 keep a hint). The installer's success alert says "Installed"; its and the widget's failure texts are one plain sentence saying what to do.

11. Lock-screen circle, two versions with a switch. Owner's words, in order: "in 19 min would be more useful. maybe it should always count down to the next one but i'm not sure about that behaviour."; "if it's only every few minutes, we should only show time of next appointment and potentially drop the circle, that would be annoying."; final: "we can try it. and build two versions if possible, can we toggle them from the app?" So: per-person pref `widgetCircle` (`time` default, `countdown`), a segmented row "Lock screen circle" (Start time / Countdown, hint "Countdown may lag a few minutes behind.") in the iPhone widget section of Settings; `GET /api/widget/data` carries it and the script caches the whole answer. "Start time" draws the next entry's start time ("14:30"). "Countdown" draws a small "in" and a `WidgetDate` for the next start with `applyRelativeStyle()`, which iOS keeps updating by itself; "now" in the last minute (redraw asked at the start, then the following entry), the start time when the next entry is more than an hour away (redraw asked when it comes within the hour). Inline and rectangular show start times and titles, no countdown (rectangular: "Dentist · until 10:00", "Next: Gym 18:00").
    **What the docs say** (docs.scriptable.app/widgetdate, read 2026-11-11): "Dates will update periodically when shown in a widget."; `applyRelativeStyle()` "Display date as relative to now. Example output: 2 hours, 23 minutes"; `applyTimerStyle()` "Display date as timer counting from now. Example output: 2:32". Nothing says whether this updates every minute or works in `accessoryCircular`, and the relative output has no "in" (so the script adds its own small "in"; in German "in 19 Minuten" reads the same). Built on purpose although unclear; the owner tries it on the phone: **assumptions to check on a device**: (a) iOS updates the relative date live in the circle without a redraw; (b) the circle is wide enough for "in" + "19 minutes" (the text scales down to 60%); (c) "always count down to the next entry" is the wanted behaviour.
12. Redraw rule: the next start or end of an entry or midnight, at most one hour ahead (the scenario asks for 10:00 from 09:20, so the earlier "at most 30 minutes" is replaced).

13. Medium and large (owners' words): "Don't like it, today and tomorrow should look the same ideally." (medium = two identical columns TODAY and TOMORROW, each with day number, label, all-day band, one coloured row per entry, "+N more"; no "next entry" block) and "WHY IS THERE STILL NO TIMES HERE? WHY IS IT STILL JUST AGENDA?" (large = a time grid like the Android week widget: days across the top, all-day band, hour scale with faint lines, a block per entry by start and as tall as its duration, red now-line in today's column). Small keeps the big date and the next entry as a block.
14. The week grid's hour range is one rule in `shared/weekHours.js` (`hourRange`), a port of `WeekLayout.hourRange` in the Android widget; every timed entry is shown (no cut, no markers). The script holds a copy of the function text (it is served alone to Scriptable), and a test fails if the copy and the shared function differ; its cases mirror `WeekLayoutTest`. **The Java copy must stay in step**: a change to the rule goes into `shared/weekHours.js`, the script copy and `WeekLayout.java` together.

15. Review fixes (coordinator): the rate-limit client is the right-most `X-Forwarded-For` entry (the proxy's own), else the socket address, in 4096 buckets; the installer deletes itself after a good install (asks the person to if it cannot); the script asks one 14-day-capped range for every size so one cache draws all sizes offline; a revoked or unknown key drops the cached answer and shows only the message (the earlier "last answer greyed out" is gone); an update or install is saved only if the version line and the closing `// calendar-widget end` line are both present.

## Built vs. device only
Built and proven: every scenario of `iphone-widget.feature`. The server and the script (drawn on a fake Scriptable canvas: `server/test/ios-widget.test.ts`, `server/test/widget-keys.test.ts`) are `@unit`; the Settings scenarios run in the browser suite (`@id:iphone-widget`, 10 scenarios, mobile). Nothing in the feature is left `@backlog`.
Only a real iPhone proves, and the owner must check there (none is a scenario): how the pictures look and fit in each size (small, medium, large time grid, lock screen), Scriptable's `FileManager.iCloud()` fallback to the local folder, the Keychain, `scriptable:///add` and the Scriptable/iOS menu names in the guide (English and German: "Edit › Add Widget" / "Bearbeiten › Widget hinzufügen", "Paste" / "Einsetzen", "Select script in widget configurator", "Script › Calendar"), whether iOS updates the countdown `WidgetDate` live in the circle, how often iOS redraws, and the Scriptable memory limit for the week grid.
Not drawn: task lists (only calendar events); `taskCategories` and `weekSideBySide` are in the data answer but unused (`minEventMinutes` sets the shortest block height).

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
Widget: small and medium (Day), large (Week), lock screen inline, circular and rectangular (no clock); light and dark; busy and empty day; all-day and
multi-day; stale note; revoked message; "no data yet"; calendar colours as on Android.

## Assumptions and open questions
Closed by the decisions above: paste route (1), key storage (2), stale after 2 hours (3), script updates (8 now automatic).
Open, for the mockup or the owner:
1. Assumption: the widget size picks the view (small Day, medium today + tomorrow, large Week), so a user places both views without any setting. Alternative: Scriptable's widget parameter ("day" or "week") chooses the view, which needs typing and works in any size; not chosen as it adds a step. The mockup confirms. No iPad extra-large; the widget cannot scroll or page.
2. Tap opens `https://<server>/day/<date>`; iOS picks Safari or the installed web app.
3. 10 keys per person, 30 requests per key per minute, `lastUsedAt` at most hourly, revoked records 90 days.
4. Key `cwk_<id>_<secret>` with a plain SHA-256 hash; in-memory id index at start; keys are not part of backups (a lost key is created again).
5. A key reaches two routes: `/api/widget/data` and `/api/widget/script`; the script is the same for everyone and holds no secret.
6. Update rule: the data answer carries `scriptVersion`; the script downloads only a newer one and writes it only after the first line parses.
7. The script follows the iPhone's language; colours come from the items.
8. Settings placement ("Account & app" or its own group) and the Scriptable memory limit for the large drawing: the mockup and a device check settle them.
