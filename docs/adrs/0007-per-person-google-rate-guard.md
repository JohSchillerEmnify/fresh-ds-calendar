# 0007 — A per-person read cache and cooldown in front of Google

- Status: accepted (owner incident, 2026-10-14)
- Views shaped: `server`, `loadRange`, `rateLimitedRead`

## Context

After a deploy restart one person produced about 100 rate-limit answers from Google in a minute: one range fetch
fans out to one list call per calendar, nothing was cached or shared between parallel requests, and a failed read
left nothing behind. Google's per-person limit then turned every request into "Can't reach Google Calendar".

## Decision

Each person's Google provider has a rate guard:

- Reads are cached for a short time, shared while in flight, and dropped on every write. Reads that need the live
  version (read-modify-write) are never cached.
- A rate-limit answer starts a cooldown that grows while they repeat. During it no Google call is made: reads answer
  from the cache, marked stale, and everything else fails as "rate limited".
- The web app shows no error banner for a rate-limited failure while it has data to show.

## Alternatives

- *One global limiter* — Google's limit is per person; one person's burst must not slow the others.
- *Serve stale data on every provider failure* — outages must stay visible; only the rate limit is a known
  transient.
- *A longer cache* — remote changes would show later than the poll people expect.

## Consequences

- A remote change can take up to the cache time longer to show.
- Rate limiting is logged once per cooldown, not per request.
