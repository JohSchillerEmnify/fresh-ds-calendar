/**
 * English message catalogue (ARCHITECTURE "i18n"): flat keys, read via `t('key')` from `@/i18n`.
 * New and touched UI strings live here; the remaining hard-coded strings move in their own slice.
 */
export const en = {
  'tasklist.untitled': 'List',
  'tasklist.titleOrItem': 'Add a title or an item',
} as const;

export type MessageKey = keyof typeof en;
