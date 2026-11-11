# 0043 A per-device read key and the Scriptable app give the iPhone a widget

Status: proposed (issue #95)

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
- The key and server URL are written into the script the app offers to copy; Scriptable stores it as part of the script
  (and in iCloud if the person has Scriptable's iCloud on). The script keeps its last answer in Scriptable's local files and
  draws it when there is no connection.

## Alternatives weighed
- **The Google sign-in or the session cookie in the script**: Scriptable cannot sign in with Google (Google refuses embedded
  browsers), and a session is a full account key (write access, all routes). A leaked widget script would be a leaked account.
- **A key in the URL query** (`?key=`): ends up in logs and proxies; a header does not.
- **A signed, expiring URL per request**: needs a server round trip to renew while the phone is the only one holding the secret.
- **A shared secret for all devices of a person**: one lost phone means rotating all; per-device keys are listed and
  revoked one by one.
- **A native iOS app with WidgetKit**: needs the paid Apple program or weekly re-signing (docs/IOS-OPTIONS.md).

## Consequences
- A new server store per person (`widget-keys.json`, included in the person's backup) and one in-memory index id to person built at start.
- The script and its drawing live in the repo (`ios/widget/`) and are served by the app inside the copied text; a script
  change needs the person to copy it again (how the person learns of one is an open question in the requirements).
- Refresh is up to iOS (about 40-70 per day at best); the widget is a snapshot, not a clock.
