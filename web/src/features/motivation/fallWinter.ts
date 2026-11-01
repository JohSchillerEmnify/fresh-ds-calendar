/**
 * Where the Fall and Winter props, the cat, the kite, the visitors and the resting particles sit (feature
 * theme-scenes, round 3 mockups approved 2026-10-26; art and spots from `fwart.cjs` / `fw.cjs`). The spots are pixels
 * of the bar at the mockup's width per layout: on a phone the header layout `H1` one row (390 px wide, 52 px tall) or
 * `H2` two rows (390 x 84, the default), `T` the tablet (820 x 60) and `D` the desktop (1280 x 60). On another width a spot keeps its distance to the nearer bar edge, as
 * the controls do (title and arrows at the left, widgets and buttons at the right); see {@link anchor}.
 */

/** A bar layout the spots are drawn for. */
export type SceneLayout = 'H1' | 'H2' | 'T' | 'D';

/** The mockup bar of each layout: width and height (px). */
export const BAR: Record<SceneLayout, { w: number; h: number }> = { H1: { w: 390, h: 52 }, H2: { w: 390, h: 84 }, T: { w: 820, h: 60 }, D: { w: 1280, h: 60 } };

/**
 * The layout of a bar `width` px wide: on a phone (below 768 px, like the bar's own layout) the header layout the bar
 * shows (`data-layout` on the top bar, feature header-layout; two rows when it has none), else tablet below 1100 px.
 */
export function layoutFor(width: number, header?: string): SceneLayout {
  if (width < 768) return header === 'one-row' ? 'H1' : 'H2';
  return width < 1100 ? 'T' : 'D';
}

/** A prop that stands on the bar's bottom edge. `h` is its drawn height (px). */
export type PropKind = 'autumn-tree' | 'leaf-pile' | 'snowy-tree' | 'snowman' | 'sledge';
export interface Prop { kind: PropKind; x: number; h: number; side?: Side; bottom?: number }
/** The bar edge a spot keeps its distance to. */
export type Side = 'left' | 'right';

/** Width / height of each drawing. */
const ASPECT: Record<PropKind, number> = { 'autumn-tree': 0.8, 'snowy-tree': 0.8, 'leaf-pile': 3, snowman: 26 / 32, sledge: 34 / 13 };

const tree = (x: number, h: number): Prop => ({ kind: 'autumn-tree', x, h });
const pile = (x: number, bottom?: number): Prop => ({ kind: 'leaf-pile', x, h: 13, bottom });
const stree = (x: number, h: number): Prop => ({ kind: 'snowy-tree', x, h });
const snowman = (x: number, side?: Side): Prop => ({ kind: 'snowman', x, h: 42, side });
const sledge = (x: number, bottom?: number): Prop => ({ kind: 'sledge', x, h: 13, bottom });

/** The props per scene and layout (left edge in mockup px), back to front. */
export const PROPS: Record<'fall' | 'winter', Record<SceneLayout, Prop[]>> = {
  fall: {
    // one row: the tree stands in the gap after the date (the cat moves to the bottom edge)
    H1: [tree(128.6, 52), pile(176, -1)],
    H2: [tree(140, 43), pile(176), pile(226), tree(264, 36)],
    T: [tree(440, 46), pile(540), tree(572, 56), pile(603)],
    D: [tree(336, 46), tree(545, 56), tree(578, 46), pile(620), pile(678), tree(840, 56), pile(886), tree(960, 46), tree(990, 56), pile(1050)],
  },
  winter: {
    // one row: no gap is wide enough for the snowy tree; the snowman stands after the date
    H1: [snowman(132.4), sledge(176, -2)],
    // the snowman stays beside the cat (both from the left), so on a narrow phone it does not stand behind it
    H2: [snowman(188, 'left'), sledge(224), stree(264, 36)],
    T: [stree(440, 46), snowman(540), stree(578, 56), sledge(610)],
    D: [stree(336, 46), snowman(548), sledge(586), stree(660, 56), stree(692, 46), stree(820, 56), stree(930, 46), stree(960, 56), stree(1050, 46)],
  },
};

/**
 * The cat's left edge per scene and layout (mockup px): Fall moves next to the kite, the tablet cat out from under
 * Today. On main the touch bars have no arrows (header PR 1): in one row the Today icon sits where the mockup's flame
 * was, so the one-row cat and kite stand in the gap after the date (216-260 px), and on the tablet the first tree moves
 * from under Today (336 px) to after it (440 px). Two particles per layout moved off the Today button for the same reason.
 */
export const CAT_X: Record<'fall' | 'winter', Record<SceneLayout, number>> = {
  fall: { H1: 204, H2: 240, T: 512, D: 717 },
  winter: { H1: 218, H2: 156, T: 512, D: 512 },
};
/** The cat's height (px; the as-built size of the 96 px scene box on phones) and how far it stands below the bar's
 * bottom edge: in one row the tree or the snowman has its gap, so only the cat's head shows at the bottom edge. */
export const CAT_SIZE: Record<SceneLayout, { h: number; bottom: number }> = { H1: { h: 30, bottom: -1 }, H2: { h: 30, bottom: -1 }, T: { h: 26.4, bottom: -1 }, D: { h: 26.4, bottom: -1 } };

/** The kite's top-left corner (mockup px; 16 x 20 plus its tail); its string runs to the cat's front paw. */
export const KITE: Record<SceneLayout, { x: number; y: number }> = { H1: { x: 224, y: 2 }, H2: { x: 222, y: 2 }, T: { x: 540, y: 2 }, D: { x: 790, y: 2 } };

/** The height of the bird flock's flight above the bar's top edge (px): in the gap between the rows on a phone, above the title on wide bars. */
export const FLOCK_Y: Record<SceneLayout, number> = { H1: 0, H2: 44, T: 4, D: 4 };

/** Where the robin perches: on the sledge (left edge and bottom, mockup px). */
export const ROBIN: Record<SceneLayout, { x: number; bottom: number }> = { H1: { x: 184, bottom: 6 }, H2: { x: 232, bottom: 8 }, T: { x: 618, bottom: 8 }, D: { x: 592, bottom: 8 } };

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
    H1: [[371, 3], [164, 5], [304, 41], [245, 3], [308, 3], [122, 41], [338, 8], [323, 5], [233, 40]],
    H2: [[290, 60], [14, 54], [161, 73], [371, 47], [233, 56], [305, 73], [356, 3], [119, 47], [215, 72]],
    T: [[563, 3], [320, 41], [14, 49], [800, 8], [683, 3], [167, 49], [452, 3], [623, 41], [485, 48]],
    D: [[767, 3], [1259, 5], [14, 49], [386, 3], [1025, 41], [575, 49], [887, 41], [1133, 3], [209, 48]],
  },
  winter: {
    H1: [[340, 42], [143, 5], [368, 2], [221, 2], [332, 8], [170, 2], [236, 4], [239, 8], [350, 2]],
    H2: [[212, 47], [14, 41], [368, 2], [311, 65], [272, 58], [119, 47], [371, 44], [263, 62], [254, 65]],
    T: [[563, 2], [320, 41], [797, 5], [680, 2], [452, 2], [620, 41], [485, 41], [719, 41], [497, 2]],
    D: [[563, 2], [1259, 8], [911, 41], [320, 41], [731, 41], [1079, 2], [821, 2], [1169, 41], [635, 41]],
  },
  // the Christmas flakes (xm-still.png); the wide bars use the Winter spots
  christmas: {
    H1: [[113, 10], [176, 12], [226, 38], [248, 8], [178, 36], [316, 42], [304, 42], [246, 40], [380, 30]],
    H2: [[140, 52], [212, 48], [160, 70], [262, 58], [336, 62], [210, 66], [336, 76], [300, 52], [304, 70]],
    T: [[563, 2], [320, 41], [797, 5], [680, 2], [452, 2], [620, 41], [485, 41], [719, 41], [497, 2]],
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
