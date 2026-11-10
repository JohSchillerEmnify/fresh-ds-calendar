// Regenerates every app icon from the one design source design/icon/fresh-d-approved.svg (108x108 Android adaptive canvas):
// the cleaned and outlined design/icon/fresh-d.svg, web/public/icons/logo*.svg + PNGs, Android adaptive icon (vector
// foreground, monochrome, legacy mipmaps) and the consent-screen logo. Run: pnpm --filter web icons
// The cap text is converted to paths with opentype.js, so no font is needed at runtime.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import svg2vectordrawable from 'svg2vectordrawable';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const iconDir = path.join(root, 'design/icon');
const icons = path.join(root, 'web/public/icons');
const res = path.join(root, 'android/app/src/main/res');
const branding = path.join(root, 'docs/branding');
const fontFile = path.join(root, 'node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff');

const source = fs.readFileSync(path.join(iconDir, 'fresh-d-approved.svg'), 'utf8');

/** The drawn paths of the Paper.js export (the clip groups and hidden guides are dropped), in paint order. */
function readShapes() {
  const shapes = [];
  for (const [tag] of source.matchAll(/<path [^>]*\bid="(?:bg|band|ringL|ringR|p\d+)"[^>]*\/>/g)) {
    const attr = (n) => tag.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];
    shapes.push({ id: attr('id'), d: attr('d'), fill: attr('fill'), stroke: attr('stroke'), width: attr('stroke-width'), cap: attr('stroke-linecap') });
  }
  return shapes;
}

/** "Fresh D." as an outline: same position and size as the source <text> (scale .1805, centred on x). */
function capText() {
  const k = 0.1805;
  const [x, y, size] = [295.78999 * k, 275.76897 * k, 53.68 * k];
  const buf = fs.readFileSync(fontFile);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const left = x - font.getAdvanceWidth('Fresh D.', size) / 2;
  return { id: 'p15', d: font.getPath('Fresh D.', left, y, size).toPathData(3), fill: '#ffffff' };
}

const shapes = [...readShapes(), capText()];
const only = (...ids) => shapes.filter((s) => ids.includes(s.id));
const nonBg = () => shapes.filter((s) => s.id !== 'bg');

const el = (s, extra = '') => {
  const stroke = s.stroke && s.stroke !== 'none' ? ` stroke="${s.stroke}" stroke-width="${s.width}" stroke-linecap="${s.cap}"` : '';
  return `<path d="${s.d}" fill="${s.fill}"${stroke}${extra}/>`;
};
const body = (list) => list.map((s) => el(s)).join('');
const svgDoc = (viewBox, inner, size = 512) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">${inner}</svg>\n`;

// the launcher shows the middle 72x72 (18..90); web icons show it as a rounded tile
const tile = (rx) => `<clipPath id="t"><rect x="18" y="18" width="72" height="72" rx="${rx}"/></clipPath><g clip-path="url(#t)">${body(shapes)}</g>`;
const full = svgDoc('18 18 72 72', `<title>Calendar: Fresh D.</title>${tile(15.75)}`);
// maskable: full bleed; the 66 dp safe circle sits inside the 80 % safe zone of a 90x90 window
const maskable = svgDoc('9 9 90 90', `<title>Calendar: Fresh D. (maskable)</title>${body(shapes)}`);
const design = svgDoc('0 0 108 108', body(shapes), 108);

// Android 13 themed icon: the system tints the alpha only, so tones are alpha steps (hair, face and beard, then shades and cap)
const tone = (id, a) => el({ ...only(id)[0], fill: '#000000', stroke: 'none' }, a < 1 ? ` fill-opacity="${a}"` : '');
const mono = svgDoc('0 0 108 108', [tone('p0', 0.55), tone('p2', 0.3), tone('p3', 0.3), tone('p7', 1), tone('p13', 1), tone('p14', 1)].join(''), 108);

const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};
const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng();
const vector = async (svg) => (await svg2vectordrawable(svg, { floatPrecision: 2, xmlTag: true, fillBlack: true })).replace(/\n*$/, '\n');

write(path.join(iconDir, 'fresh-d.svg'), design);
for (const n of ['logo.svg', 'logo-small.svg']) write(path.join(icons, n), full);
write(path.join(icons, 'logo-maskable.svg'), maskable);
write(path.join(icons, 'icon-192.png'), png(full, 192));
write(path.join(icons, 'icon-512.png'), png(full, 512));
write(path.join(icons, 'icon-maskable-512.png'), png(maskable, 512));
write(path.join(icons, 'apple-touch-icon-180.png'), png(svgDoc('18 18 72 72', body(shapes)), 180));
write(path.join(icons, 'favicon-32.png'), png(full, 32));

// Android: adaptive icon (background colour + vector foreground + monochrome) and the legacy mipmaps
write(path.join(res, 'drawable/ic_launcher_foreground.xml'), await vector(svgDoc('0 0 108 108', body(nonBg()), 108)));
write(path.join(res, 'drawable/ic_launcher_monochrome.xml'), await vector(mono));
const round = svgDoc('18 18 72 72', `<clipPath id="c"><circle cx="54" cy="54" r="36"/></clipPath><g clip-path="url(#c)">${body(shapes)}</g>`);
for (const [d, k] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  write(path.join(res, `mipmap-${d}/ic_launcher.png`), png(full, 48 * k));
  write(path.join(res, `mipmap-${d}/ic_launcher_round.png`), png(round, 48 * k));
}

// Google Cloud OAuth consent screen (120x120 is Google's recommended size)
write(path.join(branding, 'logo.svg'), full);
write(path.join(branding, 'logo-120.png'), png(full, 120));
console.log('icons written');
