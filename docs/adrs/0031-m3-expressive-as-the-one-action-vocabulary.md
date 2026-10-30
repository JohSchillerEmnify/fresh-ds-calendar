# 0031 — Material 3 Expressive is the one action vocabulary

- Status: accepted (owner, 2026-10-30); refines 0020
- Views shaped: `web`

## Decision
- The app uses one action vocabulary, design "E" (Material 3 Expressive): one filled primary per surface (+ button,
  Save, Today), everything else tonal or text; icon-only actions in headers and toolbars with accessible labels; one
  overflow menu per card; Open/Canvas/Archive as a connected button group; list tools in a floating toolbar by the +
  button. Raw buttons outside `web/src/components/m3` are rejected by a lint gate.
- The bottom bar and top bar come in Expressive and Compact sizes; phones default to Compact, tablets and desktop to
  Expressive; the desktop rail has one size. Views may instead sit in a side menu.
- Theme corners shape events and cards only; bars, pills and buttons stay round.

## Alternatives
- *A, labels first* — text on every action: clear, but crowds a phone header and toolbar.
- *B, icons first* — icons everywhere: compact, but unlabelled icons are hard to learn.
- *C, hybrid* — a mix per surface: flexible, but it is the mixed styling the owner wanted gone.
- *E won* because the owner chose it after seeing all four mockups: it keeps icons small and labels where they pay off, and
  gives one rule that a lint gate can enforce.

## Consequences
- Specs: features `ui-expressive`, `nav-expressive`, `header-expressive`, `tasks-toolbar`. The week title loses its day range.
- No structure change in the LikeC4 model: the same `web` components, restyled.
