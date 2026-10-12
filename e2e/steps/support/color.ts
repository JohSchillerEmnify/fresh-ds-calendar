import { expect, type Locator, type Page } from '@playwright/test';

export interface Rgba { r: number; g: number; b: number; a: number }

/**
 * Resolve any CSS color (rgb(), hex, oklch(), color-mix(), ...) to sRGB bytes inside the page via a 1x1 canvas.
 * Returns null for an empty/invalid value.
 */
export async function cssColorToRgba(page: Page, css: string): Promise<Rgba | null> {
  return page.evaluate((value) => {
    if (!value || !CSS.supports('color', value)) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  }, css.trim());
}

export const toHex = ({ r, g, b }: Rgba) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

/** Computed `--md-sys-color-<role>` on :root as '#rrggbb' (or null if undefined). */
export async function roleHex(page: Page, role: string): Promise<string | null> {
  const raw = await page.evaluate(
    (r) => getComputedStyle(document.documentElement).getPropertyValue(`--md-sys-color-${r}`).trim(),
    role,
  );
  const rgba = raw ? await cssColorToRgba(page, raw) : null;
  return rgba ? toHex(rgba) : null;
}

/**
 * HCT hue (= CAM16 hue under Material's default viewing conditions), ported from material-color-utilities
 * `Cam16.fromInt` / `ViewingConditions.DEFAULT`. (@material/material-color-utilities 0.4.0 cannot be imported under
 * Node ESM: its index uses extensionless imports and the package exports no subpaths.)
 */
export function hctHue(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return (c <= 0.040449936 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * 100;
  };
  const [r, g, b] = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const x = 0.41233895 * r + 0.35762064 * g + 0.18051042 * b;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = 0.01932141 * r + 0.11916382 * g + 0.95034478 * b;
  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;
  const { rgbD, fl } = DEFAULT_VC;
  const adapt = (v: number, d: number) => {
    const af = (fl * Math.abs(v * d)) / 100;
    const p = af ** 0.42;
    return (Math.sign(v * d) * 400 * p) / (p + 27.13);
  };
  const [rA, gA, bA] = [adapt(rC, rgbD[0]), adapt(gC, rgbD[1]), adapt(bC, rgbD[2])];
  const a = (11 * rA - 12 * gA + bA) / 11;
  const bb = (rA + gA - 2 * bA) / 9;
  const deg = (Math.atan2(bb, a) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg >= 360 ? deg - 360 : deg;
}

const DEFAULT_VC = (() => {
  const white = [95.047, 100.0, 108.883];
  const labInvf = (ft: number) => (ft ** 3 > 216 / 24389 ? ft ** 3 : (116 * ft - 16) / (24389 / 27));
  const adaptingLuminance = ((200 / Math.PI) * (100 * labInvf((50 + 16) / 116))) / 100;
  const f = 1.0; // surround 2.0 -> 0.8 + 2/10
  let d = f * (1 - (1 / 3.6) * Math.exp((-adaptingLuminance - 42) / 92));
  d = Math.min(1, Math.max(0, d));
  const rW = white[0] * 0.401288 + white[1] * 0.650173 + white[2] * -0.051461;
  const gW = white[0] * -0.250268 + white[1] * 1.204414 + white[2] * 0.045854;
  const bW = white[0] * -0.002079 + white[1] * 0.048952 + white[2] * 0.953127;
  const rgbD = [d * (100 / rW) + 1 - d, d * (100 / gW) + 1 - d, d * (100 / bW) + 1 - d];
  const k = 1 / (5 * adaptingLuminance + 1);
  const k4 = k ** 4;
  const fl = k4 * adaptingLuminance + 0.1 * (1 - k4) ** 2 * Math.cbrt(5 * adaptingLuminance);
  return { rgbD, fl };
})();

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * WCAG contrast ratio between the computed `color` of `el` and the first non-transparent ancestor
 * `background-color` (starting at `el` itself). Runs entirely in the page.
 */
export async function contrastRatio(el: Locator): Promise<number> {
  return el.evaluate((node) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const rgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const fg = rgba(getComputedStyle(node as Element).color);
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let e: Element | null = node as Element; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c.a > 0) { bg = c; break; }
    }
    const l1 = lum(fg);
    const l2 = lum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  });
}

/** Hue of a color role is within `degrees` of a hex color (HCT hue, circular difference). Auto-retrying. */
export async function expectRoleHue(page: Page, role: string, degrees: number, hex: string) {
  const want = hctHue(hex);
  await expect
    .poll(async () => {
      const got = await roleHex(page, role);
      return got ? Math.round(hueDistance(hctHue(got), want)) : 999;
    }, { message: `hue of --md-sys-color-${role} within ${degrees} degrees of ${hex}` })
    .toBeLessThanOrEqual(degrees);
}
