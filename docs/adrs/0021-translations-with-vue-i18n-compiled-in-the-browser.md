# 0021 — Translations with vue-i18n, messages compiled in the browser

- Status: accepted (owner, 2026-10-13)
- Views shaped: `web`

## Context

The app gets German, two fun languages and English. The first-load budget is tight, and the server already sends
English error texts.

## Decision

- The web app uses vue-i18n (Composition API) behind a typed `t()`; UI code never imports vue-i18n directly.
- Messages are compiled in the browser by vue-i18n's own compiler.
- The server never translates: a user-facing validation error carries a message key from the web catalogue; the
  web app shows the translation, other errors stay English.

## Alternatives

- *Precompiling with `@intlify/unplugin-vue-i18n`* — built and measured: vue-i18n still needs its code generator, so
  the first load grew by 1.7 kB.
- *Removing the compiler registration by a hook* — saved 3.4 kB but broke the production build; patched vendor code
  rejected.
- *Function messages or a minimal formatter instead of vue-i18n* — smaller, but the owner fixed vue-i18n.

## Consequences

- About +17 kB on the first load (composer and compiler).
- Catalogue strings may use the full message syntax; `{`, `}`, `@` and `|` must be escaped.
