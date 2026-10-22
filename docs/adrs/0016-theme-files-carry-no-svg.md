# 0016 — Theme files carry no SVG; an own picture is sanitised twice and shown only as an image

- Status: accepted (owner, 2026-10-13)
- Views shaped: `importOwnTheme`

## Context

People bring themes made by any AI chat and may add their own top bar picture. A theme comes from outside the app, so
it is untrusted input that ends up on every page of the person's calendar.

## Decision

- A theme is a `calendar-theme/2` JSON document of simple fields only; a scene in it is a built-in name or a gradient
  with a decor the app draws itself. The document never contains SVG.
- An own picture (light and optional dark SVG, ≤ 100 KB each) is kept next to the document, sanitised with an SVG
  allow-list on the server and again in the browser (no scripts, styles, foreign objects, external references or
  event handlers), and rendered only as an image, never inlined; what was removed is reported.
- The server validates and sanitises again on save and on a backup restore.

## Alternatives

- *SVG scene inside the document* (`calendar-theme/1`, never released) — real AIs broke raw SVG inside JSON:
  unescaped quotes, chat programs turning URLs into Markdown links, missing closing tags.
- *Inlining the picture* so it could use theme colours — rejected for safety: an image cannot run code even if the
  sanitiser misses something.

## Consequences

- An own picture carries its own colours (a missing dark variant falls back to the light one).
