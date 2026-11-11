# 0044 A per-device read key and the Scriptable app give the iPhone a widget

Status: proposed (issue #95; number 0044 because 0043 is taken on `feat/93-contact-birthdays`)

## Decision
- The iPhone widget is a JavaScript script run by the free Scriptable app. It cannot use the web app's session cookie (it
  lives in Safari's or the installed web app's jar, which Scriptable cannot read), so the person creates a **widget key** in
  Settings, one per device.
- A key is `cwk_<id>_<secret>` (256 random bits), belongs to one person, and opens exactly one route, `GET
  /api/widget/data`, sent as `Authorization: Bearer`. On every other route a key counts as no sign-in; on that route a
  session is ignored. The route reuses the items service with `excludeHidden=1` forced on, so the shared visibility rule
  (hidden flag, plans) stays in one place and the Android widget and the iPhone widget agree.
- The server stores only SHA-256(secret), compared in constant time. The secret has 256 bits, so a slow password hash adds
  nothing; a fast hash keeps the widget route cheap. The key is shown once, at creation.
- Use is limited to 30 requests per key per minute (429), and `lastUsedAt` is written at most hourly. Revoking keeps a record
  for 90 days, so the widget can say "removed" instead of "wrong key".
- The app offers a tiny **installer** script with the key and server URL in it. Run once in Scriptable, it puts the key and URL
  in Scriptable's Keychain and downloads the real widget script from `GET /api/widget/script` (key-authenticated, no secrets
  inside) into Scriptable's documents directory with `FileManager.writeString`. The widget script reads the key from the
  Keychain, updates itself when the server names a newer version (checked, then written; a failed update keeps the old
  script) and keeps its last answer in local files for offline. The key may sit in Scriptable's storage even with iCloud
  sync on (owner decision).

- A key opens two routes, `GET /api/widget/data` and `GET /api/widget/script` (same errors, same rate limit); the data answer
  carries the person's `language` and `widgetCircle` prefs, so the script speaks the app's language (German first, `auto`
  follows the iPhone, anything else English) and draws the lock-screen circle as start time (default) or countdown. The
  setting is per person and reaches the widget with its next refresh; the whole answer is cached on the phone.
- Sizes: small today, medium today and tomorrow (the same coloured rows), large the week as a time grid, lock screen inline,
  circular and rectangular. The week grid's hours come from one rule in `shared/weekHours.js`, a port of the Android week
  widget's `WeekLayout.hourRange`; the script carries a copy that a test keeps equal (the script is served alone).
- The key list is a per-person file `widgetKeys` of the device store (it travels in `GET /api/changes`, never the secret),
  so Settings shows it offline; creating and removing need the server.
- Rate limiting uses the `rate-limiter-flexible` library (in-memory, per key and per client for wrong keys).

## Alternatives weighed
- **The Google sign-in or the session cookie in the script**: Scriptable cannot sign in with Google (Google refuses embedded
  browsers), and a session is a full account key (write access, all routes). A leaked widget script would be a leaked account.
- **A key in the URL query** (`?key=`): ends up in logs and proxies; a header does not.
- **A signed, expiring URL per request**: needs a server round trip to renew while the phone is the only one holding the secret.
- **A shared secret for all devices of a person**: one lost phone means rotating all; per-device keys are listed and
  revoked one by one.
- **Paste the whole script**: works, but every script change means another paste; the installer pastes once.
- **`importModule` of a downloaded module**: Scriptable's `importModule` loads files from its folders, so it would still need
  the download and write step; the widget stays one file written with `FileManager`.
- **A native iOS app with WidgetKit**: needs the paid Apple program or weekly re-signing (docs/IOS-OPTIONS.md).

## Consequences
- A new server store per person (`widget-keys.json`, not part of any backup: a lost key is created again) and one in-memory index id to person built at start.
- The script and its drawing live in the repo (`ios/widget/`) and are served by the app inside the copied text; a script
  change reaches the phone by the script's own update check.
- Refresh is up to iOS (about 40-70 per day at best); the widget is a snapshot, not a clock.
