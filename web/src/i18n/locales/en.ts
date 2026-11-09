/**
 * English message catalogue: the source of truth for the message schema (ADR 0021).
 *
 * Default export, like the other catalogues; the schema types live in `../schema.ts`.
 *
 * Keys are nested and named by meaning, not by text. Every other catalogue is checked against the shape of this
 * object, so a key missing in `de.ts` is a type error and `t()` only accepts keys that exist here. Message syntax is
 * vue-i18n's: `{name}` interpolates, `a | b` pluralises, and the characters `@`, `|`, `{` and `}` must be escaped.
 */
import calendarEn from './en/calendar.ts';
import outboxEn from './en/outbox.ts';
import deviceLogEn from './en/deviceLog.ts';
import backupEn from './en/backup.ts';
import canvasEn from './en/canvas.ts';
import inkEn from './en/ink.ts';
import bedtimeEn from './en/bedtime.ts';
import sharingEn from './en/sharing.ts';
import tasksEn from './en/tasks.ts';
import themeEn from './en/theme.ts';

import settingsNavEn from './en/settingsNav.ts';
export default {
  settingsNav: settingsNavEn,
  calendar: calendarEn,
  outbox: outboxEn,
  deviceLog: deviceLogEn,
  backup: backupEn,
  canvas: canvasEn,
  ink: inkEn,
  bedtime: bedtimeEn,
  sharing: sharingEn,
  tasks: tasksEn,
  app: {
    name: "Fresh-D's Kalender",
    short: 'Fresh-D',
    slogan: 'Trag ein, trag aus, macht mir nix aus!',
  },
  views: {
    year: 'Year',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    tasks: 'Tasks',
    clock: 'Plain clock',
    clockRings: 'Clock',
    timeline: 'Timeline',
    strip: 'Strip',
    zoom: 'Zoom month',
    horizontal: 'Horizontal',
    runway: 'Runway',
    now: 'Now',
  },
  horizontal: {
    timeIn: 'Zoom in time',
    timeOut: 'Zoom out time',
    dayIn: 'Taller days',
    dayOut: 'Shorter days',
  },
  zoomMonth: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },
  nav: {
    views: 'Views',
    menu: 'Menu',
    calendars: 'Calendars',
  },
  common: {
    off: 'Off',
  },
  errors: {
    saveUnavailable: 'Could not save: Google Calendar is unavailable',
    conflict: 'This event was changed elsewhere. Reload it and try again.',
    validation: {
      endAfterStart: 'End must be after start',
      eventTooLong: 'Event must be at most 366 days long',
    },
  },
  category: {
    nameExists: 'A category with this name already exists',
  },
  tasklist: {
    showsTwice: 'This list shows twice on {date}. Delete the other copy, then try again.',
    titleOrItem: 'Add a title or an item',
    tooManyItems: 'A task list can have at most 200 items',
    tagsUnique: 'Each tag can only be used once.',
  },
  settings: {
    title: 'Settings',
    back: 'Back',
    sectionsLabel: 'Settings sections',
    saveFailed: 'Could not save settings',
    sections: {
      bedtime: 'Bedtime',
    },
    reminders: {
      intro: 'These are Google Calendar\'s own reminders. A calendar\'s default reminders apply to every appointment that has none of its own.',
      push: {
        denied: 'Notifications are blocked for this site. Allow them in the browser settings, then switch this on again.',
        failed: 'Could not switch browser reminders on. Try again.',
      },
      tasklists: {
        default: 'Default reminders of task lists',
      },
    },
    notifications: {
      events: { label: 'Before appointments' },
      tasklists: 'Before task lists with a time',
      morning: { label: 'Morning overview', hint: 'Your day at a glance at a time you choose', time: 'Time of the overview' },
      overview: { title: 'Your day', appointments: 'no appointments | 1 appointment | {count} appointments', lists: 'no lists | 1 list | {count} lists', first: 'first: {title} {time}' },
    },
    theme: {
      label: 'Theme',
      hint: 'Mode, color, glow, entries, corners and scene',
    },
    language: {
      label: 'Language',
      auto: 'Automatic',
    },
    calendar: {
      defaultView: 'Default view',
      viewsKeepOne: 'At least one view stays on.',
      barSize: { expressive: 'Expressive', compact: 'Compact' },
      topBarSize: { label: 'Top bar size', hint: 'On phones; Expressive shows the whole scene, Compact is one row' },
      bottomBarSize: { label: 'Bottom bar size', hint: 'On phones' },
      monthScroll: { label: 'Month view scrolls', sideways: 'Sideways', vertical: 'Up and down', verticalSnap: 'Up and down, one month at a time' },
      approachingCard: { label: 'Approaching card', hint: 'What is on now and next, above the calendar' },
      approachTimeLeft: { label: 'Time left', hint: 'Shows how much time the current event has left in the Approaching card. When off, it shows on the event itself.' },
      minEventLength: { label: 'Minimum event length', hint: 'Shorter events and task lists are shown at least this long, so their titles stay readable', off: 'Off', minutes: '{n} min' },
      sideBySide: { hint: 'How many overlapping events sit side by side. Any more are stacked on the last one.', upTo: 'Up to {n}', only: 'Only {n}' },
      approachBar: { label: 'Approaching track', hint: 'What comes next today as a track in the Approaching card' },
      syncIndicator: { hint: 'Shows the sync icon all the time, not only when syncing fails' },
      approachWindow: {
        label: 'How far ahead the track shows',
      },
      tasksCalendar: { label: 'Show the task lists calendar in Google', hint: 'Task lists stay in the app either way' },
    },
    tasklists: {
      carriedFrom: { label: 'Show where carried-over lists come from', hint: 'Open lists moved on to today get a label like “From Sat 10 Oct”. When off, they just show up today.' },
      taskCategories: { label: 'Task list categories', hint: 'Group, sort, filter and color task lists by category. Switching off only hides them, nothing is deleted.' },
      addCategory: 'Add category',
      editCategory: 'Edit {name}',
      undatedDone: { label: 'Finished list without a date', calendar: 'Show on the day it was finished', archive: 'Archive only' },
      taskOpen: { label: 'Tapping a task list', inline: 'Grows in place', drawer: 'Opens the list' },
    },
    motivation: {
      calmMode: { label: 'Calm mode', hint: 'Fewer details, quieter colors, reduced motion' },
      streak: { label: 'Streak', off: 'Off', flame: 'Flame', plant: 'Plant' },
      currentStreak: 'Current streak',
      bestStreak: 'Best streak',
      supportCat: 'Support cat',
      supportSometimes: 'Sometimes',
      supportAlways: 'Every time',
    },
    motion: {
      animations: 'Animations',
      full: 'Full',
      reduced: 'Reduced',
      systemReduced: 'Your device asks for less motion, so animations are capped at Reduced.',
      ignoreSystem: { label: 'Ignore the device setting', hint: 'Use the animation level above even if the device asks for less motion' },
      sounds: 'Sounds',
    },
    labs: {
      weekTwoRow: { label: 'Two-row week overview', hint: 'Shows the week in two rows so all seven days fit on one screen without scrolling', split: 'Days on the top row' },
    },
    account: {
      signedIn: 'Signed in with Google',
      signOut: 'Sign out',
      signOutAll: { label: 'Sign out everywhere', hint: 'Ends the sign-in on every device, including this one', button: 'Sign out everywhere' },
      calendarAccess: { label: 'Calendar access', hint: 'Google Calendar access is missing. Grant it, and tick the calendar box on Google\'s screen.', grant: 'Grant calendar access' },
      resetDemo: { label: 'Reset demo data', hint: 'Replaces the demo calendar with fresh demo events', button: 'Reset', done: 'Demo data restored', failed: 'Could not reset demo data' },
      version: 'Version {version}',
      appCert: { label: 'App signing certificate (SHA-256)', hint: 'The Android app offered here is signed with this certificate. Compare it before you install an update.' },
      whatsNew: { label: 'What\'s new' },
      androidApp: { label: 'Android app', updateLabel: 'Update the app', hint: 'Install the calendar as an Android app with a weekly home-screen widget', download: 'Download' },
      installApp: { label: 'Install this app', hint: 'Add the calendar to your Home Screen', button: 'Show how', title: 'Install the calendar', step1: 'Tap the Share button', step2: 'Choose Add to Home Screen', step3: 'Tap Add', close: 'Got it' },
      versionCorner: { label: 'Show version in the corner' },
    },
    leftHanded: { label: 'Left-handed mode', hint: 'Mirrors the phone layout so the main controls sit under the left thumb' },
    navPosition: { hint: 'Where Year, Month, Week and Day sit', bottom: 'Bottom', top: 'Top', rail: 'Side rail', drawer: 'Side menu' },
    sunflowers: { label: 'Sunflowers', hint: 'Applies to the Sunflower field scene', grow: 'Grow with points', full: 'Full field' },
    ownThemes: { label: 'Generate themes with AI', hint: 'Experimental: get a prompt to paste into an AI, then import the theme it returns' },
  },
  themePreview: {
    label: 'Live preview',
    collapse: 'Collapse the live preview',
    expand: 'Expand the live preview',
    month: 'January 2030',
    today: 'Today',
    sample: {
      sync: 'Team sync', lunch: 'Lunch', run: 'Run', review: 'Review', call: 'Call',
      groceries: 'Groceries', milk: 'Milk', bread: 'Bread', eggs: 'Eggs',
    },
  },
  theme: themeEn,
};
