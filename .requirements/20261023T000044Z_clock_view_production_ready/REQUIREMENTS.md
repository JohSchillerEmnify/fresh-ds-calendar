# Clock view: production ready (no overlapping arcs, readable names) + a "rings" variant

Owner request 2026-10-23 (night run, owner asleep): "Make the clock view production ready, which involves addressing
the issue that separate events overlap each other currently, and the names are not really properly drawn very well,
and some other things. Check the clock view visually, check what you can improve there, and make some assumptions.
This is still an experimental view, so you're good to experiment with it. You may even create a copy of it, or
multiple versions of it, as experimental views, so that we can check how it works."

## As Is

Looked at first: throwaway Playwright probe (scratchpad `clockprobe/probe.cjs`, TEST_MODE server, not in the repo),
2026-10-14 with 13 timed entries — three overlapping (09:00–10:00, 09:30–11:00, 09:45–10:15), back-to-back blocks
(12:00–13:00, 13:00–13:45; 14:00–14:10, 14:10–14:20), 10-minute events, long titles, a 90-minute and a 15-minute timed
task list, an all-day event, an untimed list, an early (06:00) and a night (23:00–23:59) event; phone 375×812 and
desktop 1280×800, light and dark, today (09:40) and another day. Defects seen in the PNGs:

1. **Separate events overlap each other.** Arcs have round caps that reach ~10 minutes past both ends; back-to-back
   events share a ring (the lane rule ignores the caps for two events), so 12:00–13:00, 13:00–13:45, 14:00–14:10 and
   14:10–14:20 fuse into one bar — with one calendar colour nobody can tell where one ends. The overlapping trio at
   09:00–11:00 is drawn on three rings only 3 units apart, so the caps of the inner rings poke into the neighbours and
   the group reads as a tangle.
2. **Many names are missing.** Phone: 7 of 13 arcs have a name; Standup, Call, Lunch, Dentist, Pick up parcel, Quick
   sync and Einkaufsliste have none (the placer drops what fits nowhere). With one colour per calendar an arc without a
   name is anonymous.
3. **Names are far from their arcs.** All labels start inside the innermost ring of the *whole* dial, so a lone outer
   arc's name sits deep inside with a long leader line that crosses other arcs and leaders (Night train → middle,
   Laundry/Gym crossing).
4. **Names collide with the middle and the hand.** "Design review wi…" sits under the clock hand next to the time.
5. **Hard truncation**: 14 characters on a phone ("Dinner with Anna…", "Design review wi…").
6. **Tap targets**: a 10-minute event is a 7-unit (≈6 px) sliver; its hit area is as short as the sliver.
7. **The minimum event length setting is ignored** by the clock (the min-event-length feature says every view that lays
   out time, the Labs views included, treats a shorter entry as that long).
8. The focus wedge (opacity 0.16) is barely visible under the arcs (minor).

Not defects: text is always horizontal (never upside down), contrast of labels (halo) is fine in light and dark, the
dial fills the width on a phone and the height on desktop, the hour numbers are readable, other days look right.

## To Be

**Clock (improved, stays the default Labs clock):**

- Every timed entry is an arc on a *ring*. Two entries share a ring only when their *drawn* spans do not overlap; the
  drawn span is the real span made at least as long as the minimum event length (setting) and at least 15 minutes
  (the clock's snap step: anything shorter is invisible on a 24-hour dial). Arcs have square ends and stop a small gap
  before their neighbours, so back-to-back entries on a ring stay visibly separate. Rings are 20 units apart with a
  4-unit gap; with more than four rings they get thinner so all fit outside the middle.
- Each arc's name is placed on the arc's own angle just inside the innermost arc *at that angle*, moved along the arc
  and at most a few rows inwards until it is free of other names, other arcs and the middle; a short leader line
  joins name and arc. A name that finds no room is **listed next to the dial** with its time ("14:10 Quick sync"), as
  a chip that opens the entry. So every entry's name can be read, and no two names overlap.
- The invisible tap target of an arc is at least as long as its drawn span.
- Wedge a bit stronger (0.22).

**Variant "Clock: rings" (new Labs view `clock-rings`, off by default):** same dial, gestures and middle, but the
rings are wide lanes (tinted band with a solid outer edge, a faint track per ring) and each name is written *along its
ring inside the lane*: it starts at its arc and runs on along the free ring up to the next arc there, flipped on the
lower half so it is never upside down, cut with an ellipsis. An entry that would cut the name before it short goes one
ring further in (lane clearance = the room the name needs); a name with no room for three characters is listed next to
the dial like the Clock. (First try wrote names only inside the arcs: on a 24-hour dial that left "Ni…", "Lu…" —
rejected after looking.)

## Assumptions (owner asleep; recorded, not asked)

- A1 "Separate events overlap each other" = the fused back-to-back arcs and the jammed overlapping trio (defect 1);
  the fix is rings + square ends + a gap, like the strip/timeline lanes.
- A2 "Names not drawn well" = defects 2–5. "Readable" = horizontal text (Clock) or along-the-arc text never upside down
  (rings), at least 11 px on screen, ellipsis when long; a name that fits nowhere is listed next to the dial instead
  of being left out (changes the feature description sentence "one that fits nowhere is left out").
- A3 The clock draws every arc at least 15 minutes long even with the minimum event length Off (a deviation from "drawn
  exactly as long as it lasts", which the min-event-length feature states for the day/week views): at 24 hours per
  turn a 5-minute arc is a dot. Real times (data-start/end, dialog, drag) never change.
- A4 Variants are separate Labs registry entries, default off, so the owner compares them on the phone; one variant
  (rings) is enough for this night — a 12-hour face would change every gesture's angle mapping and is left as a
  follow-up idea unless time allows.
- A5 Labs view names with a colon ("Clock: rings") get the id `clock-rings`; the Labs steps turn a label into an id by
  lower-casing and replacing non-alphanumerics with "-".

## Requirements

- R1 Overlapping entries (by drawn span) are on different rings; no two arcs' drawn bands intersect.
- R2 Back-to-back entries on one ring are drawn with a visible gap between them.
- R3 The minimum event length lengthens an arc's drawn span (and so its ring), never its real times.
- R4 Every timed entry's name is either on the dial (`clock-label`) or listed next to it (`clock-overflow`, with its
  time), and no two names on the dial overlap each other or the middle text.
- R5 Existing clock scenarios stay green (open, labels, task lists, turn, handles, tap to create, middle text, all-day,
  untimed, fills space, navigation).
- R6 Variant "Clock: rings" is a Labs view, off by default, switchable in the settings, routable at `/clock-rings/D`;
  names run along the arcs and are never upside down; R1–R4 hold there too.

## Acceptance Criteria

- AC1 (R1) labs-clock.feature "Overlapping events are drawn on separate rings and never cover each other": Dentist
  09:00–10:00, Review 09:30–11:00, Call 09:45–10:15 → three different rings; no two arcs cover each other (same ring:
  drawn minute spans disjoint; different rings: bands |r1−r2| ≥ (w1+w2)/2).
- AC2 (R2) "Back-to-back events share a ring with a gap between them": Dentist 09:00–10:00 and Lunch 10:00–11:00 →
  same `data-r`, drawn end of Dentist < drawn start of Lunch.
- AC3 (R3) "Very short back-to-back events get separate rings and keep their real times": Pill 11:00–11:05 and
  Vitamins 11:05–11:15 (15-minute floor) → different rings, Pill still an arc from 11:00 to 11:05. "The minimum event
  length counts on the clock too": min 30, Daily A 11:00–11:15 and Daily B 11:15–11:30 → different rings (real times
  with a minimum are pinned by the unit test).
- AC4 (R4) "Every name on a crowded day can be read and no two names overlap": 11 entries incl. a 10-minute pair and
  long titles → every arc has a visible label or overflow chip with its title; label boxes pairwise disjoint and
  disjoint from `clock-now-line`. Unit tests on the placer (no overlaps, labels near their arc, overflow).
- AC5 (R5) targeted e2e of every labs-clock scenario on mobile and desktop green.
- AC6 (R6) labs-clock-rings.feature: off by default / switchable; names along arcs upright; overlap scenario.
- AC7 @visual scenarios green (no unintended change elsewhere); before/after clock PNGs looked at.

## Testing Plan

- Unit (vitest, web/test/calendar/clock.test.ts): drawn spans (min length, 15-minute floor), ring assignment without
  clearance, gap trimming, ring layout compression, label placer (near own arc, avoids arcs/middle/other labels,
  overflow), along-arc label (flip on the lower half, fit/ellipsis).
- e2e (targeted, mobile + desktop): all labs-clock and labs-clock-rings scenarios; @visual.
- Visual: probe screenshots before/after (phone light/dark, other day, desktop light/dark), Read the PNGs.

## Implementation Plan

1. Spec: new scenarios in labs-clock.feature, description updated; labs-clock-rings.feature; STEPS.md; check-steps 0.
2. Steps (labs-clock.steps.ts): ring/cover/gap/readable steps, rings-clock open, label→id slug; red.
3. Unit tests red → clock.ts/geometry.ts: drawn spans, rings, gap, placer v2, along-arc labels → green.
4. ClockView.vue: rings layout, labels v2, overflow chips, min length pref, `variant` prop; router/nav/registry/i18n
   for `clock-rings`.
5. LikeC4 (labsClock description) + validate; ARCHITECTURE pointer if needed.
6. Gates: targeted e2e mobile + desktop, @visual, verify; screenshots after. — one PR-sized unit (branch
   feat/clock-view), commits per step.

## Implementation notes (2026-10-23)

- Layout fix found while looking: on a phone the dial was centred in the space left over and the chips were pushed to
  the screen edges (the bottom ones under the create button). Stacked layouts now size the dial from what the chips
  leave and centre dial + chips as one group, with 64 px kept free at the bottom for the create button.
- Label placer (`placeLabelsNear`): shortest arcs first (they have the fewest places), candidates along the arc's own
  span then ±1 h, up to 4 rows inwards from the innermost arc at that minute; boxes keep 0.3 em sideways so two names
  on a line never read as one; a name with no room is retried at 70 % and 50 % length (≥ 6 characters) before it
  overflows. The middle keep-out is computed from the actual time and now-line text instead of a fixed 190-unit box.
- The 12-hour face variant was not built (A4).
- Evidence: probe PNGs before (`clockprobe/before/`) and after (`clockprobe/final/`) in the session scratchpad.
- Review (code-reviewer) follow-ups applied: the drag/resize preview draws by the same minimum-length rule (it kept
  the old length while resizing); leader lines start on the arc's nearest minute; along-ring names are centred on the
  band (central baseline, no double offset) and fitted at the radius they are drawn at; textPath ids use `useId()`;
  the crowded-day steps require at least half the names on the dial, check the chip text and include the big time.
  Not changed: possible size/overflow feedback on a phone with many chips (no flicker seen; would need hysteresis);
  `nameRoom` uses the outer ring radius (inner rings may still cut a name at the next arc — it ends in an ellipsis).
