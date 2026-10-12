
## adhd-support: "A weekly task list repeats and each week is ticked separately" (@optional, mobile + desktop)

Ticking an item on the first occurrence (the recurring master) also shows the tick on 2026-10-21: the mock provider
expands virtual instances by cloning the master's private properties (`items` with done flags), like Google does for
unmodified instances. Fix needs a server design decision (on a tick of a master with a rule, split the first occurrence
into an exception event, or reset `done` when expanding). Left open: optional feature, server/provider work outside the
events UI group.
