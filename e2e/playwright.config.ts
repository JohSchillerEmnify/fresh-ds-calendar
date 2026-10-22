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
  // @backlog scenarios are agreed spec not built yet: every project skips them, so they need no steps yet
  tags: 'not @backlog',
});

export default defineConfig({
  testDir,
  // One shared mock backend: scenarios must run serially (A-30).
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  // Visual states (spec/features/visual.feature): pictures in CSS pixels, animations off; baselines live in e2e/snapshots (tracked).
  expect: { timeout: 5_000, toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.002 } },
  snapshotPathTemplate: 'snapshots/{projectName}/{arg}{ext}',
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'results.json' }],
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
      grepInvert: /@desktop|@tablet|@backlog/,
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
      // an iPad (portrait, touch): only the scenarios tagged @tablet
      name: 'tablet',
      grep: /@tablet/,
      use: {
        browserName: 'chromium',
        viewport: { width: 820, height: 1180 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['iPad (gen 7)'].userAgent,
      },
    },
    {
      name: 'desktop',
      grepInvert: /@mobile|@tablet|@perf|@backlog/,
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
