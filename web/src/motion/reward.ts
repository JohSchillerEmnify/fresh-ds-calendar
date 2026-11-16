import { onBeforeUnmount } from 'vue';
import { getMotionLevel } from './level';
import { animate } from './animate';
import { spawnSparkle } from './effects';
import { haptic } from './haptics';
import { springs } from './spring';

/** The reward of a user's tick: haptic tap, springy pop, the mark drawing itself (Full only) and a sparkle, played on
 * the element holding the `.rcb-check` glyphs; running animations stop on unmount. */
export function useRewardTick(): { play: (box: HTMLElement | null) => void } {
  let anims: Animation[] = [];
  onBeforeUnmount(() => anims.forEach((a) => a.cancel()));
  function play(box: HTMLElement | null) {
    haptic(8);
    const level = getMotionLevel();
    if (level === 'off') return;
    anims.forEach((a) => a.cancel());
    anims = [];
    const pop = animate(box, [{ transform: 'scale(0.78)' }, { transform: 'scale(1)' }], { spring: springs.pop });
    if (pop) anims.push(pop);
    // the mark is drawn by whichever glyph the theme shows; the others are display: none and ignore the animation
    if (level === 'full') {
      for (const p of box?.querySelectorAll<SVGPathElement>('.rcb-check') ?? []) {
        if (typeof p.animate === 'function') anims.push(p.animate([{ strokeDashoffset: 24 }, { strokeDashoffset: 0 }], { duration: 260, delay: 40, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'backwards' }));
      }
    }
    if (box) spawnSparkle(box);
  }
  return { play };
}
