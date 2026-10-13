/**
 * English message catalogue: the source of truth for the message schema (ARCHITECTURE "i18n").
 *
 * Default export, like the other catalogues; the schema types live in `../schema.ts`.
 *
 * Keys are nested and named by meaning, not by text. Every other catalogue is checked against the shape of this
 * object, so a key missing in `de.ts` is a type error and `t()` only accepts keys that exist here. Message syntax is
 * vue-i18n's: `{name}` interpolates, `a | b` pluralises, and the characters `@`, `|`, `{` and `}` must be escaped.
 */
import calendarEn from './en/calendar.ts';
import canvasEn from './en/canvas.ts';
import bedtimeEn from './en/bedtime.ts';
import tasksEn from './en/tasks.ts';
import themeEn from './en/theme.ts';

export default {
  calendar: calendarEn,
  canvas: canvasEn,
  bedtime: bedtimeEn,
  tasks: tasksEn,
  views: {
    year: 'Year',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    tasks: 'Tasks',
    clock: 'Clock',
    timeline: 'Timeline',
    strip: 'Strip',
  },
  nav: {
    views: 'Views',
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
    untitled: 'List',
    titleOrItem: 'Add a title or an item',
    tooManyItems: 'A task list can have at most 200 items',
    tagsUnique: 'Tags must be unique',
  },
  settings: {
    title: 'Settings',
    back: 'Back',
    sectionsLabel: 'Settings sections',
    saveFailed: 'Could not save settings',
    sections: {
      appearance: 'Appearance',
      calendar: 'Calendar',
      tasklists: 'Task lists',
      motivation: 'Focus & motivation',
      motion: 'Motion & sound',
      bedtime: 'Bedtime',
      labs: 'Labs',
      account: 'Account & data',
    },
    theme: {
      label: 'Theme',
      hint: 'Mode, colour, glow, entries, corners and scene',
    },
    language: {
      label: 'Language',
      auto: 'Automatic',
    },
    calendar: {
      defaultView: 'Default view',
      defaultEventColor: 'Default event color',
      calendarColor: 'Calendar color',
      approachingCard: { label: 'Approaching card', hint: 'What is on now and next, above the calendar' },
      approachBar: { label: 'Approaching track', hint: 'What comes next today as a track in the Approaching card' },
      approachWindow: {
        label: 'Track reaches ahead',
        hours: '{count} hour | {count} hours',
        custom: 'Custom…',
        customLabel: 'Hours',
        invalid: 'Enter a whole number from 1 to 24',
      },
      tasksCalendar: { label: 'Show tasks calendar in Google', hint: 'Task lists stay in the app either way' },
    },
    tasklists: {
      categories: 'Categories',
      addCategory: 'Add category',
      editCategory: 'Edit {name}',
      moveUp: 'Move {name} up',
      moveDown: 'Move {name} down',
      undatedDone: { label: 'Finished list without a date', calendar: 'Show on the day it was finished', archive: 'Archive only' },
    },
    motivation: {
      warnBefore: 'Warn before an event starts',
      transitionWarning: 'Transition warning',
      minutes: '{count} min',
      calmMode: { label: 'Calm mode', hint: 'Fewer details, quieter colors, reduced motion' },
      streakFlame: 'Streak flame',
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
      experimental: { label: 'Experimental views', hint: 'Clock, Timeline and Strip in the view switcher' },
    },
    account: {
      signedIn: 'Signed in with Google',
      signOut: 'Sign out',
      resetDemo: { label: 'Reset demo data', hint: 'Replaces the mock calendar with fresh demo events', button: 'Reset', done: 'Demo data restored', failed: 'Could not reset demo data' },
      version: 'Version {version}',
      versionCorner: { label: 'Show version in the corner', hint: 'A small label in a bottom corner' },
    },
    leftHanded: { label: 'Left-handed mode', hint: 'Mirrors the phone layout so the main controls sit under the left thumb' },
    plant: 'Plant',
    sunflowers: { label: 'Sunflowers', hint: 'Applies to the Sunflower field scene', grow: 'Grow with points', full: 'Full field' },
    ownThemes: { label: 'Own themes (AI and import)', hint: 'Experimental: a prompt for an AI and the import of its theme file in the theme menu' },
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
