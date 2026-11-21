# Sharing sends an invitation first (issue 183)

Behaviour lives in `spec/features/task-lists/shared-lists.feature`, the contract in `spec/API.md` ("Invitations"), the
decision in ADR 0047. This file keeps the plan and the assumptions.

## As is
Sharing moved a list at once for an address the server knew, and answered neutrally for any other address; a working
share showed the sharer the other person's name.

## To be
Sharing sends an invitation; the invited person accepts (shares both ways), declines (the sender is told nothing new) or
lets it lapse after 7 days. Nothing about the other person is revealed to the sender before acceptance.

## Plan
1. Spec and steps (done first). 2. Server: invitation store keyed by address, `GET /api/invitations`, accept, decline,
withdraw, change feed file. 3. Web: device file, cards, snackbar, pending line. 4. e2e steps, pictures, docs.

## Assumptions
- A declined invitation stays declined: sending it again changes nothing for either person.
- An invitation of a list follows the list when it moves into or out of the shared store; one whose list or category is
  gone answers 404 on accept and is dropped.
- A person is offered in "Share with" only after accepting, so the field does not tell who uses the app.
- Answering an invitation needs a connection; the cards and the pending line show from the device copy.
- The snackbar stays 10 seconds; it is announced once per invitation and device.
