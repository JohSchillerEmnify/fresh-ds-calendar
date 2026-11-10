import type { Credit } from './types';

/** THE one place to credit what npm does not describe (icon sets, art, native Android libraries): add one entry here. */
export const EXTRA_CREDITS: Credit[] = [
  // @iconify-json/material-symbols is a dev dependency (icons are inlined at build time), so the build cannot see it
  { name: 'Material Symbols', author: 'Google', license: 'Apache-2.0', url: 'https://github.com/google/material-design-icons' },
  // the other icon sets of the theme menu (icons.solar.ts, icons.phosphor.ts, icons.pixelart.ts); Solar's CC BY 4.0 requires this credit
  { name: 'Solar Icon Set', author: '480 Design', license: 'CC BY 4.0', url: 'https://www.figma.com/community/file/1166831539721848736' },
  { name: 'Phosphor Icons', author: 'Phosphor Icons', license: 'MIT', url: 'https://github.com/phosphor-icons/core' },
  { name: 'Pixelarticons', author: 'Gerrit Halfmann', license: 'MIT', url: 'https://github.com/halfmage/pixelarticons' },
  // the app icon's cap lettering, converted to outlines by web/scripts/gen-icons.mjs
  { name: 'UnifrakturMaguntia', author: 'j. "mach" wust and Peter Wiegel', license: 'SIL OFL 1.1', url: 'https://fonts.google.com/specimen/UnifrakturMaguntia' },

  // the map tiles and the place search the app asks directly (event location, map picker)
  { name: 'OpenStreetMap map data and tiles', author: 'OpenStreetMap contributors', license: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright' },
  { name: 'Photon place search', author: 'Komoot and contributors', license: 'Apache-2.0', url: 'https://github.com/komoot/photon' },

  // Android shell (android/app/build.gradle); web/test/credits.test.ts fails when a Gradle dependency is missing here
  { name: 'Capacitor', author: 'Ionic', license: 'MIT', url: 'https://github.com/ionic-team/capacitor' },
  { name: 'Capacitor Geolocation plugin', author: 'Ionic', license: 'MIT', url: 'https://github.com/ionic-team/capacitor-plugins/tree/main/geolocation' },
  { name: 'AndroidX AppCompat', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/appcompat' },
  { name: 'AndroidX CoordinatorLayout', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/coordinatorlayout' },
  { name: 'AndroidX Core SplashScreen', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/core' },
  { name: 'AndroidX WorkManager', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/work' },
  { name: 'AndroidX Browser', author: 'The Android Open Source Project', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx/releases/browser' },
];
