/**
 * Translating the problems `@calendar/shared` finds in a theme file or picture (ARCHITECTURE "Theme engine and AI
 * themes", "i18n"). The validator's English message stays for the AI repair prompt; the UI shows this text instead.
 */
import type { ValidationIssue } from '@calendar/shared';
import { hasKey, t, type MessageKey } from '@/i18n';

/** The problem in the active language; an unknown code (or a catalogue without it) falls back to the English message. */
export function issueText(issue: ValidationIssue): string {
  const key = `theme.import.issue.${issue.code}`;
  if (!hasKey(key)) return issue.message;
  const params = { ...issue.params };
  // an empty field path means the document itself
  if (params.field === '') params.field = t('theme.import.issue.theTheme');
  if (issue.code === 'const') params.value = String(params.value);
  return t(key as MessageKey, params);
}
