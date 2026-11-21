# 0047 — Sharing sends an invitation first

- Status: accepted
- Views shaped: `server`, `web`
- Refines: [0046](0046-people-are-known-by-a-typed-address-or-by-sharing.md)

## Context

Typing an address already kept the list of everybody out of sight (0046), but a share that worked still showed the
sharer the other person's name and that the address uses the app. Sharing also put a list on somebody's screen without
their say.

## Decision

- Sharing a list or a category sends an invitation. Nothing is shared, and nothing about the other person is shown to
  the sharer, until the invited person accepts.
- The invitation is stored under the typed address (`DATA_DIR/shared/invitations.json`), so one for a person who has
  not signed in yet waits for the first sign-in. It lapses after 7 days.
- The share calls look nothing up: a known, an unknown and a removed address get the same `200`, body shape and minimum
  time. The sender sees "Invitation sent to <address>" with Withdraw, the same for every address, and still after the
  other person declined (until withdrawn or lapsed).
- The invited person finds the invitation as a card at the top of the Tasks view, announced once by a snackbar with
  Show; Accept shares both ways as before, Decline removes the card. No push notification.
- Accepting runs on the owner's calendar service (`ctx.calendarFor(owner)`), so moving a Google list into the shared
  store needs nothing from the invited person's account. A person is offered in "Share with" only after accepting.
- The device keeps the invitations like every file of the change feed, so cards and the pending line show offline;
  answering needs the server.

- At most 50 invitations stay open per person (the same refusal whatever the address). `invitations.json` is deliberately
  not backed up: an invitation lapses after 7 days and can be sent again.
- If the sharer's Google cannot be reached when accepting, the invited person gets a neutral "try again later" and the
  invitation stays; a sharer who may no longer use the calendar has no invitations shown.

## Alternatives

- **Share at once and hide the reveal:** the list would still appear unasked, and the sharer's list would change
  shape for a known address only.
- **A notice only (no card):** gone after a few seconds; the card stays until answered.
- **A push notification:** left out for now; the snackbar and card cover people with the app open.
- **Tell the sharer about a decline:** rejected; it would tell the sharer more than "Invitation sent".
- **Block re-invites after a decline:** rejected; it would tell the sharer that the address declined.

## Consequences

- Sharing is two steps; the sender cannot tell a missing person from a person who has not answered.
- A declined invitation stays for the sender until withdrawn or lapsed. Declining answers only that one invitation: sending the same address again replaces the declined entry with a new invitation (a new card for the invited person). The sender cannot tell the two cases apart, in the line or in the API or device copy: the sender holds a stable handle of their own (the incoming invitation's id is never sent to them), every send again gives a fresh 7 days, and the entry keeps its place. Only the invited person's id changes, and only after a decline.
- Several people per share (issue 27) can reuse the same invitations.
