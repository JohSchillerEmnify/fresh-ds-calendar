import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * Executes spec/features/**\/*.feature directly (playwright-bdd). See README.md.
 * E2E_BASE_URL: app under test (default http://localhost:3000). E2E_SPEC_DIR: spec folder (default ../spec).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const specDir = process.env.E2E_SPEC_DIR ?? '../spec';

const testDir = defineBddConfig({
  features: `${specDir}/features/**/*.feature`,
  featuresRoot: `${specDir}/features`,
  steps: ['steps/**/*.ts'],
  outputDir: '.features-gen',
  missingSteps: 'fail-on-gen',
});

export default defineConfig({
  testDir,
  // One shared mock backend: scenarios must run serially (A-30).
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL,
    timezoneId: 'Europe/Berlin',
    locale: 'en-GB',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      grepInvert: /@desktop/,
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['Pixel 7'].userAgent,
      },
    },
    {
      name: 'desktop',
      grepInvert: /@mobile|@perf/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
});
