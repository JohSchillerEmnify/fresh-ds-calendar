# Alternative calendar views for an ADHD-friendly phone calendar

Research date 2026-10-23. Scope: inspiration for views beyond month/week/day/year, for this app (Vue PWA + Android
shell, phone-first). Evidence labels follow `docs/ADHD-RESEARCH.md`: **[research]** peer-reviewed, **[practice]**
clinicians/community, **[product]** vendor pages (marketing, not evidence). `[unverified]` marks claims I could not
confirm from a primary source.

## Summary

The app already covers most "time as space" ideas: proportional timelines, a now line, a Now card with countdown, an
Approaching track, a 24-hour clock, horizontal/strip/zoom views, a two-row week, the open-tasks tray and a bedtime band.
What is still missing is less about *drawing time differently* and more about **answering one question per screen**:

- "What do I do *now*, and what is next?" (Now/Next deck, Live Update on the lock screen)
- "Where is my free time today?" (agenda with visible gaps, bedtime runway)
- "Is this week too full?" (capacity bars, load heatmap)
- "What do I do with all these open tasks?" (one-card-at-a-time triage)

Mainstream apps converge on the same answers: Tiimo's "now and next" widget and Live Activities, Sunsama's focus mode
and overcommitment warning, Timepage's busy-heatmap month, Fantastical's DayTicker, Structured's energy row, swipe-deck
task apps (Addie, BrainDump). The ADHD evidence (Barkley's "point of performance", time-based prospective memory
deficit, delay discounting, delayed chronotype) favours views that are **few, glanceable, about the next few hours, and
visible outside the app**. Exotic visualisations (spirals, rivers) are fun Labs toys but low value on a phone.

Ranking criterion: value for an ADHD-friendly phone calendar (externalises time at the point of performance, lowers
decision load, guilt-free) divided by effort, with a bonus for reusing existing pieces.

| # | Idea | Value | Effort |
|---|---|---|---|
| 1 | Now / Next deck | high | S–M |
| 2 | Agenda with visible gaps | high | M |
| 3 | Lock-screen Live Update countdown (Android) | high | M |
| 4 | Bedtime runway | high | S |
| 5 | Week capacity bars | medium-high | M |
| 6 | One-card task triage deck | medium-high | M |
| 7 | Busy heatmap month | medium | S |
| 8 | Morning / Afternoon / Evening buckets | medium | S |
| 9 | Look-back ribbon ("what I did") | medium | M |
| 10 | Day ticker + list | medium-low | M |
| 11 | "Weeks until" dot countdown | low-medium | S |
| 12 | Spiral week | low | L |
| 13 | Rhythm overlay / river of weeks | low | L |

---

## 1. Now / Next deck

**What you see.** A full-screen stack of three big cards, thumb-sized, nothing else: **Now** (current event or free time,
time left as words + shrinking bar), **Next** (title, "in 1 h 20 min", leave-by if any), and a collapsed **Later today**
card ("3 more · until 22:30 bed"). If a task list is the next thing, its first unticked item is on the Now card with a
tick box. Swipe the Now card up to see the next one as "now" (preview the future), tap to open, long-press the Next card
for "remind me 10 min before". Haptic tick when a countdown crosses the transition warning.

**Why it helps.**
- Barkley: externalise time at the *point of performance*; the problem is doing, not knowing
  (S6/S7 in `docs/ADHD-RESEARCH.md`). [research/practice]
- "Now and next" boards are a standard visual support for transitions in SEND/autism practice; the evidence is thin
  (case reports, no RCTs, nothing ADHD-specific): https://beyondautism.org.uk/wp-content/uploads/2021/10/Marta-Rapp-Wright.pdf ,
  https://structural-learning.com/post/now-next-boards-complete-visual-support [practice]
- Tiimo reworked its "Your Day" widget to "highlight what is happening now and what is coming up":
  https://www.tiimoapp.com/resource-hub/new-ios-widgets ; Sunsama's focus mode shows one task with a timer and nothing
  else (review, not docs): https://dhruvirzala.com/sunsama-review/ [product]
- Decision paralysis ("what should I do now?") is answered by a single next step (ADHD-RESEARCH 1.7). [practice]

**Fit.** Mostly a re-layout of what exists: the Now card (R3, R13), the Approaching window for "later", transition
warnings (R5), bedtime for the end of the day. A new `LABS_VIEWS` entry `{ id: 'now', route: '/now' }`. Calm mode =
no bar animation. Could later become the phone start view (backlog: "a day/agenda start view on phones").

**Effort.** S–M (layout + one swipe gesture; data already computed for the Now card).

```
+------------------------------+
| NOW                          |
|  Dentist                     |
|  35 min left                 |
|  [##########-------]  14:35  |
+------------------------------+
| NEXT  in 1 h 20 min          |
|  Call Mia        15:55       |
|  leave by 15:40              |
+------------------------------+
| LATER  3 more · bed 22:30  v |
+------------------------------+
```

## 2. Agenda with visible gaps

**What you see.** A vertical list of today and the next days, but **free time is a first-class row**: between two
entries a soft dashed block says "free 2 h 15 min" (or "free until 14:20 — leave-by"), and its height grows with the
length on a compressed scale (e.g. square root), so a free afternoon looks big and a 10-minute gap looks small. Entries
keep their real proportional height (min-event-length applies). Empty days collapse to one thin line ("Wed · free").
Drag a task list from the tray onto a gap to schedule it there; tap a gap to create an entry that fills it.

**Why it helps.**
- Google's Schedule view and Timepage's continuous week list are the most-used phone layouts for "what's coming":
  https://support.google.com/calendar/answer/6110849 ,
  https://www.macstories.net/reviews/timepage-a-beautiful-and-clever-calendar-app/ [product]
- Waiting mode: people cannot use the hours before an appointment; showing "free until 14:20" and guarding the
  departure makes that time usable (ADHD-RESEARCH 1.14, R25). [practice]
- Vimcal and TimeTree treat free slots as objects you can see and share (TimeTree: "see the available slots of both",
  share as image): https://vimcal.com/ , https://apps.apple.com/app/952578473 [product]

**Fit.** Must not break R1 ("no equal-height agenda lists"): entries stay proportional, only *gaps* are compressed,
and the compression is labelled in words. Reuses min-event-length, drag-and-drop (R23), the tray, bedtime (the day's
last gap ends at bedtime, not midnight). Directly answers the backlog item "a day/agenda start view on phones".

**Effort.** M (new layout engine for compressed gaps + drop target on gaps).

```
+------------------------------+
| TODAY  Thu 23                |
| 09:00 |#| Standup     30 min |
|       : free 1 h 30         :|
|       :                     :|
| 11:00 |##| Dentist           |
|       |##|                   |
|       : free until 14:20    :|
|       : (leave by)          :|
| 14:30 |#| Call Mia           |
|       : free 7 h  -> bed    :|
| FRI 24 · free                |
| SAT 25                       |
| 10:00 |##| Market            |
+------------------------------+
```

## 3. Lock-screen Live Update countdown (Android)

**What you see.** Not an in-app view: while an event runs, or within the transition window before it, the Android app
posts an ongoing progress notification ("Dentist · 35 min left", progress bar, next item as subtitle). It shows
prominently on the lock screen and status bar. Optionally a lock-screen widget with the Now/Next pair.

**Why it helps.**
- Tools that last are "visible, separate"; people wished for "tasks pinned to the lock screen" and "reminders that stay
  visible" (r/ADHD analysis, ADHD-RESEARCH 1.21, R32/R33). [research: qualitative]
- Tiimo puts timers and task progress on the lock screen via Live Activities:
  https://www.tiimoapp.com/product/widgets-live-activities [product]
- Android 16 added progress-centric notifications (states + milestones on a progress bar, shown prominently on the lock
  screen): https://www.androidauthority.com/android-16-live-updates-3556651/ ,
  https://androidauthority.com/android-16-live-notifications-3518375 . Lock-screen widgets for phones arrived with
  Android 16 QPR2 (Pixel; reachable from the screensaver/hub, one column):
  https://www.androidauthority.com/android-16-qpr2-lock-screen-widgets-phones-how-use-3621781 [product]
  `[unverified]` exact API names and which non-Pixel devices show Live Updates; check developer.android.com before
  building.

**Fit.** The Android shell already sends the bedtime notification and has a home-screen widget; this reuses the same
Now-card computation. Respects the notification budget (R29): one ongoing, silent notification, no repeats. A fallback
on Android < 16 is a normal ongoing notification with a progress bar.

**Effort.** M (native code, scheduling while the app is closed, testing on a device).

```
  lock screen
+------------------------------+
|           14:00              |
|                              |
| [cal] Dentist · 35 min left  |
|  [##########-------]         |
|  next: Call Mia 15:55        |
+------------------------------+
```

## 4. Bedtime runway

**What you see.** One tall vertical bar from **now** (top) to **bedtime** (bottom), the whole height of the screen,
regardless of how many hours are left. Entries are painted on it to scale; the free stretches are labelled ("2 h free").
At the top: "8 h 30 until bed · 5 h free". As the day goes on, the bar does not scroll, it *shrinks*: the remaining
evening fills the same screen, so 1 h left looks very different from 8 h left. A wind-down marker sits before bedtime.

**Why it helps.**
- Time-assistive devices that show remaining time "as shrinking dots or a shrinking surface" improved time orientation
  in an RCT with children with ADHD (ADHD-RESEARCH 1.22, S58). [research]
- The Time Timer disappearing disk pattern and "day progress" widgets (pie/bar of the day left):
  https://sindresorhus.com/day-progress , https://apps.apple.com/app/id6754074843 [product]
- Delayed chronotype and bedtime procrastination in ADHD (1.15); errors grow with interval length, so long stretches
  need the strongest externalisation (1.12). [research]

**Fit.** Reuses the bedtime setting and bedtime band, min-event-length, the Approaching track's "entries take only
their duration" layout (rotated vertical). Doubles as a home-screen widget size. R27 (wind-down cue) gets a visual home.

**Effort.** S.

```
+------------------------------+
| 8 h 30 until bed · 5 h free  |
| now 14:00 ┬                  |
|           |##| Call Mia      |
|           |  | 2 h free      |
|           |  |               |
|           |##| Dinner        |
|           |  | 3 h free      |
|           |  |               |
|           |~~| wind down     |
| bed 22:30 ┴                  |
+------------------------------+
```

## 5. Week capacity bars

**What you see.** Seven vertical bars, one per day, each as tall as that day's **awake hours** (wake → bedtime). The
filled part is booked time (events + task-list estimates), the rest is free. Above each bar: "4 h free". A day booked
beyond a chosen comfort level gets a calm "full" label in the tertiary colour (no red). Tap a bar to open the day; drag
a task list from the tray onto a bar to put it on that day.

**Why it helps.**
- Sunsama's planning ritual warns when you are overcommitted and makes you cut tasks before the day starts:
  https://dhruvirzala.com/sunsama-review/ [product]
- People with ADHD plan from their rare hyperfocus days and overestimate what fits; participants preferred a calm
  "brain weather" dashboard over red overdue items (CSCW 2026, ADHD-RESEARCH 1.21, S24). [research: qualitative]
- Structured shows an Energy Monitor row in its daily, weekly and monthly views: https://structured.app/blog/4-0 ;
  LGO trains matching activities to energy (1.22, R37). [product] [research]

**Fit.** Needs wake time (new setting, or derived from the bedtime setting + sleep length) and uses task-list duration
estimates (R10). An optional energy band per day (R37) can sit under each bar. Fits the two-row week layout as an
alternative header row.

**Effort.** M.

```
+------------------------------+
|  Mo  Tu  We  Th  Fr  Sa  Su  |
|  4h  1h  9h  6h  2h  8h 10h  |
| +--+ +--+ +--+ +--+ +--+ +--+|
| |  | |##| |  | |  | |##| |  ||
| |  | |##| |  | |##| |##| |  ||
| |##| |##| |  | |##| |##| |##||
| |##| |##| |##| |##| |##| |  ||
| +--+ +--+ +--+ +--+ +--+ +--+|
|      full                    |
+------------------------------+
```

## 6. One-card task triage deck

**What you see.** Open task lists (from the tray: today + carried-forward) are shown **one card at a time**, full width.
Swipe right = "today" (goes into the next free gap, see #2), swipe left = "later" (tomorrow / pick a day), swipe up =
"done", tap = open and tick items. A small counter "3 of 7" and a gentle end card ("That's all. Nice."). Haptic tick per
swipe, card springs back if cancelled.

**Why it helps.**
- Several ADHD task apps converged on this: Addie "only shows one task at a time to help keep you focused and avoid
  overwhelm" (https://addieapp.notion.site/Intro-to-Addie-901ca0c97ed8442db096fb0cb0fd3d8d), BrainDump swipe cards for
  focus/later/done (https://www.producthunt.com/products/braindump-voice-tasks-focus), ADHD Hyper Planner's daily
  swipe deck (https://apps.apple.com/ca/app/adhd-hyper-planner/id6759459572). [product] No research found comparing
  swipe triage to lists. `[unverified]` effectiveness.
- The app-hopping cycle ("list of well over 100 tasks… get overwhelmed, stop checking the app") argues for never
  showing the whole pile at once (1.21). [research: qualitative]
- Android haptics guidance: few, clear, action-tied effects (CONFIRM/REJECT), "less is more":
  https://developer.android.com/develop/ui/views/haptics/haptics-principles [product docs]

**Fit.** Reuses the tray's data (R6/R7 carry-forward, "Move to today"), the DnD spring/lift physics (R23), reward
animations on "done" (R18/R19), the animation-level setting. No shame: "later" never shows a count of postponements.

**Effort.** M.

```
+------------------------------+
| Open tasks          3 of 7   |
|   +----------------------+   |
|   | From Tue 21          |   |
|   | Groceries   ~30 min  |   |
|   | [ ] milk             |   |
|   | [ ] bread  +2        |   |
|   +----------------------+   |
|  <- later   ^ done  today -> |
+------------------------------+
```

## 7. Busy heatmap month

**What you see.** The month grid without chips: each day is a soft blob whose colour depth = booked hours (not number
of events). Today has a ring. Below the grid, the selected day's mini agenda. Swiping between months works as in the
month view. A toggle shows "free hours" instead (inverse shading) for finding a free evening.

**Why it helps.**
- Timepage's "month heatmap" shades days by how busy they are; reviewers found it clearer about free days than dots:
  https://www.macstories.net/reviews/timepage-a-beautiful-and-clever-calendar-app/ ,
  https://www.tapsmart.com/news/moleskine-timepage-gets-month-view-in-significant-update/ ; Fantastical's year view is a
  heat map: https://www.flexibits.com/fantastical-ios/help/calendar-views [product]
- Calendar heatmaps as a vis technique: van Wijk & van Selow, "Cluster and calendar based visualization of time series
  data", InfoVis 1999 (secondary description: https://arxiv.org/pdf/2507.14920). [research]
- Low clutter (1.4) and the backlog's "month view with dots per day plus the selected day's list below".

**Fit.** The year view already computes density marks; reuse that per day at month scale. Respect calm mode (one hue).
Note: the phone month must still open the proportional day (R1), which the mini agenda below should be.

**Effort.** S.

```
+------------------------------+
| October 2026                 |
|  M  T  W  T  F  S  S         |
|           .  o  O  .         |
|  o  O  @  o  .     .         |
|  .  O  o (@) o  O  .         |
|  o  o  .  O  @  .            |
+------------------------------+
| Thu 23 · 6 h booked          |
| 09:00 Standup                |
| 11:00 Dentist                |
+------------------------------+
```

## 8. Morning / Afternoon / Evening buckets

**What you see.** A day split into four soft sections: **Anytime**, **Morning**, **Afternoon**, **Evening**. Timed
entries appear in their section in time order with their time; untimed task lists sit in Anytime or in a section you
drag them to ("this evening" without a clock time). The current section is highlighted and the past ones fold up.

**Why it helps.**
- Tiimo's watch app groups today's tasks into Anytime, Morning, Afternoon and Evening:
  https://www.tiimoapp.com/product/apple-watch [product]
- Many ADHD days are planned in "parts of the day" rather than clock times; mainstream tools wrongly assume linear time
  and steady self-regulation (CSCW 2026, 1.7). [research: qualitative]
- Supports flexible plans without committing to an exact slot (fewer "missed" moments → less guilt, 1.3/1.8).

**Fit.** Needs a "part of day" field on task lists (or a derived one from an untimed list's placement). Section
borders come from settings (wake, 12:00, 17:00, bedtime). Can be a lighter alternative to the timeline in calm mode.
Conflicts mildly with R1 (not proportional); keep it a Labs view, not the default.

**Effort.** S (view) + S (data field).

```
+------------------------------+
| ANYTIME                      |
|  ( ) Call insurance          |
| MORNING            (folded)  |
| AFTERNOON  <- now            |
|  14:30 Call Mia              |
|  ( ) Groceries  ~30 min      |
| EVENING                      |
|  19:00 Dinner w/ Jo          |
|  22:30 bed                   |
+------------------------------+
```

## 9. Look-back ribbon ("what I did")

**What you see.** A horizontal ribbon of the last 7 days, each day a column of what *happened*: finished task lists
(with their tick count), past events, and — if R35 lands — estimate vs actual bars. No empty states, no "missed". After
a gap of several days the app opens here once with "Welcome back — here's what you did" instead of overdue counts.

**Why it helps.**
- Progress feedback can feed guilt; make recovery visible and coming back easy (r/ADHD analysis, 1.21); lapses are
  normal and the design task is resuming (Epstein et al., S55). [research]
- LGO notes a calendar lets people look back at what they have done (1.22, S57). [research]
- Life Cycle's passive "what did my day consist of" donuts: https://apps.apple.com/app/apple-store/id1064955217
  [product]

**Fit.** This is R34 (proposed). Reuses completed task lists, reward visuals, the plant/streak "Welcome back!" copy.

**Effort.** M.

```
+------------------------------+
| This week, done              |
|  Fr   Sa   Su   Mo   Tu  We  |
| [v3] [v1]      [v5] [v2] [v4]|
| Gym  Mkt       Doc  Call Yoga|
| ~45  ~30            40/30    |
| "Welcome back - 15 things"   |
+------------------------------+
```

## 10. Day ticker + list

**What you see.** A thin horizontal strip at the top shows ~5 days; each day has small coloured pills placed by time of
day (morning left, evening right). Below, the selected day's proportional timeline. Swipe the strip to move days; pull
it down to reveal the month; push it up for tasks.

**Why it helps.**
- Fantastical's DayTicker: pills "positioned by time of day", swipe the ticker to change the day, pull down for the
  month, swipe up for tasks: https://www.flexibits.com/fantastical-ios/help/calendar-views . A reviewer noted the
  sideways ticker vs vertical list can be confusing:
  https://www.macworld.com/article/219839/review-fantastical-for-iphone-shines-despite-ios-caused-limitations.html
  [product]
- Keeps the "next few days" visible at the point of looking at today (1.12: far things are felt less).

**Fit.** Close to the existing Strip view and the month picker; could be a header option for the day view rather than
a new view. Lower value because the app already has many ways to see several days.

**Effort.** M.

```
+------------------------------+
| We  [Th]  Fr   Sa   Su       |
| -=- -==-= ---  =--  ---      |
+------------------------------+
| 09:00 |#| Standup            |
| 11:00 |##| Dentist           |
|  now ----------------------- |
| 14:30 |#| Call Mia           |
+------------------------------+
```

## 11. "Weeks until" dot countdown

**What you see.** For one pinned future event (holiday, exam, deadline), a grid of dots, one per day (or week) from
today to the event: past dots filled, remaining hollow, the event as a star. Text: "23 days · 3 weekends". Can live as a
card above the month or as a widget.

**Why it helps.**
- Delay discounting and present orientation: the future is felt less, so make it present (1.13, R31). [research]
- "Your Life in Weeks" grids turn abstract spans into countable dots (Tim Urban, Wait But Why):
  https://coolinfographics.com/blog/2015/4/17/your-life-in-weeks.html [practice]
- Shrinking dots are one of the time-device forms in the Wennberg RCT (1.22). [research]

**Fit.** Needs "pin as countdown" on an event. Reuses the year view's mini-month dot rendering. Breaking a far deadline
into steps that land today (1.13) could later attach task lists to the countdown.

**Effort.** S.

```
+------------------------------+
| Holiday  ·  23 days          |
| ● ● ● ● ● ● ●                |
| ○ ○ ○ ○ ○ ○ ○                |
| ○ ○ ○ ○ ○ ○ ○                |
| ○ ○ ★   3 weekends to go     |
+------------------------------+
```

## 12. Spiral week

**What you see.** A spiral of 7 turns, one per day, 24 h per turn, today on the outermost turn. Events are arc
segments; the bedtime band forms a radial wedge that repeats every turn, so a drifting bedtime is visible as a twist.
A dot marks now. Pinch zooms toward the centre (older days).

**Why it helps.**
- Spirals make periodic patterns easier to spot than bars/lines (Weber, Alexa, Müller, InfoVis 2001):
  https://vis.pku.edu.cn/course/datavis_f23/material/Visualizing_Time-Series_on_Spirals.pdf [research]
- But for 24-hour data, linear charts were more accurate and efficient; radial was rated more aesthetic
  (ADHD-RESEARCH 1.23, S62–S64). [research] → a reflection/pattern view, not an orientation view.

**Fit.** Extends the Labs clock's arc rendering and hit-testing. Fun, but on a 360 px wide phone the inner turns get
tiny; arcs of 15-minute events are unreadable even with min-event-length.

**Effort.** L.

```
+------------------------------+
|        .-''''''-.            |
|      .'  .-''-.  '.          |
|     /   /  .-. \   \  Th     |
|    |   |  ( * ) |   | <- now |
|     \   \  '-' /   /         |
|      '.  '-..-'  .'          |
|        '-......-'   bed ===  |
+------------------------------+
```

## 13. Rhythm overlay / river of weeks

**What you see.** Either (a) the last 8 weeks stacked on one week grid with transparency, so habitual blocks
(Tuesday gym, late Fridays) appear as darker "typical week" shapes, or (b) a horizontal stream graph over months where
each calendar/colour is a band whose width is booked hours.

**Why it helps.**
- Calendar + clustering reveals standard daily patterns and outliers (van Wijk & van Selow 1999, see #7). [research]
- ThemeRiver shows how the strength of themes rises and falls over time (Havre, Hetzler, Nowell, InfoVis 2000):
  https://www.cg.tuwien.ac.at/courses/InfoVis/HallOfFame/2004/05_ThemeRiver/papers/themeriver99.pdf [research]
- Weak ADHD link: pattern-based nudges "felt like being watched" (1.21), so this must stay a look, never a suggestion.

**Fit.** Reuses week grid rendering; needs history beyond what the views normally fetch. Low daily value.

**Effort.** L.

```
+------------------------------+
| typical week (last 8)        |
|  M  T  W  T  F  S  S         |
|  .  ▓  .  .  .  .  .  08     |
|  ▒  ▒  ▒  ▒  ▒  .  .  12     |
|  .  ▓  .  ░  .  ▒  .  18     |
|  .  .  .  .  ▓  ▓  .  22     |
+------------------------------+
```

---

## Cross-cutting interaction notes (phone)

- **One hand, bottom half.** Hoober observed ~49 % one-handed grips (2013, n ≈ 1 300); top corners are hardest to reach:
  https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php . Later work suggests
  people prefer content in the centre: https://addyosmani.com/blog/touch-friendly-design/ . Put the primary action
  of each new view (swipe deck, Now card actions) in the lower half; the app already has rail/bottom-bar/left-handed
  options to reuse.
- **Haptics:** one clear effect per meaningful event (pick-up, drop, done, transition), never as a reminder loop:
  https://developer.android.com/develop/ui/views/haptics/haptics-principles . PWA on iOS has no Vibration API
  (ADHD-RESEARCH 1.9).
- **Glanceable outside the app** beats new in-app views for ADHD (1.21): Live Updates (#3), lock-screen/home widgets
  for #1 and #4.
- **Delight without noise:** Google Calendar's keyword illustrations in the schedule view and Amie's "joyful" design are
  liked, but should obey calm mode: https://androidauthority.com/google-calendar-event-illustrations-toggle-3493923 ,
  https://thereport.substack.com/p/a-joyful-calendar [product]

## Not verified

- Effectiveness of any vendor feature above (Tiimo, Sunsama, Structured, swipe-deck apps) — marketing only.
- Exact Android 16 Live Update API surface and OEM support beyond Pixel.
- Whether Sunsama's focus mode includes a Pomodoro timer (third-party claim only).
- No ADHD-specific evidence for now/next boards, swipe triage, heatmaps or spirals was found.

## Recommended next Labs experiments

1. **Now / Next deck (#1)** — smallest step to a calmer phone start screen; almost all data exists (Now card,
   Approaching window, transition warning). Success check: owner uses it as the first screen for a week.
2. **Agenda with visible gaps (#2)** — answers the backlog's "day/agenda start view on phones" without breaking R1
   (entries proportional, only gaps compressed and labelled) and gives waiting mode (R25) a visible home. Needs a spec
   decision on the gap scale (sqrt vs fixed cap).
3. **Bedtime runway (#4)** — cheapest high-value one (S): now → bedtime on one fixed-height bar that shrinks, built from
   the bedtime setting and the Approaching layout; doubles as a widget later and as the visual home of the wind-down
   cue (R27).

Follow-on outside Labs: the Android **Live Update countdown (#3)**, once #1's content has settled, since it carries the
same Now/Next content to the lock screen.
