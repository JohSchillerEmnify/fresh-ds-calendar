# 0030 — Open apps hear about changes through Server-Sent Events

- Status: accepted (2026-10-30) (owner decision 2026-10-30: "an event-based system where each instance subscribes to the events
  from the server, and the server can publish an event on edit"); refines 0025
- Views shaped: `web`, `syncingTheDeviceStore`, `liveSync`

## Decision
- Every open, visible app keeps one Server-Sent Events connection (`EventSource`, session cookie). On every change that
  goes through our server the server publishes a content-free `changed` nudge to every open app of the affected
  person, and of every member of a shared list. The app then asks for "changes since" its cursor (0025); no data
  travels on the stream, so nothing needs filtering per device. Target: under about a second between devices.
- Changes made in Google Calendar itself: while at least one app of a person is connected, the server asks Google for
  changes every 20 s (sync token) and publishes a nudge when there are any. With no app open it does not ask.
- Safety net unchanged: sync on open, focus, reconnect and a 60 s poll while visible. `EventSource` reconnects by
  itself; a hidden app drops the connection and polls not at all, and syncs at once when shown.
- One server instance: publish/subscribe lives in memory. Several instances would need a shared broker (e.g. Redis
  pub/sub) so a change on one reaches subscribers on the others.

## Alternatives
- *WebSocket* — two-way, but we only push one way (writes stay plain requests); needs its own upgrade handling, no
  automatic reconnect, and is more often broken by proxies. SSE is plain HTTP and the browser reconnects.
- *Google push (watch channels)* — needs a public HTTPS callback, channel renewal and one channel per calendar per
  person, and the notice can lag; a 20 s lookup while an app is open is simpler and within the rate guard (0007).
- *Shorter polling (e.g. every 5 s)* — still seconds late, and a constant load on the server and on Google for every
  open app, also when nothing changed.

## Consequences
- Each open app holds one long request; the reverse proxy must not buffer or time out `text/event-stream`
  (`docs/DEPLOYMENT.md`), with a keep-alive comment every 25 s.
- A nudge sent while an app is offline is lost; the reconnect sync closes that gap.
