# 0014 — The widget reads the API with the app's own session

- Status: accepted (owner, 2026-10-13)
- Views shaped: `widget`, `widgetWeekRefresh`

## Context

The widget must show the current week even when the app has not been opened for days. Its native code and the app's
WebView share one cookie jar per app.

## Decision

- The widget's native code calls the existing items API itself, with the app's session cookie for the chosen server:
  no new server auth, no key.
- The web app's snapshot stays, in a smaller role: theme and language always, the week only as a fallback when the
  widget's own call fails. A fetch for the current week always wins over the snapshot.
- The widget asks the server to leave out the person's hidden calendars, since those live on the server, not in the
  WebView.

## Alternatives

- *A long-lived widget API key* (the owner's first choice) — a second credential to issue, store and revoke.
- *Snapshot only* — the widget would be only as fresh as the last time the app was open: a week-old view after a quiet
  week.
- *Filtering hidden calendars natively by ids from the snapshot* — stale until the app runs, wrong while it is closed.

## Consequences

- The session's lifetime is the widget's: it is extended on every use, and the widget stores the refreshed cookie, so a
  refreshing widget keeps the session alive. After 90 days without any use, or after signing out, the widget asks to
  open the app.
- The session cookie is `Secure` only on HTTPS, so the native client works over plain HTTP on the LAN; no server
  security was loosened, and the cookie jar is readable by this app only.
- Non-GET requests without an `Origin` (the widget's native call) are accepted by the CSRF check.
