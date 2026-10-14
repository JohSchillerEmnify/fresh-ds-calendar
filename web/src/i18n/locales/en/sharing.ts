/**
 * English messages of shared task lists (ARCHITECTURE "Shared lists"): the badge, the share controls of the task list
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
  noPeople: 'Nobody else can be added yet: they have to sign in once.',
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
  ownerCannotLeave: 'The owner deletes the list or stops sharing it.',
  categoryOwnerOnly: 'Only the owner can change the category of a shared list.',
};
