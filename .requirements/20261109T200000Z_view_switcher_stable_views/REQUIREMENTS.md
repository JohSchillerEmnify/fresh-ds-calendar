# View switcher: stable views on/off; Clock (rings) leaves Labs

## As Is
Year, Month, Week, Day, Tasks are always in the switcher; Labs views (incl. Clock rings, default off) follow, behind the Labs master switch.

## To Be
Main views Year, Month, Week, Day, Tasks, Clock each have a switch in Settings > Views (all on; the last one on is disabled). Per person pref `stableViews` (like `labsViews`). Switcher: main views on, then Labs views on (experimental). Labs keeps the beta views; the old plain clock is "Plain clock" there. Routes unchanged (`/clock-rings`, `/clock`).

## Requirements and acceptance
See `spec/features/views/view-switcher.feature` (one scenario per decision and edge case).

## Decisions and assumptions
- Pref key for the Clock is its route id `clock-rings`; `labsViews.clock` stays the Plain clock. Alternative (rename routes + redirect) rejected: more change, no user benefit.
- The Clock stays in `LABS_VIEWS` with `stable: true` (routing, dateless/dated handling and navigation reuse the registry), but is excluded from Labs switches and the experimental list.
- Server does not enforce "one stays on" (client disables the last switch; when every view is off the switcher offers all). Alternative: server-side check needs the merged state in `parse`; not worth it.
- Default view off: `/` opens the first main view that is on. The default-view picker (Month/Week/Day only) offers the ones that are on; hidden when none.
- A view switched off while open stays open until left (the settings are a separate page; Back returns to it).
- Prefs are now loaded before the first route resolves (main.ts) so `/` can honour the choice on a first load.
- The mockup's "Labs views" link row in Settings > Views was not built (Labs is its own settings group).
