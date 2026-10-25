# Touch drag and drop on phones (bug, owner report 2026-10-25)

## As Is
- iPhone (Safari / home-screen web app): dragging an item does not move it in any view.
- Android: dragging in the month view does not work (day and week work).
- `useDraggable` (web/src/motion/drag.ts): touch picks up after a 350 ms long press within 8 px. The non-passive
  `touchmove` guard that calls `preventDefault()` is added to `window` only on `pointerdown`, and only prevents once
  the card is lifted. `pointercancel` while lifted springs the card back.
- Month view: cells and the entries box clip (`overflow: hidden`, fade mask), so a lifted chip is invisible as soon as
  it leaves its own cell (seen in Chromium: screenshot mid-drag shows only the drop highlight).

## Root cause (evidence in the task report)
1. WebKit iOS decides at `touchstart` whether touch moves are dispatched preventable: only when a non-passive
   `touchmove` listener on the touched path exists at that moment (EventTrackingRegions; WebKit bugs 184250, 185656
   "dynamically added touch event listeners will initially be treated as passive"). The month view has none, so the
   drag's `preventDefault()` is ignored and the page pan starts; WebKit then sends `pointercancel`
   (`WKWebView axesToPreventScrollingForPanGestureInScrollView` -> `cancelPointersForGestureRecognizer`), which drops
   the drag. In day/week the time grid's pinch listener makes the area preventable.
2. WebKit decides whether the page may stop the pan from the first `touchmove` of the touch
   (`WebPageProxy::m_touchMovePreventionState`, `_touchMoveDeferringGestureRecognizer`). A real finger moves a little
   during the 350 ms hold, that first move is not prevented (the card is not lifted yet), so the pan is allowed and
   starts as soon as the lifted card is moved: `pointercancel`, drag dropped. This hits every view. (Not verifiable
   without a device; derived from the WebKit source.)
3. Month view: the lifted chip is clipped by its cell (all platforms).

## To Be
- A long press and drag moves events in day, week and month views on iPhone-like (WebKit) and Android-like (Chromium)
  phones.
- A quick swipe that starts on an event still scrolls (8 px slop unchanged); mouse drag, resize handles, swipe between
  periods and wheel-while-dragging unchanged.

## Requirements
1. Every draggable card has a non-passive `touchmove` listener from mount, so touch moves that start on it can be
   prevented once it is lifted.
2. A touch drag survives `pointercancel` while lifted: it follows the touch events (`touchmove`/`touchend`) to the drop;
   `touchcancel` still cancels.
3. While a touch drag is lifted, its scroll container does not scroll natively (`overflow: hidden` inline until the drag
   ends); edge auto-scroll keeps working programmatically.
4. In the month view the lifted chip is drawn above the other cells, not clipped by its cell.

## Acceptance Criteria
1. AC1/AC2/AC3: the new `@iphone` scenarios (day, week, month) pass in the `iphone` project (WebKit, iPhone 13) whose
   touch model follows the WebKit rules above; they also pass on the `mobile` project (Chromium, real CDP touch).
2. AC4: "the dragged event is drawn under the finger" in the month view on both phone projects.
3. Existing dnd/resize/swipe/month scenarios stay green on mobile and desktop; `@visual` unchanged.

## Testing Plan
- e2e: new project `iphone` (grep `@iphone`), WebKit finger model in `e2e/steps/support/iosTouch.ts` (listener
  tracking init script + WebKit rules, documented in STEPS.md). Scenarios red before the fix, green after.
- Unit (vitest): drag controller registers a non-passive touchmove on the element at creation; continues after
  pointercancel from touch events; locks/unlocks the scroll container.
- Gates: `pnpm --silent verify`; targeted e2e (dnd, resize, swipe, month) on mobile + desktop + iphone; `@visual`.

## Implementation Plan
1. Spec + steps + iphone project; reproduce red. -> run new scenarios.
2. drag.ts: element touchmove listener, pointercancel touch fallback, scroll lock (unit tests first). -> vitest, e2e.
3. Month CSS: lifted chip not clipped. -> e2e month scenario + @visual.
One PR (single bug fix).

## Assumptions
- Android month failure could not be reproduced in Chromium emulation (drop works there); its visible symptom there is
  the chip vanishing mid-drag (3). Fix 1 also makes the month touch region blocking on Chrome.
- Android day view "to the next day sideways" is new behaviour, not built (see report).
