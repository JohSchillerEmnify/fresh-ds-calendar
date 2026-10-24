# Month view performance with a busy month

Owner (2026-10-24): "investigate why month view performance is so slow. I guess since I have a LOT of appointments
throughout the month the rendering becomes quite heavy on the GPU?" (phone: Android Capacitor WebView + Chrome; desktop).

## As Is

Measured on a seeded busy month (454 timed events, 21 task lists, all-day, 6 multi-day, 6 birthdays; 397 chips in the
grid), phone viewport, CPU throttled 4x via CDP, Chrome traces + CPU profiles + layer tree. Throwaway tooling:
scratchpad `mp/measure.mjs`, `mp/seed.mjs`.

Hypotheses and verdicts:

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| c | Forced synchronous layouts in JS | **Confirmed, top** | 1558-1628 forced layouts per load. `v-fade` read `scrollHeight` per cell in `mounted`/`updated` and wrote `data-fade` between reads (245 reads per load, 42 per re-render); every `EventItem` chip ran `useElementSize`, whose mount reads `offsetWidth` (453 ResizeObservers). The `v-ripple` mount inserts a node between the reads, so each read lays the page out again |
| d | Vue reactivity: whole month re-rendered too often | **Confirmed** | `rows` is recomputed 8x on load and 3x for the swipe neighbour. Every fetch, poll or prefetch with unchanged data replaced every item object and segment, so every chip re-rendered. A poll on an unchanged busy month made 130-210 ms long tasks |
| g | The swipe neighbour renders a whole month | Confirmed (by design) | Mounting it in the first `touchmove` is the 400-500 ms task at swipe start. Not changed: it is the carousel spec |
| f | Animations running constantly | Confirmed, global, not month-specific | With the seasonal Halloween scene (default `seasonal: all` in October), the idle main thread is busy 2.4-2.9 s of every 3 s at 4x (empty month too). The cause is SVG keyframe animations that Chrome cannot composite. Without the scene, idle is 0.5 s/3 s |
| e | Too many DOM nodes (hidden overflow) | Confirmed contributor, not changed | 280 of 441 entries (63 %) are fully clipped under the fade but still rendered (about 2860 nodes). Leaving them out would change the DOM and accessibility: the owner decides |
| a | Too many composited layers | Falsified | 55 layers (95 with the scene), 0.6 Mpx; chips get no layers |
| b | Expensive paint per chip (masks, shadows, isolation) | Falsified as the main cause | Removing title masks, isolation or state layers one at a time changed paint and layerize by ≤ 20 % (within noise). Layerize cost scales with the amount of content |
| h | Zoom re-rendering on every pointer move | Not applicable | The month view has no zoom; only Labs "zoom month" does |
| i | Text measuring (measureText / gBCR per title) | Falsified | No `measureText` in the month path; titles are clipped by CSS |

## To Be

Same pixels, same DOM and same behaviour. A month render does one layout read pass instead of one per cell or chip, and
a refresh that changes nothing re-renders none of the entries.

## Requirements

1. The month cell fade (`v-fade`) measures all cells of one render together, after the render and before paint: all
   reads, then all writes.
2. Month chips (`chip`, `allday`, `dot`) do not observe or read their width; time grid blocks still do.
3. The items store keeps the cached object of an item whose refreshed data is unchanged, and keeps its day segments, so
   the views' entry props stay identical.
4. A @perf scenario guards a busy month against regressions (changing months and swiping on a 4x slower processor).

## Acceptance Criteria

1. Unit: after mounting or updating N boxes, nothing is read synchronously; after one microtask the log is N reads,
   then N writes, and `data-fade` is correct.
2. Unit: mounting a chip or all-day entry never reads `offsetWidth`; a block does.
3. Unit: after a refresh with one item unchanged and one changed, the unchanged item and its segment are the same
   objects, and the changed one is new with the new title.
4. e2e: "A busy month renders and swipes smoothly" passes. @visual pictures, goldens and @month scenarios pass without
   re-baselining.

## Testing Plan

Unit (vitest): `web/test/month-measure.test.ts` (1, 2) and `web/test/stores.test.ts` (3), each seen red first. e2e:
the new @perf scenario, then @visual, @month and the goldens. A/B comparison on the laptop with two servers (base and
fix builds), run alternately 6x each.

## Implementation Plan

1. Move `vFade` into `web/src/lib/fade.ts` unchanged (behaviour-preserving), add the tests (red), then batch it (green).
2. `EventItem`: `useElementSize` only for `variant === 'block'` (test red, then green).
3. Items store: reuse unchanged items (JSON-equal) in `applyResponse`; memoise segments per item and `today`
   (`segmentsByDate` takes a `split` function).
4. Spec scenario, steps (busy month fixture, CPU slowdown, long-task measuring) and STEPS.md.
   PR boundary: everything above is one reviewable PR.

## Assumptions (owner asleep)

- "No visual change" rules out removing hidden chips, pausing scene animations, and changing the carousel's neighbour
  mount. These are reported as owner decisions, not done.
- The e2e budget is a regression guard: in the Playwright container the before/after difference (about 12 %) is
  smaller than the run-to-run noise, so no budget separates them reliably. The deterministic guards are the unit tests.
- SYSTEM_DESIGN/architecture are unchanged: the change preserves behaviour and adds only a small `lib/fade.ts` module.

## Results (A/B, laptop, 4x CPU throttle, median of 6 alternating runs; base -> fix)

- Month change (nav button): 708 -> 462 ms until painted (-35 %); its longest task 447 -> 288 ms
- Swipe to next month: main thread 2166 -> 1716 ms; worst frame 434 -> 308 ms; longest task 437 -> 310 ms
- First load: forced layouts 1558 -> 731 (469 -> 304 ms), layout 418 -> 244 ms, longest task 1094 -> 904 ms
- Unchanged-data poll: long tasks 130-210 -> 59-130 ms
