import type { Credit } from './types';

/** THE one place to credit what npm does not describe (icon sets, art, native Android libraries): add one entry here. */
export const EXTRA_CREDITS: Credit[] = [
  // @iconify-json/material-symbols is a dev dependency (icons are inlined at build time), so the build cannot see it
  { name: 'Material Symbols', author: 'Google', license: 'Apache-2.0', url: 'https://github.com/google/material-design-icons' },

  // Android shell (android/app/build.gradle); web/test/credits.test.ts fails when a Gradle dependency is missing here
  { name: 'Capacitor', author: 'Ionic', license: 'MIT', url: 'https://github.com/ionic-team/capacitor' },
  { name: 'AndroidX AppCompat', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/appcompat' },
  { name: 'AndroidX CoordinatorLayout', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/coordinatorlayout' },
  { name: 'AndroidX Core SplashScreen', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/core' },
  { name: 'AndroidX WorkManager', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/work' },
  { name: 'AndroidX Browser', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/browser' },
];
