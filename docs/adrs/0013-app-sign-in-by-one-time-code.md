# 0013 — App sign-in runs in the system browser and comes back by one-time code

- Status: accepted (owner bug "invalid state", 2026-10-14; bound to the app 2026-10-16)
- Views shaped: `signInFromApp`

## Context

Capacitor opens every navigation to another host in the system browser, so the Google round trip started in the app
ended in Chrome without the app's state cookie ("Invalid state"), and the session would have landed in Chrome. Google
refuses OAuth inside an embedded WebView. Chrome and the WebView share no cookies.

## Decision

- The app opens the sign-in start in the system browser (a Custom Tab); the whole Google round trip runs there.
- Instead of a cookie, the server answers the callback with a deep link into the app carrying a single-use, 60-second
  one-time code; the app exchanges the code in its WebView for the normal session.
- The code is bound to the app (RFC 7636 style): the app sends only the hash of a random verifier at the start and must
  show the verifier at the exchange, so a code caught by another app or sent in a link is useless.
- The browser sign-in is unchanged.

## Alternatives

- *`@capacitor/browser`* — a new dependency and a bridge call from every sign-in entry point, for the same effect.
- *AppAuth with a native redirect* — Google's Android client type would need a second OAuth client and token handling in
  the app, while the server holds the refresh tokens by design.
- *`@capacitor/app` `appUrlOpen`* — a second dependency; the activity gets the deep link natively anyway.

## Consequences

- APKs from before the verifier cannot start a new sign-in (existing sessions keep working); they must update.
- The server keeps exchange codes in memory only: a restart in the 60 s window means signing in again.
