/** Detection of hard-coded UI text in Vue templates (shared by `test/i18n-raw-text.test.ts` and `pnpm i18n:scan`). */

/** Static attributes that carry text a person reads or a screen reader speaks. */
export const TEXT_ATTRS = new Set(['label', 'aria-label', 'title', 'placeholder', 'alt']);
export const HAS_WORD = /\p{L}{2,}/u;

export interface Node {
  type: number;
  content?: string;
  loc?: { start: { line: number } };
  props?: Array<{ type: number; name: string; value?: { content: string }; loc?: { start: { line: number } } }>;
  children?: Node[];
}
export interface RawHit { text: string; line: number }

/** Hard-coded text in a template with its line: static text nodes and static text attributes that contain a word. */
export function rawTextHits(node: Node, found: RawHit[] = []): RawHit[] {
  if (node.type === 2 && node.content && HAS_WORD.test(node.content)) found.push({ text: node.content.trim(), line: node.loc?.start.line ?? 0 });
  for (const p of node.props ?? []) {
    if (p.type === 6 && TEXT_ATTRS.has(p.name) && p.value && HAS_WORD.test(p.value.content)) {
      found.push({ text: `${p.name}="${p.value.content}"`, line: p.loc?.start.line ?? 0 });
    }
  }
  for (const c of node.children ?? []) rawTextHits(c, found);
  return found;
}

/** Hard-coded text in a template: static text nodes and static text attributes that contain a word. */
export function rawText(node: Node): string[] {
  return rawTextHits(node).map((h) => h.text);
}
