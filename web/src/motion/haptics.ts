/** Haptics helper: guarded `navigator.vibrate` (Android only; iOS Safari has none). */
let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Short tick. Returns true when a vibration was requested. Never throws. */
export function haptic(pattern: number | number[] = 10): boolean {
  if (!enabled || !canVibrate()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
