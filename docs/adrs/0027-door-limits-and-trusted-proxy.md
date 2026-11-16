# 0027 — Door limits and the trusted proxy

- Status: Moved to the door repository 2026-10-30 (accepted, owner, 2026-10-30); hardens ADR 0003. The door limits and the `TRUST_PROXY` switch left the calendar with the plugin.
- Views shaped: `server`

## Decision
- **Key**: `DOOR_API_TOKEN` must have at least 32 characters. A shorter key keeps the door off, is logged
  (`door_key_too_short`) and warned on the console. The key is compared in constant time (hashed first).
- **Rate limit**: 60 asks a minute per client, then `429 RATE_LIMITED`. At most 1000 clients are counted; newcomers
  beyond that share one counter, and expired counters go first, so a flood never frees a client over its limit.
- **Who is the client**: the socket's address. Only with `TRUST_PROXY=1` (Caddy in front) it is the LAST
  `X-Forwarded-For` entry, the one the proxy appended; without it the header is the caller's own claim and is ignored.
- **Person**: a door person taken off `ALLOWED_EMAILS` gets no board (`503`), like every other removed person.

## Alternatives weighed
- **No limit** (one trusted machine client): the key is the only secret on a public URL; unlimited guessing is not
  acceptable even for a long key.
- **First `X-Forwarded-For` entry**: the caller writes it, so rotating it would buy unlimited asks.
- **Always trust the header**: breaks the same way when the app is reached without the proxy (local run).
- **One global counter**: a stranger could lock the real board out.

## Why
The door is the one endpoint with a bearer key instead of a session. Cheap limits and a minimum length make guessing
hopeless; the proxy switch is explicit because only the operator knows whether a proxy sits in front.
Tests: `server/test/hardening-door.test.ts`. Spec: `spec/features/door/door-board.feature`, `spec/API.md` (door).
