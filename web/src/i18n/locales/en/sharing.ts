/**
 * English messages of shared task lists (feature shared-lists): the badge, the share controls of the task list
 * dialog and the category dialog, and the server's error keys (`sharing.*`). Spread into the catalogue as `sharing`;
 * `{ } @ |` must be escaped.
 */
export default {
  badge: 'Shared with {name}',
  badgeMember: 'Shared by {name}',
  title: 'Sharing',
  person: 'Person',
  choose: 'Choose a person',
  share: 'Share',
  stop: 'Stop sharing',
  leave: 'Leave',
  sharedWith: 'Shared with {names}',
  noPeople: 'Nobody can be added yet. A person has to sign in to the app once first.',
  shareFailed: "Couldn't share the list.",
  stopFailed: "Couldn't stop sharing.",
  leaveFailed: "Couldn't leave the list.",
  ownerOnlyCategory: 'Only the owner can change the category of a shared list.',
  category: {
    label: 'Share with',
    nobody: 'Nobody',
    hint: 'All lists of this category, and new ones, are shared with this person.',
    failed: "Couldn't change sharing.",
  },
  ownerOnly: 'Only the owner can do this.',
  needsSignIn: 'Sharing needs sign-in.',
  self: 'You cannot share with yourself.',
  unknownPerson: 'This person cannot be added.',
  repeating: 'A repeating task list cannot be shared.',
  ownerCannotLeave: 'As the owner, you can delete the list or stop sharing it.',
  categoryOwnerOnly: 'Only the owner can change the category of a shared list.',
};
