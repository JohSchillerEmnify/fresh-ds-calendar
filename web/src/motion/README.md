# motion + motivation: integration guide

No animation library. WAAPI + CSS `transform`/`opacity`, a hand-written spring solver. Effective level =
min(setting, calm cap, `prefers-reduced-motion`). Particles only at Full. Tests live in `web/test/motion` and
`web/test/motivation` (the vitest `include` is `test/**`). `web/src/features/motivation/MotionLab.vue` is a
playground (mount at `/lab`; no network).

## Shell wiring

```ts
// settings -> motion level (once, e.g. in App.vue setup)
useAnimationLevel(() => settings.animationLevel /* 'full'|'reduced'|'off' */, () => settings.calmMode)
setSoundsEnabled(settings.sounds)           // default off, AudioContext created lazily on first play
```
`useAnimationLevel()` also mirrors the level to `<html data-motion="full|reduced|off">` while a consumer is alive
(call `installMotion()` in main.ts to keep it for the whole session).

Top bar (`TopBar` slots):
- `background`: `<TopBarScene :scene="effectiveScene" />` (`'sunflowers' | 'mordor' | 'none'`, already resolved by the
  shell per spec/API.md "Scenes"). Absolutely positioned, `pointer-events: none`, fills the positioned parent
  (`position: relative`). Reads flowers/mood/bloom from the motivation store (needs Pinia). Optional overrides:
  `flowers`, `mood`, `change`, `fieldMode` (`grow` | `full`, a fixed 30-flower field). Sunflowers: landscape behind the field, butterfly once per session (Full, >= 1 flower). Mordor: eye opens once per
  session (Full), replaces the butterfly. Static at Reduced/Off.
- `leading-widgets`: `<LeadingWidgets :streak-flame="settings.streakFlame" :show-plant="settings.plant" :today="() => appClockLocalDate" />`.
  It starts the store on mount (loads `/api/motivation`, first-open `POST /api/streak/checkin`, re-checks on
  `visibilitychange` when the app-clock day changed) and stops it on unmount. It renders `streak-flame`,
  `plant-button` (+ `plant-card` popover, do not `overflow:hidden` its ancestor), and the `streak-message` toast.
  `showPlant: false` renders no plant button; the sunflower field is a scene and does not depend on it.

After mutations whose response has `X-Motivation-Changed: 1` call `useMotivationStore().refresh()`; the store diffs
and emits `change = { id, kinds: ('water'|'grow'|'bloom'|'perk-up')[] }`, which Plant/SunflowerField play.
Settings page: best streak = `store.motivation.streak.best`.

## motion/ API (`@/motion`)

- `useAnimationLevel(setting?, calm?) -> ComputedRef<MotionLevel>`, `getMotionLevel()`, `setAnimationSetting`, `setCalmMode`.
- `springs` presets, `springAt`, `springEasing(p, v0)` (CSS `linear()` + duration), `Spring1D`, `createVelocityTracker`.
- `animate(el, frames, { spring?, reduced: 'fade'|'skip'|'same' })` (level aware, null at Off), `pop`, `pressRelease`
  (use for FAB press, sheets, dialogs).
- Effects (Full only; one `.reward-layer`; `data-testid="reward-effect"` + `data-kind`; <= 3 concurrent, <= 48
  particles, hard 1200 ms removal): `spawnSparkle(at, {kind})` (tick/bloom/perk-up/grow/streak),
  `spawnConfetti` (list-complete), `spawnBling` (drop), `spawnDroplets` (water), `markEffect(kind, at)`,
  `clearEffects()`. `at` = `{x,y}` client px or an Element.
  The shell must call `spawnSparkle`/`spawnBling` only through these; `eye-open`, `butterfly`, `streak`, `bloom`,
  `grow`, `perk-up`, `water` are spawned by the motivation components themselves.
- `haptic(ms|pattern)` (guarded `navigator.vibrate`), `setHapticsEnabled`.
- `<RewardCheckbox v-model label disabled>`: emits `update:modelValue` + `change` synchronously; sparkle only on
  user tick; testid `reward-checkbox`.
- `<ProgressRing :done :total | :value :size>`: `tasklist-progress-ring`, `data-percent`, `role=progressbar`.
- `useCelebrate(cardElRef).celebrate()`: confetti + card bounce. Call when the last item is ticked (render
  `tasklist-complete-message` yourself).
- Drag and drop (pointer events, own listeners removed on scope dispose):
  ```ts
  useDraggable(elRef, {
    hitTest,                      // (x, y, ctx) => { key, dx?, dy? } | null   (snapped target)
    onDrop: async (t) => { /* apply optimistic move first, then await PATCH; throw to spring back */ },
    onTarget?: (t) => void,       // drive a drop indicator
    onStateChange?, disabled?, touchDelay = 350, touchSlop = 8, mouseSlop = 4,
    optimistic = true,            // false: card stays on the slot until onDrop resolves
    scrollEl?: () => HTMLElement  // edge auto-scroll
  })
  createSlotGrid({ rect, columns, pxPerMinute, gutter?, step = 15, startMinutes? })  // key {column, minutes}
  createCellGrid({ cells: () => [{ el, key }] })                                     // month/all-day cells
  useDropGrid({ kind: 'slots' | 'cells', ... }) -> { hitTest }
  isGestureClaimed()   // true while a drag owns the pointer; also window event 'gesture-claim' on pick-up
  ```
  Give draggable cards `touch-action: none` only if scrolling inside is not needed; on touch the long-press
  (350 ms, <8 px) happens first; a move while still pending is never prevented (scroll wins). The card has its own
  non-passive `touchmove` listener from mount (iOS decides at touchstart whether a touch's moves can stop scrolling,
  from the listeners present then) and blocks scroll with it once lifted. While a touch drag is lifted its scroll
  container (`scrollEl`) has `overflow-y: hidden` (edge auto-scroll still scrolls it), and `selectstart` and
  `contextmenu` are prevented from press to release. While dragging, window-capture listeners stop `pointermove/up`
  propagation, so swipe navigation (bubble phase) never sees them; the swipe handler should also bail when
  `isGestureClaimed()`. Data attr `data-dragging="true|false"` on the card. Escape springs back. `pointercancel`
  springs back, except for a press that sent touch events (the browser started its own pan, iOS): that drag follows the
  same finger's touch events to `touchend` (drop) or `touchcancel` (spring back). The click on the card right after a
  drop is swallowed on window capture for 400 ms.

## features/motivation API (`@/features/motivation`)

`StreakFlame {count, pulse}`, `StreakToast {message}`, `Plant {stage 0-4, mood, size, change}`, `PlantCard {plant, change}`
(emits `close`), `SunflowerField {flowers, mood, change}` (15 max < 600 px, 30 otherwise, label always the full count),
`Butterfly {container}` (emits `done`), `MordorScene {intro}`, `SunflowerScene`, `TopBarScene`, `LeadingWidgets`,
scene registry `scenes`, `useMotivationStore`, `onceFlag(key)` (sessionStorage once-per-session).
`SupportCat {card, level}` (emits `done`; ≈3 s at Full, 2 s at Reduced, never mounted at Off) is mounted by
`TaskListView` when a tick finishes the list and `catComes()` (`supportCat.ts`: chance 0.1, prefs `supportCat`
`off|sometimes|always` — `always` skips the roll — test hook `window.__catNext` in test mode) says so. `CatFigure
{pose}` is the one cat drawing; `SupportCat` and the scene cat `SceneCat` animate its named parts.
Test ids: `streak-flame`, `streak-message`, `plant-button` (`data-stage`, `data-mood`), `plant-card`,
`plant-card-stage`, `plant-card-line`, `sunflower-field` (`data-mood`, `data-sway`), `sunflower`, `scene-mordor`,
`sauron-eye`, `top-bar-scene`, `reward-effect[data-kind]`, `support-cat`.
