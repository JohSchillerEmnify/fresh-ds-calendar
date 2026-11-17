/* eslint-disable @typescript-eslint/no-explicit-any -- walks the untyped node tree the widget script builds */
/** Draws a widget built against the Scriptable fake as an SVG, from `layoutOf`, so its layout can be looked at without a phone. */
import { layoutOf } from './scriptable-fake.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A fake colour (plain or dynamic) as hex plus alpha, in light or dark mode. */
function paint(c: any, dark: boolean): { hex: string; alpha: number } | undefined {
  if (!c) return undefined;
  const p = c.light ? (dark ? c.dark : c.light) : c;
  const hex: string = p.hex ?? p.color; // a drawn rect keeps its colour as `color`
  return { hex: hex.startsWith('#') ? hex : `#${hex}`, alpha: p.alpha ?? 1 };
}
const fill = (c: { hex: string; alpha: number }) => `fill="${c.hex}"${c.alpha < 1 ? ` fill-opacity="${c.alpha}"` : ''}`;

/** Texts are 0 wide in the layout, so flexible spacers around one tell how it is aligned in its stack. */
function anchorOf(node: any): 'start' | 'middle' | 'end' {
  const kids: any[] = node.parent?.kids ?? [];
  const i = kids.indexOf(node);
  const flex = (k: any) => k.kind === 'spacer' && k.length == null;
  const before = node.parent?.horizontal && kids.slice(0, i).some(flex);
  const after = node.parent?.horizontal && kids.slice(i + 1).some(flex);
  return before && after ? 'middle' : before ? 'end' : 'start';
}

/** The widget as an SVG at its layout size; `dark` picks the dark side of dynamic colours. */
export function widgetSvg(widget: unknown, dark = false): string {
  const boxes = layoutOf(widget);
  const root = boxes.get(widget)!;
  const out: string[] = [];
  let clip = 0;
  const bg = paint((widget as any).backgroundColor, dark);
  out.push(`<rect width="${root.w}" height="${root.h}" ${fill(bg ?? { hex: dark ? '#000000' : '#ffffff', alpha: 1 })}/>`);
  for (const [node, b] of boxes as Map<any, any>) {
    if (node === widget) continue;
    const back = paint(node.backgroundColor, dark);
    if (back) out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${node.cornerRadius ?? 0}" ${fill(back)}/>`);
    const img = node.backgroundImage ?? (node.kind === 'image' ? node.image : undefined);
    if (img?.rects && b.w && b.h) {
      const sx = b.w / img.size.width;
      const sy = b.h / img.size.height;
      for (const r of img.rects) out.push(`<rect x="${b.x + r.x * sx}" y="${b.y + r.y * sy}" width="${r.w * sx}" height="${r.h * sy}" ${fill(paint(r, dark)!)}/>`);
    }
    if (node.kind === 'text') {
      const rec = node.font ?? {};
      const size = rec.size ?? 12;
      const color = paint(rec.color, dark) ?? { hex: dark ? '#ffffff' : '#000000', alpha: 1 };
      const p = boxes.get(node.parent) ?? b;
      clip += 1;
      out.push(`<clipPath id="c${clip}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath>`);
      out.push(`<text clip-path="url(#c${clip})" x="${b.x}" y="${b.y + size * 0.85}" font-size="${size}" font-family="-apple-system, Helvetica, Arial, sans-serif"${rec.bold ? ' font-weight="bold"' : ''} text-anchor="${anchorOf(node)}" ${fill(color)}>${esc(node.text ?? '')}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${root.w}" height="${root.h}" viewBox="0 0 ${root.w} ${root.h}">${out.join('')}</svg>`;
}
