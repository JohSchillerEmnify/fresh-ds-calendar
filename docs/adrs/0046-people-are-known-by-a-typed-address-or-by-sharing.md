# 0046 — People are known only by an address you typed or by sharing

- Status: accepted
- Views shaped: `server`, `web`
- Refines: [0011](0011-shared-lists-on-the-server.md)

## Context

"Share with" offered everybody who had ever signed in, so every person saw the email address and name of every other
person who uses the app. An address is personal data that its owner never agreed to show.

## Decision

- The server never lists everybody. `GET /api/people` (and the `people` file of the change feed) returns only the
  requester's own contacts: addresses they typed for a successful share, people who share a list with them, and people
  they share with (a category rule counts). The addresses typed are stored per person (`users/<sub>/share-contacts.json`).
- A person is chosen by typing an email address (trimmed, lower case). The server finds the person behind it; an address
  that names nobody who may use the calendar gets the same `200` as a share that shared nobody, after the same minimum
  time, and stores nothing. The status, body shape and time do not tell the two apart.
  The app shows one neutral sentence for it.
- The device keeps the contacts like every file of the change feed, so the suggestions work offline.
- The "a newcomer signed in" nudge to everybody's devices is gone: nobody else's list changes when someone signs in.
- What a successful share reveals is not hidden: the sharer's list turns shared and shows the other person's Google
  display name and address, and a category share lists them in `shares`. So a sharer can learn that an address uses the
  app, and its display name, for addresses they typed. This is open for the owner to decide.

## Alternatives

- **Keep the everyone list:** simplest, but shows every address to every user; rejected as the problem itself.
- **A per-household opt-in ("let others find me"):** a setting per person, off by default, that makes them appear in
  others' lists. More to build and to explain, and a person who says yes still shows their address to everybody in the
  household; typing an address needs no setting.
- **A pending invitation the other person accepts:** would hide even the owner-side signal, but needs a new flow, a
  notification path and states; planned work on sharing with several people can add it later.

## Consequences

- Sharing needs the other person's address; there is no browsing.
- A removed person drops out of every contact list; an address is remembered only after its share worked.
- An address you shared with stays suggested to you after you stop sharing. A person who only shared a list with you is
  suggested while a list connects you and drops out when it is gone.
