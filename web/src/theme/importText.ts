/**
 * Tidying and repairing the text of a theme file as chat programs hand it over (ARCHITECTURE "Theme engine and AI
 * themes"): code fences, text around the JSON and Markdown links where a URL stood.
 */

/** The JSON text inside an AI answer: the fenced block if there is one, links turned back into URLs, and no text outside the outermost braces. */
export function cleanAiText(raw: string): string {
  let t = raw.trim();
  const fence = /```[a-zA-Z]*\s*\n?([\s\S]*?)```/.exec(t);
  if (fence) t = fence[1]!.trim();
  // chat programs turn a URL into [url](url): keep the target
  t = t.replace(/\[[^\]]*\]\((https?:[^)\s]*)\)/g, '$1');
  const from = t.indexOf('{'), to = t.lastIndexOf('}');
  return from >= 0 && to > from ? t.slice(from, to + 1) : t;
}

/** Hint shown for text that is not JSON. */
export const NOT_JSON_HINT = 'This is not valid JSON. Ask the AI to answer with only the JSON in one code block.';

/** A prompt that asks the AI to repair its answer: the problems found and the text that was imported. */
export function repairPrompt(text: string, errors: string[]): string {
  return `The theme JSON you gave me could not be imported. Fix it and answer with only the corrected JSON in one code block, no SVG, no explanation.

Problems:
${errors.map((e) => `- ${e}`).join('\n')}

My text:
${text}
`;
}
