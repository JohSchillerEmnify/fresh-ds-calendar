# 0010 — Backups go to each person's hidden Drive app folder

- Status: accepted (owner, 2026-10-13)
- Views shaped: `server`, `backupAfterChange`, `restoreAtSignIn`

## Context

Since ADR 0005 the server keeps app data of its own (preferences, themes, canvas, shared lists, categories). Losing the
VPS would lose it. Each person already signs in with Google (ADR 0008).

## Decision

- Each person's server data is backed up to the hidden app folder of **their** Google Drive (`drive.appdata` scope,
  asked for in the same consent as the calendar). The app sees only that folder, the person cannot delete a backup
  by accident, and the scope needs no extra Google verification.
- Backups run after changes once the person stops for a while, once a day even without changes, and on request; the
  last 7 versions are kept. Someone with nothing of their own gets none, so an empty backup never pushes good ones out.
- Restore runs by itself at sign-in on a server with nothing of the person's, or on request after a safety backup
  (so restoring again undoes it). Server-wide files come back only onto a server where none of them was touched yet,
  so one person's restore never overwrites what others use.
- A backup never blocks normal use: it runs outside the request, and a failure shows in Settings and is retried.

## Alternatives

- *A visible Drive folder (`drive.file`)* — more access than needed, and files the person can break.
- *A backup on the same server* — no use when the server is lost.

## Consequences

- Without the Drive permission there is no backup; Settings asks for it.
- Secrets (the Google token) never leave the server.
