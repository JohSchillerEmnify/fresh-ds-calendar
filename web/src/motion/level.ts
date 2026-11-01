/**
 * Animation level: Full / Reduced / Off.
 *
 * Effective level = min(user setting, calm mode cap, system `prefers-reduced-motion` cap unless `ignoreSystemMotion`).
 * One module-wide reactive value so non-component code (effects, DnD) can read it cheaply.
 * The system media-query listener is ref-counted: it only exists while at least one
 * `useAnimationLevel()` / `installMotion()` consumer is alive.
 */
import { computed, getCurrentScope, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';

export type MotionLevel = 'full' | 'reduced' | 'off';

const ORDER: Record<MotionLevel, number> = { off: 0, reduced: 1, full: 2 };

function minLevel(a: MotionLevel, b: MotionLevel): MotionLevel {
  return ORDER[a] <= ORDER[b] ? a : b;
}

const setting = ref<MotionLevel>('full');
const calm = ref(false);
const ignoreSystem = ref(false);
const systemReduced = ref(readSystemReduced());

function readSystemReduced(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Whether the device currently asks for less motion (read-only). */
export const systemReducedMotion = computed(() => systemReduced.value);

/** Effective motion level (read-only). */
export const motionLevel = computed<MotionLevel>(() => {
  let l = setting.value;
  if (calm.value) l = minLevel(l, 'reduced');
  if (systemReduced.value && !ignoreSystem.value) l = minLevel(l, 'reduced');
  return l;
});

/** Plain getter for hot paths. */
export function getMotionLevel(): MotionLevel {
  return motionLevel.value;
}

export function setAnimationSetting(level: MotionLevel): void {
  setting.value = ORDER[level] === undefined ? 'full' : level;
}

export function setCalmMode(on: boolean): void {
  calm.value = !!on;
}

function setIgnoreSystemMotion(on: boolean): void {
  ignoreSystem.value = !!on;
}

/** Test hook: override the system preference without a media query. */
export function __setSystemReducedForTest(v: boolean): void {
  systemReduced.value = v;
}

// ---- ref-counted system listener + <html data-motion> mirror ----
let users = 0;
let stopSystem: (() => void) | null = null;

function startSystem(): () => void {
  systemReduced.value = readSystemReduced();
  const stopAttr = watch(
    motionLevel,
    (l) => {
      if (typeof document !== 'undefined') document.documentElement.dataset.motion = l;
    },
    { immediate: true },
  );
  let mql: MediaQueryList | null = null;
  const onChange = (e: MediaQueryListEvent) => (systemReduced.value = e.matches);
  try {
    if (typeof matchMedia === 'function') {
      mql = matchMedia('(prefers-reduced-motion: reduce)');
      mql.addEventListener?.('change', onChange);
    }
  } catch {
    mql = null;
  }
  return () => {
    stopAttr();
    mql?.removeEventListener?.('change', onChange);
  };
}

function retain(): () => void {
  if (users++ === 0) stopSystem = startSystem();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--users === 0) {
      stopSystem?.();
      stopSystem = null;
    }
  };
}

/** Starts the motion system outside a component (e.g. in main.ts). Returns a stop function. */
export function installMotion(): () => void {
  return retain();
}

/**
 * Component composable. Optional `settingLevel` / `calmMode` are pushed into the module state
 * (the shell passes the persisted settings; leaf components call it without arguments).
 * Returns the effective level as a computed ref.
 */
export function useAnimationLevel(
  settingLevel?: MaybeRefOrGetter<MotionLevel | undefined>,
  calmMode?: MaybeRefOrGetter<boolean | undefined>,
  ignoreSystemMotion?: MaybeRefOrGetter<boolean | undefined>,
) {
  const release = retain();
  const stops: (() => void)[] = [];
  if (settingLevel !== undefined) {
    stops.push(
      watch(
        () => toValue(settingLevel),
        (v) => v && setAnimationSetting(v),
        { immediate: true },
      ),
    );
  }
  if (calmMode !== undefined) {
    stops.push(watch(() => toValue(calmMode), (v) => setCalmMode(!!v), { immediate: true }));
  }
  if (ignoreSystemMotion !== undefined) {
    stops.push(watch(() => toValue(ignoreSystemMotion), (v) => setIgnoreSystemMotion(!!v), { immediate: true }));
  }
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stops.forEach((s) => s());
      release();
    });
  }
  return motionLevel;
}

/** Number of live consumers (tests assert listeners are released). */
export function __motionUsers(): number {
  return users;
}
