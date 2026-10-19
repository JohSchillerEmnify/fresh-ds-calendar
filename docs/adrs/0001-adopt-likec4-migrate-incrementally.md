# 1. Adopt LikeC4 for architecture, migrate incrementally

- Status: accepted
- Date: 2026-10-19

## Context

The architecture lived as prose in `spec/ARCHITECTURE.md` (~2575 lines). We want
architecture-as-code: one model, generated views, a runtime view per flow.

## Decision

Adopt LikeC4 under `docs/architecture/`. New architecture is modelled there. The existing
`spec/ARCHITECTURE.md` migrates in **incrementally** — a part is ported when it is next
touched — rather than in one big-bang rewrite. Until a part is ported, the prose stays its
source of truth.

## Consequences

- The two-row week overview is the first slice in the model (views: `index`, `web`,
  `turnOnOverview`).
- For a while two places hold architecture; the migration debt is paid down per touched part.
  A separate backlog item tracks finishing the migration.
