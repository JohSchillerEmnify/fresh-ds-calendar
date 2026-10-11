# Assumptions

Made by the spec author while the owner was unavailable (2026-10-12). Each one can be changed later; the affected
spec files are named.

## Product

- **A-01 Default view**: `/` opens the month view of today. No "last used view" memory. (navigation.feature)
- **A-02 Focus date**: switching views keeps a focus date (kept if inside the new period, else today if inside, else
  the first day of the period). Prev/next therefore lands on the first day of the new period. (ARCHITECTURE §5)
- **A-03 Week URL** with a non-Monday date is normalised to its Monday with a history `replace`.
- **A-04 Invalid URLs** redirect to the current month instead of showing an error page.
- **A-05 Titles**: event and task list titles are required (no "(No title)" like Google), max 200 characters. Task list
  item titles max 200, max 200 items per list.
- **A-06 Error texts**: `Title is required`, `Title must be at most 200 characters`, `End must be after start`,
  `Could not save: Google Calendar is unavailable`, `This event was changed elsewhere. Reload it and try again.`,
  banner `Can't reach Google Calendar. Showing the last known data.`
- **A-07 New event defaults**: focus date; next full hour if today (capped at 23:00) else 09:00; 1 h; primary calendar.
  Editing start keeps duration. Form shows inclusive end dates for all-day events.
- **A-08 Calendars in the mock**: `primary` "Personal" `#039be5` and `work` "Work" `#0b8043`. Event `colorId`
  overrides are supported by the API but the UI only lets users pick the calendar (no per-event color picker in v1).
- **A-09 Multi-day rendering**: one chip per covered day (month and week), not a spanning bar. Simpler, deterministic,
  works on narrow phones.
- **A-10 Month overflow**: desktop max 3 entries per cell + `+N more`; phone max 2 compact chips + `+N`.
- **A-11 Timed task lists** are 30-minute Google events; untimed ones are all-day events. They live in one calendar
  (`TASKLIST_CALENDAR_ID`, default primary); the task list form has no calendar picker.
- **A-12 No offline writes**: changes made while Google/network is unavailable fail visibly (dialog error or rollback)
  instead of being queued. Read-only offline (last known data + app shell).
- **A-13 Conflicts**: event and task list detail edits use etags (`If-Match`) and are rejected when stale. Item-level
  operations merge server-side (read-modify-write) and never conflict.
- **A-14 Description mirror**: `extendedProperties` are authoritative. Editing the `☐/☑` lines in the Google app is
  overwritten on the next app change. Task list events with `kind=tasklist` but no `items` property are parsed from
  the description.
- **A-15 Recurring events**: displayed (expanded instances) but not creatable; editing an instance edits only that
  instance. Not covered by e2e because the mock does not need recurrence rules in v1.
- **A-16 Reordering** items uses up/down buttons (deterministic for tests), marked `@optional`; drag and drop is a
  possible later enhancement.
- **A-17 Google Tasks** integration is out of scope (brief: nice to have).
- **A-18 Language/locale**: English UI, `en-GB` date formats, 24 h, Monday week start, Europe/Berlin.

## Mobile and PWA

- **A-19 Mobile first** (owner update): phone layout below 768 px is the primary design; desktop is a secondary layout
  of the same components. Default Playwright project is `mobile` (375×812, touch); `desktop` (1280×800) is second.
- **A-20 Phone month view**: compact chips (title only); tapping anywhere in a cell opens that day's view ("agenda").
  The day view doubles as the agenda (all-day area + time grid); no separate list-style agenda screen in v1.
- **A-21 Swipes** are implemented with touch events on the calendar area (no gesture library), so tests can dispatch
  them deterministically.
- **A-22 Theme color** `#1a73e8`, background `#ffffff`, app name and short name "Calendar". Icons are generated from
  one SVG source (simple calendar glyph) in 180/192/512 and maskable 512.
- **A-23 Secure context** (owner update): service workers and the Android install prompt need HTTPS.
  `http://cal.mordor.local` is not secure, so there: no service worker / offline shell, Android only creates a browser
  shortcut, iOS Add to Home Screen works without offline support. The app must detect this and degrade silently.
  E2E tests the PWA features on `http://localhost` (a secure context).
- **A-24 HTTPS plan** (owner decision): Let's Encrypt DNS-01 via Cloudflare DNS (domain at Namecheap, nameservers at
  Cloudflare free plan), wildcard `*.<subdomain>.<owner-domain>`, LAN only (no public A records, Pi-hole → 192.168.1.38).
  Owner action, not done yet; guide: `/home/sauron/docker-compose/traefik/HTTPS-GUIDE.md`. Until then the deployment is
  HTTP only and AC-45 (installability) is pending. The app never hardcodes a host: `PUBLIC_URL` / `ALLOWED_ORIGINS`.
- **A-25 Future URLs**: app `https://cal.<subdomain>.<owner-domain>`; Google OAuth redirect
  `https://cal.<subdomain>.<owner-domain>/api/auth/google/callback`. Tunnels/VPNs (Tailscale, Cloudflare Tunnel) are not
  used (owner rejected them); a local CA (mkcert/step-ca) is only a fallback.
- **A-26 Away from home** the LAN-only name does not resolve; the installed app shows its cached shell and the error
  banner. This is accepted (not exposed to the internet by design).

## Testing and operations

- **A-27 Test clock**: `POST /api/__test/clock` sets a frozen "now"; the web app reads it from `/api/config` at startup
  and on focus. "Given today is D" means D 08:00 Europe/Berlin. Real time still drives timers (polling).
- **A-28 Polling in tests**: default 30 s; scenarios that rely on polling set it to 2 s via `/api/__test/config`;
  focus scenarios disable polling so focus is proven to trigger the sync.
- **A-29 Outage simulation** is a provider-level switch (server stays up); network loss is simulated with Playwright
  `context.setOffline`.
- **A-30 One worker**: e2e runs serially (`workers: 1`) because all scenarios share one mock backend; each scenario
  starts with `POST /api/__test/reset`.
- **A-31 Data fixtures** are created through the public API, not by writing the JSON file.
- **A-32 Budgets** (owner update): initial JS ≤ 150 kB compressed, month view rendered ≤ 2 s, Lighthouse mobile ≥ 90
  on localhost, idle server RSS ≤ 80 MB, < 20 MB RSS growth under a 5 000-request soak, < 10 % frontend heap/DOM/listener
  growth after 50× navigation and dialog cycles. Memory is measured in Chromium only (DevTools protocol); Safari is not
  measured.
- **A-33 Demo seed**: a few events and two task lists around the current week, only when the store is empty and
  `SEED` is not `false`.
- **A-34 No authentication** for the app itself: it is LAN-only and single-user. Anyone on the LAN can read/write the
  calendar. Revisit if it is ever exposed.

## Design and efficiency (owner update)

- **A-35 Theme**: light/dark follows the system setting only; no in-app toggle in v1.
- **A-36 Dynamic color**: "dynamic-ish" means a light and dark M3 scheme generated at build time from the seed `#1a73e8`.
  Android wallpaper-based dynamic color is not available to web apps and is out of scope.
- **A-37 Component library**: M3 components are built in-house on design tokens to meet the bundle budget, unless
  `docs/RESEARCH.md` decides otherwise. Navigation rail on desktop, navigation bar on phones.
- **A-38 Stack overrides**: the "Decision" section of `docs/RESEARCH.md` overrides stack choices in the BRIEF and in
  ARCHITECTURE.md. The spec contracts (features, steps, API, testids, env vars) stay valid regardless of the stack.
- **A-39 Fonts and icons**: system font stack (Roboto on Android, SF on iOS), inline SVG icons; no web font downloads.
