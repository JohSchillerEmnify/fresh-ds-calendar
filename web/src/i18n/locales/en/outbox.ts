/** Texts of the offline outbox: the "not synced" popover, the notices of refused changes, the sign-out warning (ADR 0031). */
export default {
  icon: 'Not synced — details',
  title: 'Not synced yet',
  lastToday: 'Last synced today at {time}',
  lastOn: 'Last synced {date} at {time}',
  lastNever: 'Not synced yet on this device',
  empty: 'Nothing waiting to be sent.',
  hint: 'Changes are sent automatically when the connection is back.',
  change: {
    ticked: '{title} ticked',
    created: '{title} created',
    renamed: '{title} renamed',
    changed: '{title} changed',
    deleted: '{title} deleted',
  },
  gone: 'The change to “{title}” was not saved because it was deleted elsewhere.',
  refused: 'The change to “{title}” was not saved because it was rejected.',
  editAgain: 'Edit again',
  signOutAsk: 'Sign out and lose {count} unsent change? | Sign out and lose {count} unsent changes?',
  signOutAnyway: 'Sign out anyway',
  stay: 'Stay signed in',
};
