import { EXTRA_CREDITS } from './extra';
import { mergeCredits, type Credit } from './types';

/** The credits list: the build's `credits.json` (precached, so it reads offline) merged with the hand-added ones. */
export async function loadCredits(): Promise<Credit[]> {
  let generated: Credit[] = [];
  try {
    const res = await fetch('/credits.json');
    const body: unknown = res.ok ? await res.json() : [];
    if (Array.isArray(body)) generated = body as Credit[];
  } catch {
    // offline and not yet cached: the hand-added credits still show
  }
  return mergeCredits(generated, EXTRA_CREDITS);
}
