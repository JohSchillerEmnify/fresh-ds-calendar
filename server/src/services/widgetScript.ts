/** The iPhone widget script the server hands out (ADR 0044): the file in `ios/widget/` with the shared week-hours rule inlined. */
import fs from 'node:fs';
import { hourRange } from '@calendar/shared/week-hours';

const INLINE = '// @inline hourRange';

/** The source with the `// @inline hourRange` line replaced by the shared function, so the rule has one home. */
export function buildWidgetScript(source: string): string {
  return source.replace(INLINE, `/** The hours the week grid shows: the same rule as the Android week widget (shared/weekHours.js). */\n${hourRange.toString()}`);
}

/** The built script and its `// calendar-widget version=<n>` number. */
export function readWidgetScript(file: string): { text: string; version: number } {
  const text = buildWidgetScript(fs.readFileSync(file, 'utf8'));
  const version = Number(/^\/\/ calendar-widget version=(\d+)/.exec(text)?.[1]);
  if (!Number.isInteger(version)) throw new Error('widget script has no version line');
  return { text, version };
}
