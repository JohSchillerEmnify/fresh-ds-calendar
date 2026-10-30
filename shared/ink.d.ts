import type { InkStroke } from './api';

/** Identity of a stroke: when it was drawn and where it starts (the same stroke has the same key on every device). */
export declare const inkKey: (s: InkStroke) => string;
/** The strokes to draw: erase marks have no points. */
export declare const visibleInk: (strokes: InkStroke[]) => InkStroke[];
/** The item's strokes after a device's change is applied on top of what the server holds (see ink.js). */
export declare function mergeInk(current: InkStroke[], after: InkStroke[], base: string[], at: number): InkStroke[];
