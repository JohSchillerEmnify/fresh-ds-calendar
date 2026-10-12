/** Message lookup. English only for now; German plugs in here later. */
import { en, type MessageKey } from './en';

export type { MessageKey };

/** The UI text for `key` in the current language. */
export function t(key: MessageKey): string {
  return en[key];
}
