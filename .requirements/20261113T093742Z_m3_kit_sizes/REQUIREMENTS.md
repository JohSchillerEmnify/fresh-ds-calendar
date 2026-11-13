# M3 kit sizes and shapes (issue #48, slice: TextField, IconButton, Button, Chip)

## As Is
- TextField: 12 px corners all round, 2 px outline on focus, no bottom active indicator, no outlined variant.
- IconButton: 44 × 44, no 48 px target. Button: 44 px high, corner-large (22 px). Chip: 36 px, 12 px corners,
  rounder (16 px) when selected.

## To Be (material-web token files v0.192)
- TextField filled by default (`_md-comp-filled-text-field`: corner-extra-small-top, active indicator 1 px
  on-surface-variant, 2 px primary when focused, error colour on error); `variant="outlined"`
  (`_md-comp-outlined-text-field`: corner-extra-small, outline 1 px / focus 2 px primary).
- IconButton 40 px drawn (`_md-comp-icon-button` state-layer 40) in a 48 px tap area (material-web
  `iconbutton/internal/_shared.scss` `.touch` 48 px).
- Button 40 px drawn (`_md-comp-filled-button` container-height 40) on a 48 px tap area (material-web
  `button/internal/_touch-target.scss`); round corners.
- Chip 32 px high, 8 px corners (`_md-comp-filter-chip` / `_md-comp-assist-chip`: container-height 32, corner-small).

## Requirements and acceptance
1. Icon buttons can be tapped on ≥ 48 × 48 px — e2e "Every icon button can be tapped on at least 48 by 48 pixels".
2. Text fields show a 1 px bottom line that turns 2 px primary while focused — e2e scenario of the same name.
3. Button/Chip/TextField rules — `web/test/m3-kit-sizes.test.ts` (style rules read from the SFCs; jsdom applies none).

## Assumptions
- The tap area is a transparent 4 px border with `background-clip: padding-box`: the border is hit-tested, while the
  background, the state layer and the ripple (`overflow: hidden` of `.m3-state` clips at the padding box) stay 40 px.
  A pseudo-element target like material-web's `.touch` would be clipped by that `overflow: hidden` and not be tappable.
- Button keeps its horizontal room (`margin-inline: -4px`) and grows 44 → 48 in layout height only.
- Button base corners are corner-extra-large, not corner-full: the #135 guard (touch-css test) forbids a full base
  radius with a pressed radius change, because the animation snaps.
- Shape tokens in `web/src/styles.css` stay as they are (owner question); the chip uses a literal 8 px.
- Chip loses its rounder selected shape: the tokens give one container shape for all states.

## Implementation plan
1. Spec + STEPS + e2e steps; unit test red. 2. Kit CSS. 3. Consumers that resized icon buttons. 4. @visual rebaseline,
   goldens, verify. One PR-sized unit.
