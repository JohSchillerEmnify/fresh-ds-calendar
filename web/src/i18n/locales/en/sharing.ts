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
  invite: {
    acceptLater: "Couldn't accept the invitation right now. Try again later.",
    cardList: 'Invitation to a task list',
    cardCategory: 'Invitation to a category',
    textList: '{address} invites you to share “{title}”.',
    textCategory: '{address} invites you to share the category “{title}”.',
    snackbar: '{address} invites you to share “{title}”',
    snackbarCategory: '{address} invites you to share the category “{title}”',
    show: 'Show',
    accept: 'Accept',
    decline: 'Decline',
    sent: 'Invitation sent to {address}',
    withdraw: 'Withdraw',
    acceptFailed: "Couldn't accept the invitation.",
    declineFailed: "Couldn't decline the invitation.",
    withdrawFailed: "Couldn't withdraw the invitation.",
  },
  tooMany: 'You have too many open invitations. Withdraw one first.',
  ownerOnlyCategory: 'Only the owner can change the category of a shared list.',
  category: {
    hint: 'The person is invited. Once they accept, all lists of this category, and new ones, are shared.',
    failed: "Couldn't change sharing.",
  },
  ownerOnly: 'Only the owner can do this.',
  needsSignIn: 'Sharing needs sign-in.',
  self: 'You cannot share with yourself.',
  repeating: 'A repeating task list cannot be shared.',
  ownerCannotLeave: 'As the owner, you can delete the list or stop sharing it.',
  categoryOwnerOnly: 'Only the owner can change the category of a shared list.',
};
