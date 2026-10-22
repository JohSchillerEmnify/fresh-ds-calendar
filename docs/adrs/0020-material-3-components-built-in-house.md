# 0020 — Material 3 components are built in-house on design tokens

- Status: accepted (owner, 2026-10-12)
- Views shaped: `web`

## Context

The app follows Material 3 (Expressive) on phone first, under a first-load JavaScript budget (initial JS ≤ 150 kB
compressed). No official M3 Expressive library exists for the web or Vue.

## Decision

The web app builds its M3 components itself on CSS design tokens; the colour scheme is generated from the person's
seed colour at runtime. No component library. Navigation rail on desktop, navigation bar on phones.

## Alternatives

- *Vuetify (md3 blueprint)* — about 112 kB gzip, M3 baseline only, not Expressive.
- *PrimeVue (Material preset)* — about 89 kB plus runtime style injection; M3-like only.
- *`@material/web`* — real M3 (44 kB), but in maintenance mode, no nav bar outside Labs, Shadow DOM limits styling.

## Consequences

- Hand-rolled components cost about 10–25 kB and look exactly M3 Expressive, but every component is ours to maintain.
