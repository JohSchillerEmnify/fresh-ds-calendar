/** Left edge (px) for a popover of `width` anchored at `anchorLeft`, kept fully inside `[margin, viewport - margin]`. */
export function clampLeft(anchorLeft: number, width: number, viewport: number, margin = 12): number {
  const max = viewport - margin - width;
  return Math.max(margin, Math.min(anchorLeft, max));
}
