# Share from the list's overflow menu (issue 27)

## As Is
Sharing is done in the list form; once a list is shared or invited, the field is gone, so only one person can be added.

## To Be
- "Share" is an entry of the overflow menu of the opened list (owner only, signed in); it opens the list's form with the "Share with" field focused. Reason: the form already holds the field (issues 182/183); a second sheet would duplicate it.
- The field stays for more people; every sent invitation has a line with Withdraw, every accepted person a line "Shared with <name>"; one "Stop sharing" ends it for everybody.
- A member reads "Shared by <name>" and "Also shared with <names>"; no field.
- Category sharing stays one person.

## Requirements and acceptance
See the scenarios in spec/features/task-lists/shared-lists.feature (issue 27 block).

## Assumptions
- The server already allows several members and invitations per list (checked in invitations.ts, taskSharing.ts); no server change.
- "Stop sharing" is per list (everybody), not per person: removing one person needs a new server call.
