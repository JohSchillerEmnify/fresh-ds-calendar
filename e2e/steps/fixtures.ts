/**
 * Test fixture + step constructors. Steps are cucumber style: `this` is the per-scenario World.
 * Import Given/When/Then/Step from here in every step file.
 */
import { test as base, createBdd } from 'playwright-bdd';
import { World } from './support/world.js';

export const test = base.extend<{ world: World }>({
  world: async ({ page, request, browser }, use, testInfo) => {
    await World.prepareContext(page.context());
    const world = new World(page, request, browser, testInfo);
    await use(world);
    await world.dispose();
  },
});

export const { Given, When, Then, Step } = createBdd(test, { worldFixture: 'world' });
export type { World };
