/** Pure line budget of a timed event block: title lines first, the time row only when it does not cost a title line. */
export interface LineBudget { lines: number; time: boolean }

/** Rough wrapped line count of `title` for `cpl` characters per line (words never split unless longer than a line). */
export function wrapLines(title: string, cpl: number): number {
  const w = Math.max(1, Math.floor(cpl));
  let lines = 1, cur = 0;
  for (const word of title.split(/\s+/).filter(Boolean)) {
    let len = word.length;
    if (cur && cur + 1 + len <= w) { cur += 1 + len; continue; }
    if (cur) { lines++; cur = 0; }
    while (len > w) { lines++; len -= w; }
    cur = len;
  }
  return lines;
}

/**
 * `height`/`width`: block box in px; `padV`: vertical padding; `lineH`: title line height; `timeH`: time row height;
 * `charW`: average glyph width. Title lines = what the text needs, capped by the height; the time row appears only when
 * the whole wrapped title plus one row still fits.
 */
export function blockBudget(i: { title: string; height: number; width: number; padV: number; lineH: number; timeH: number; charW: number; padH: number }): LineBudget {
  const avail = Math.max(0, i.height - i.padV);
  const fit = Math.max(1, Math.floor(avail / i.lineH));
  const need = wrapLines(i.title, (i.width - i.padH) / i.charW);
  const lines = Math.min(need, fit);
  return { lines, time: need <= fit && avail - need * i.lineH >= i.timeH };
}
