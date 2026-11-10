/**
 * Unit-test setup: the themed scenes are lazy chunks in the app; here they are built from eagerly imported pieces so
 * a mounted scene is complete at once (the lazy path is covered by the one async test in motivation/scenes.test.ts).
 */
import { vi } from 'vitest';
import { loadIconSet } from '@/components/icons';
import { ICON_SETS } from '@/theme/fine';

// the icon sets are lazy chunks in the app; tests load them all up front so no import is still running at teardown
await Promise.all(ICON_SETS.map(loadIconSet));

vi.mock('@/features/motivation/scenes', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/motivation/scenes')>();
  const [MordorIntro, SceneLife, SeasonScene, ThemeOwnScene] = await Promise.all([
    import('@/features/motivation/MordorIntro.vue'),
    import('@/features/motivation/SceneLife.vue'),
    import('@/features/motivation/SeasonScene.vue'),
    import('@/features/motivation/ThemeOwnScene.vue'),
  ]);
  return {
    ...real,
    scenes: real.buildScenes({ MordorIntro: MordorIntro.default, SceneLife: SceneLife.default, SeasonScene: SeasonScene.default, ThemeOwnScene: ThemeOwnScene.default }),
  };
});
