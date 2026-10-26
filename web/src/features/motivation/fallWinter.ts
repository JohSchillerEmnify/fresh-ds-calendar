/**
 * Where the Fall and Winter props, the cat, the kite, the visitors and the resting particles sit (feature
 * theme-scenes, round 3 mockups approved 2026-10-26; art and spots from `fwart.cjs` / `fw.cjs`). The spots are pixels
 * of the bar at the mockup's width per layout: `H0` the phone bar as built (390 px wide, 96 px tall), `T` the tablet
 * (820 x 60) and `D` the desktop (1280 x 60). On another width a spot keeps its distance to the nearer bar edge, as
 * the controls do (title and arrows at the left, widgets and buttons at the right); see {@link anchor}.
 */

/** A bar layout the spots are drawn for. */
export type SceneLayout = 'H0' | 'T' | 'D';

/** The mockup bar of each layout: width and height (px). */
export const BAR: Record<SceneLayout, { w: number; h: number }> = { H0: { w: 390, h: 96 }, T: { w: 820, h: 60 }, D: { w: 1280, h: 60 } };

/** The layout of a bar `width` px wide (phone below 768 px like the bar's own layout, tablet below 1100 px). */
export function layoutFor(width: number): SceneLayout {
  return width < 768 ? 'H0' : width < 1100 ? 'T' : 'D';
}

/** A prop that stands on the bar's bottom edge. `h` is its drawn height (px). */
export type PropKind = 'autumn-tree' | 'leaf-pile' | 'snowy-tree' | 'snowman' | 'sledge';
export interface Prop { kind: PropKind; x: number; h: number; side?: Side }
/** The bar edge a spot keeps its distance to. */
export type Side = 'left' | 'right';

/** Width / height of each drawing. */
export const ASPECT: Record<PropKind, number> = { 'autumn-tree': 0.8, 'snowy-tree': 0.8, 'leaf-pile': 3, snowman: 26 / 32, sledge: 34 / 13 };

const tree = (x: number, h: number): Prop => ({ kind: 'autumn-tree', x, h });
const pile = (x: number): Prop => ({ kind: 'leaf-pile', x, h: 13 });
const stree = (x: number, h: number): Prop => ({ kind: 'snowy-tree', x, h });
const snowman = (x: number, side?: Side): Prop => ({ kind: 'snowman', x, h: 42, side });
const sledge = (x: number): Prop => ({ kind: 'sledge', x, h: 13 });

/** The props per scene and layout (left edge in mockup px), back to front. */
export const PROPS: Record<'fall' | 'winter', Record<SceneLayout, Prop[]>> = {
  fall: {
    H0: [tree(158, 52), pile(190), pile(232), tree(273, 62)],
    T: [tree(336, 46), pile(540), tree(572, 56), pile(603)],
    D: [tree(336, 46), tree(545, 56), tree(578, 46), pile(620), pile(678), tree(840, 56), pile(886), tree(960, 46), tree(990, 56), pile(1050)],
  },
  winter: {
    // the snowman stays beside the cat (both from the left), so on a narrow phone it does not stand behind it
    H0: [snowman(188, 'left'), sledge(224), stree(270, 64)],
    T: [stree(336, 46), snowman(540), stree(578, 56), sledge(610)],
    D: [stree(336, 46), snowman(548), sledge(586), stree(660, 56), stree(692, 46), stree(820, 56), stree(930, 46), stree(960, 56), stree(1050, 46)],
  },
};

/** The cat's left edge per scene and layout (mockup px): Fall H0 moves next to the kite, the tablet cat out from under Today. */
export const CAT_X: Record<'fall' | 'winter', Record<SceneLayout, number>> = {
  fall: { H0: 240, T: 512, D: 717 },
  winter: { H0: 156, T: 512, D: 512 },
};

/** The kite's top-left corner (mockup px; 16 x 20 plus its tail); its string runs to the cat's front paw. */
export const KITE: Record<SceneLayout, { x: number; y: number }> = { H0: { x: 293, y: 2 }, T: { x: 540, y: 2 }, D: { x: 790, y: 2 } };

/** The cat's drawn height in a bar `h` px tall (SceneLife: `min(44cqh, 30px)`, standing 1 px below the edge). */
export const catHeight = (h: number) => Math.min(0.44 * h, 30);

/** The height of the bird flock's flight above the bar's top edge (px): in the gap between the rows on a phone, above the title on wide bars. */
export const FLOCK_Y: Record<SceneLayout, number> = { H0: 42, T: 4, D: 4 };

/** Where the robin perches: on the sledge (left edge, mockup px). */
export const ROBIN_X: Record<SceneLayout, number> = { H0: 232, T: 618, D: 592 };

/** The particles' sizes (px, by index) and their resting rotations (degrees). */
export const PARTICLE_SIZE = [5, 7, 9, 5, 7, 9, 5, 7, 9];
export const PARTICLE_TURN = [20, -30, 80, 140, -20, 10, 60, -40, 30];

/**
 * The resting spots of the nine particles: top-left corner [x, y] in mockup px of the bar (fw.cjs `placeParticles`;
 * the leaves on the ground and at the top edge moved 1-2 px so a turned leaf stays inside the bar).
 */
export type Spot = [number, number];
export const STILL: Record<'fall' | 'winter' | 'christmas', Record<SceneLayout, Spot[]>> = {
  fall: {
    H0: [[290, 23], [14, 53], [164, 85], [371, 53], [272, 77], [35, 85], [365, 3], [209, 47], [365, 84]],
    T: [[563, 3], [320, 41], [14, 49], [800, 8], [683, 3], [167, 49], [389, 3], [623, 41], [485, 48]],
    D: [[767, 3], [1259, 5], [14, 49], [386, 3], [1025, 41], [575, 49], [887, 41], [1133, 3], [209, 48]],
  },
  winter: {
    H0: [[206, 47], [14, 53], [368, 2], [296, 38], [368, 53], [260, 77], [137, 56], [308, 2], [188, 77]],
    T: [[563, 2], [320, 41], [797, 5], [680, 2], [389, 2], [620, 41], [485, 41], [719, 41], [497, 2]],
    D: [[563, 2], [1259, 8], [911, 41], [320, 41], [731, 41], [1079, 2], [821, 2], [1169, 41], [635, 41]],
  },
  // the Christmas flakes (xm-still.png); the wide bars use the Winter spots
  christmas: {
    H0: [[164, 56], [214, 50], [170, 80], [292, 12], [298, 60], [212, 74], [150, 44], [290, 36], [306, 82]],
    T: [[563, 2], [320, 41], [797, 5], [680, 2], [389, 2], [620, 41], [485, 41], [719, 41], [497, 2]],
    D: [[563, 2], [1259, 8], [911, 41], [320, 41], [731, 41], [1079, 2], [821, 2], [1169, 41], [635, 41]],
  },
};

/** How much a resting particle is scaled: leaves as drawn, flakes at three quarters. */
export const particleScale = (scene: 'fall' | 'winter' | 'christmas') => (scene === 'fall' ? 1 : 0.75);

/**
 * The horizontal CSS position of a box `w` px wide whose left edge is at `x` in a mockup bar `barW` px wide: from the
 * left edge when its middle lies in the left half, otherwise from the right edge, so it keeps its distance to the
 * controls of that side on any width. `side` overrides the choice.
 */
export function anchor(x: number, w: number, barW: number, side?: Side): { left: string } | { right: string } {
  return (side ?? (x + w / 2 <= barW / 2 ? 'left' : 'right')) === 'left' ? { left: `${x}px` } : { right: `${round(barW - x - w)}px` };
}

/** Rounds to a tenth of a pixel. */
const round = (n: number) => Math.round(n * 10) / 10;

/** The width (px) of a prop drawn at its height. */
export const propWidth = (p: Prop) => round(p.h * ASPECT[p.kind]);
