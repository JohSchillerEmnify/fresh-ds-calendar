/** The page's entry style starts from the cached theme attributes (first paint), before any theme is applied. */
import { describe, expect, it, vi } from 'vitest';

describe('entry style cache', () => {
  it('is outline when cached as outline, solid when the cache is bogus or missing', async () => {
    for (const [cached, want] of [[JSON.stringify({ entries: 'outline' }), 'outline'], ['{not json', 'solid'], [null, 'solid']] as const) {
      localStorage.clear();
      if (cached !== null) localStorage.setItem('cal.themeAttrs', cached);
      vi.resetModules();
      const fresh = await import('@/theme/entryStyle');
      expect(fresh.entryStyle.value).toBe(want);
    }
    localStorage.clear();
  });
});
