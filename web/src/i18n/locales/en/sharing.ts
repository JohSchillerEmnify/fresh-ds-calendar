/**
 * English messages of shared task lists (feature shared-lists): the badge, the share controls of the task list
 * dialog and the category dialog, and the server's error keys (`sharing.*`). Spread into the catalogue as `sharing`;
 * `{ } @ |` must be escaped.
 */
export default {
  badge: 'Shared with {name}',
  badgeMember: 'Shared by {name}',
  title: 'Share with',
  person: 'Person',
  share: 'Share',
  stop: 'Stop sharing',
  leave: 'Leave',
  sharedWith: 'Shared with {names}',
  shareFailed: "Couldn't share the list.",
  stopFailed: "Couldn't stop sharing.",
  leaveFailed: "Couldn't leave the list.",
  ownerOnlyCategory: 'Only the owner can change the category of a shared list.',
  category: {
    hint: 'All lists of this category, and new ones, are shared with this person.',
    failed: "Couldn't change sharing.",
  },
  ownerOnly: 'Only the owner can do this.',
  needsSignIn: 'Sharing needs sign-in.',
  self: 'You cannot share with yourself.',
  neutral: "If this person uses the calendar, they'll see the list.",
  repeating: 'A repeating task list cannot be shared.',
  ownerCannotLeave: 'As the owner, you can delete the list or stop sharing it.',
  categoryOwnerOnly: 'Only the owner can change the category of a shared list.',
};
