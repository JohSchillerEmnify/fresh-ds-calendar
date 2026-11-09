/** Module-wide gesture claim: a drag owns the gesture, and swipe navigation stands back. */

/** Module-wide counter: a drag owns the gesture. Swipe navigation checks it (and also sees pointer events stopped). */
let claimed = 0;
export function isGestureClaimed(): boolean {
  return claimed > 0;
}
export const GESTURE_CLAIM_EVENT = 'gesture-claim';

/** Claims the gesture for a drag that does not use the controller (the clock dial) until the returned release runs. */
export function claimGesture(): () => void {
  claimed++;
  window.dispatchEvent(new CustomEvent(GESTURE_CLAIM_EVENT));
  let done = false;
  return () => {
    if (!done) { done = true; claimed--; }
  };
}

/** Takes one claim for a drag controller; pair with {@link dropClaim}. */
export function holdClaim(): void {
  claimed++;
}

/** Gives back a claim taken by {@link holdClaim}. */
export function dropClaim(): void {
  claimed--;
}
