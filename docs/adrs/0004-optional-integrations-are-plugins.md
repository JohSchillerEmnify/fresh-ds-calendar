# 0004 — Optional integrations are plugins: a folder each, loaded only when configured

- Status: accepted (owner, 2026-10-19)
- Views shaped: `server`, `web`, `doorRead`

## Context

The door board is a very custom integration for one household. The repo is going public, so the code may be
in it, but nothing of it may be on by default, and the core should not grow door-shaped corners (ADR 0003 covers
its key). More of this kind will come (other boards, widgets).

## Decision

An optional integration is a **plugin**: one folder per side — `server/src/plugins/<name>/` (routes, service,
README) and `web/src/plugins/<name>/` (the UI bits it adds) — and a **tiny registry** in the core:

- The server keeps a list of plugins; each says whether it is enabled from the config (`enabled(config)`,
  for the door: `DOOR_API_TOKEN` set) and, if so, mounts its routes under `/api/<name>`. A disabled plugin
  mounts nothing: its paths do not exist.
- `GET /api/health` lists the enabled plugins by name. The web reads that list and renders a plugin's UI
  (the door's "Show on door" switch in the list form and the list sheet) only when its name is there.
- Core code may reach a plugin only through the registry and the health list; a plugin may use core
  services (calendar service, task codec) but the core never imports a plugin by name.

## Alternatives

- *Conditional routes inside the core* — least work, but door code spread through routes, forms and sheets
  of a public repo.
- *A separate workspace package per plugin* — the cleanest wall, but build, types and test scaffolding per
  plugin; too much for one folder's worth of code. Can still come later if a plugin outgrows its folder.

## Consequences

- Turning a plugin on is deployment configuration, never a code change or a default.
- The e2e runner enables a plugin for its scenarios the same way the deployment does (its env on the
  TEST_MODE server; a test route may take it away again).
- Each plugin's README says what it needs and what it exposes; the core's docs list the registry only.
