# Week in one or two rows per screen size (issue 192)

## As Is
Prefs `weekTwoRow` (bool, false) and `weekTwoRowTop` (3|4, 4) in shared/prefs.js; a Labs switch; one choice for every device.

## To Be
Two separate personal choices, phone and tablet/desktop; one row on both until changed; one shared split; leaves Labs.

## Owner decisions (ask box)
- "Per device size": two choices, phone and tablet/desktop, per person, leaving Labs.
- Default "One row everywhere": one row on both sizes until changed.
- Split "One shared": one "Days on the top row" for both sizes.

## Requirements
1. Separate choice per size, default one row for both.
2. The split is one value for both sizes (owner decision).
3. The switches leave Labs (owner decision).

## Assumptions (spec proposals, open)
- Proposal: the window width decides, live on resize.
- Proposal: old `weekTwoRow: true` becomes both sizes on (planned read-time migration).
- Boundary: the existing PHONE_QUERY (up to 767.98 px); a landscape large phone counts as a tablet.
- Placement Settings › Views and the labels; split row shown while either size has two rows; pref names set at build.
- A mockup comes first (design canvas); placement and labels stay open until it is agreed.

## Acceptance
The @backlog scenarios in spec/features/views/week-two-row.feature.

## Testing plan
Unit test for the migration and prefs validation; e2e for the new scenarios; @visual for the Views settings rows.

## Implementation plan
1. Prefs keys and migration (shared/prefs.js, prefs store).
2. WeekView.vue and App.vue read the pref for the current size (isPhone).
3. Settings catalog and Views group rows, en/de texts per docs/UI-TEXTS.md; remove the Labs rows.
4. Update docs/settings-audit.md; CHANGELOG bullet.
