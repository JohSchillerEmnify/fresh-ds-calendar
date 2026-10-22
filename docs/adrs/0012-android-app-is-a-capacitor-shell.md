# 0012 — The Android app is a Capacitor shell that loads the chosen server

- Status: accepted (owner, 2026-10-13; server choice 2026-10-14)
- Views shaped: `androidApp`, `chooseServer`, `prod`

## Context

The owner wants an Android app with a home-screen widget, for two servers: the public one (HTTPS) and the LAN one,
which has no HTTPS. Web changes should reach the phone with every deploy.

## Decision

- The app is a Capacitor shell: its WebView shows the deployed web app of the chosen server, so it updates with every
  deploy without a re-install.
- One app, the server selectable: the two known servers are offered at the first start (the public one first, as
  recommended) and again after Change in the settings; any other address is refused.
- The chosen server is the shell's own app address, so Capacitor's JavaScript bridge, and with it every native plugin
  (widget snapshot, reminders, the settings row), works on either server. A switch rebuilds the shell for the new server.

## Alternatives

- *Trusted Web Activity* — needs HTTPS and a Digital Asset Links file; impossible on the LAN server.
- *A bundled copy of the web app* — its own build and update path, and the API is on another origin anyway.
- *A local chooser page that navigates to the chosen server* (with `allowNavigation`, or `loadUrl`) — Capacitor injects
  its bridge only for the origin of the app address, so on the chosen server every plugin would silently stop working.

## Consequences

- Plain HTTP is allowed for the LAN host only; every other host is HTTPS-only.
- A server switch loses the WebView history.
- Only native changes (widget, shell, plugins) need a new APK.
