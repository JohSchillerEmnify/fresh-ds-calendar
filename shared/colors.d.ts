/** Types of the Google colour palette in `colors.js`. */

/** Google's event colours by colorId (`'1'`..`'11'`). */
export declare const GOOGLE_COLORS: Readonly<Record<string, { hex: string; name: string }>>;
/** The colorIds of {@link GOOGLE_COLORS}. */
export declare const GOOGLE_COLOR_IDS: string[];
/** CIE76 colour difference of two `#rrggbb` colours. */
export declare function deltaE76(a: string, b: string): number;
/** Nearest Google colorId of a `#rrggbb` colour; ties → lower id. */
export declare function nearestGoogleColorId(hex: string): string;
