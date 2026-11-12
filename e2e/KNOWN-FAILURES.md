# Known failures

## Heavy-load timing (issue #13)
- Two day-view edge-turn scenarios and the iPhone "quick swipe that starts on an event still scrolls the day" fail
  only when the test machine is heavily loaded: the app reacts on time, the test about 60-100 ms late. Re-run when the
  machine is idle.

The `@perf` scenarios (phone performance audit, idle server size) have no open known failure; their limits are in
`spec/features/app/performance.feature`.
