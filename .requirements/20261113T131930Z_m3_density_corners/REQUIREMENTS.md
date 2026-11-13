# M3 density and shape scale (issue #48)

## As Is
- The theme Density (compact 0.9 / comfortable 1 / airy 1.12, `--dz`) scales only font sizes and the list row height.
- Kit controls have fixed heights (buttons, icon buttons, segmented 40 px; fields 56 px; chips 32 px).
- Shape tokens are 6/12/16/22/32 px; the chip has a literal 8 px corner.
- The event dialog reads "Calendar default:no reminders".

## To Be
1. One density shift `--md-density-shift` (theme `fineVars`: Material density step × 4 px; compact −2, comfortable 0,
   airy +1) moves every kit control's container height. Source: material-components-web
   `packages/mdc-density/_density.scss` (`$interval: 4px`, value = default + scale × interval); material-web lists
   density only on its roadmap (`docs/roadmap.md`).
2. Comfortable = today's M3 sizes. Text fields never go under 52 px (MDC `mdc-textfield/_variables.scss`
   `$minimum-height-for-filled-label`), list rows never under 48 px.
3. Tap areas stay at least 48 × 48: buttons and icon buttons by their transparent border (grows as the drawing
   shrinks); segmented buttons by a transparent border given back by the margin (overlaps, takes no room);
   checkbox, radio and switch by their fixed 48 px box.
4. Shape tokens = material-web tokens v0.192 `_md-sys-shape.scss`: 4, 8, 12, 16, 28, full. Theme corners
   (`--r-chip`, `--r-block`, checkbox `--cb-rx`) are separate variables and do not change.
5. "Calendar default: …" has a space after the colon.

## Assumptions
- Compact = two Material density steps (−8 px): the owner asked for clearly compact tabs; one step (−4 px) would barely show.
- Airy grows one step (+4 px), following the list row which already grew with Airy.
- The switch track keeps its M3 size; only its tap box is fixed to 48 px (was 44).

## Testing
- Unit: `web/test/m3-kit-sizes.test.ts`, `web/test/theme-fine.test.ts`, `web/test/reminder-editor.test.ts`.
- e2e: the new `ui-expressive` density and corner scenarios; the `@visual` set (mobile + desktop) and goldens.
