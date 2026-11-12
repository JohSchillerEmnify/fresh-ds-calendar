# ADHD research: what a calendar must do differently

Research date 2026-10-12; time-specific follow-up (1.11–1.20, R25–R31) and community, time-aid and visualisation research (1.21–1.23, R32–R37) 2026-10-13/14. Purpose: ground the calendar's ADHD-specific requirements in evidence and in practice from
ADHD-focused tools. **Evidence quality varies a lot.** Each section is labelled:
- **[research]**: peer-reviewed or clinical.
- **[practice]**: clinicians and coaches, ADHD organisations, community reports.
- **[product]**: vendor documentation.

Product claims about effectiveness are marketing, not evidence. They are used only to show which patterns are
established and expected by users.

## 1. Findings

### 1.1 Time blindness is real and measurable [research]
- A meta-analysis of 55 studies (Marx, Cortese, Koelch, Hacker; *JAACAP*, 2021) found timing deficits in ADHD in every
  paradigm:
  - time discrimination: 25 studies, n = 1 633, medium effect;
  - time estimation: 8 studies, n = 1 024, small to medium;
  - time production: 7 studies, n = 380, small;
  - time reproduction: 26 studies, n = 2 364, medium.
  No publication bias was detected. [S1][S2]
- Results in adult samples are mixed. A 2021 Czech study of adults found no clear relation between symptom severity and
  time-perception accuracy, although estimation error grew with duration. [S3] A qualitative follow-up (n = 20) found that
  adults with more symptoms chose less adaptive solutions in time-related everyday situations. [S4] Sex differences have
  also been reported. [S5]
- Barkley's model describes ADHD as a problem of **performance**, not knowledge: people know what to do but fail to do
  it at the moment it matters. His recommended remedy is to **externalise time and information at the "point of
  performance"**, for example with visible timers, clocks and planners in sight, broken into small steps. [S6][S7]

**Implication:** time has to be *seen*, not computed. Durations must be visually proportional. "Now" must be marked.
The remaining time must be stated in words and shown as a shrinking quantity, at the moment of use.

### 1.2 Visible elapsed time and transition cues [practice] [product]
- Visual "disappearing disk" timers (Time Timer) are widely used in ADHD and autism support to make remaining time
  concrete and ease transitions. Controlled evidence specific to ADHD is thin; the vendor cites research but not
  studies. [S8][S9]
- Tiimo builds on a colour-coded visual timeline and a visual countdown "to ease transitions". It also offers lock-screen
  and widget glanceability. [S10]
- Clinical and coaching sources split a transition into stop, move and start. They recommend timed warnings before a
  switch, planned buffers, and written "where I paused" markers, especially to break hyperfocus. [S11][S12]

**Implication:** the app needs a live now line, a "time left / starts in" read-out with a progress bar, and in-app
transition warnings a few minutes before an event. Notifications came later with HTTPS: Web Push for the installed web app and system notifications in the Android app (feature `reminders`).

### 1.3 Out of sight, out of mind [practice] [research]
- Community and practitioner sources consistently report that tasks and planners that are not visible are forgotten.
  "Forgetting the planner exists" is a classic failure mode. [S13]
- In a survey project on neurodivergent students, calendars (especially Google Calendar) were the most used tool.
  Juggling several systems caused overwhelm, which argues for **one place** where events and tasks live together. [S14]
- Interviews with adults with ADHD show tools are abandoned when they need too much manual upkeep or don't fit routines.
  [S15] Adults with ADHD report dissatisfaction with existing time-management tools. [S16]
- Structured offers "Replan", which reschedules missed tasks automatically. [S17] Sunsama rolls unfinished tasks
  forward and deliberately avoids red overdue warnings. [S18]

**Implication:** open task lists must always be reachable (a persistent tray). Unfinished lists from past days must
**carry forward to today**, gently flagged and not hidden in the past. Avoid shame signals (no red, no "failed" wording).
Events and tasks belong in one calendar.

### 1.4 Overwhelm, clutter and calm design [practice] [product]
- Sensory-design guidance for neurodivergent users notes a tension: some stimulation helps focus, but many competing
  elements derail attention. That argues for a user-controlled calm option, not one fixed level. [S19]
- Several ADHD planners advertise calm, minimal interfaces and the removal of overdue alarms. These claims are
  unverified, but they are a consistent pattern. [S13][S18]

**Implication:** keep defaults low-clutter, and add a **calm mode** that hides previews, mutes colour and stops motion.
Respect `prefers-reduced-motion`.

### 1.5 Reward, delay aversion and the dopamine of "done" [research] [product]
- Delay-aversion and reward-processing accounts explain a strong preference for immediate outcomes in ADHD. Delay is
  aversive, and reward-prediction signalling may be altered. [S20][S21]
- Llama Life uses per-task countdowns, a running "finish time" estimate and confetti on completion. [S22]
  Direct trials of gamification in adult ADHD were not found.

**Implication:** give **immediate, small, positive feedback** when ticking items and completing a list. Keep it
optional and calm-mode aware. No streaks or punishments.

### 1.6 Estimating durations (planning fallacy) [practice] [research]
- People with ADHD often mis-estimate how long things take. ADHD-specific planning-fallacy data are scarce, but
  estimation errors are documented in the timing literature. [S1][S23]
- Common tools ask for estimates and show totals and expected finish times. [S22][S18]

**Implication:** task lists get an **optional duration estimate**. A timed task list occupies its estimated duration on
the timeline, so the estimate becomes visible, proportional time. Later option: compare estimated with actual time.

### 1.7 Initiation, decision fatigue and recurring chores [practice] [product]
- "What should I do now?" paralysis is commonly reported. Tools answer it with a single next step, as in Tiimo and
  Structured. [S10][S17]
- Recurring chores are forgotten when they live in memory. Recurring routines are standard in ADHD planners. [S17]
- Recent HCI work (CSCW 2026, 22 interviews + 20 speed-dating participants) says that mainstream tools wrongly assume
  linear time and steady self-regulation. It calls for support of **nonlinear attention rhythms** and social and
  emotional scaffolding. [S24] A scoping review (ASSETS 2025 workshop) found most assistive technology for adult ADHD is
  framed as intervention, not positive everyday support. [S25]

**Implication:**
- A **"Now" card** shows the current block, the next block and the **next small task** (the first unticked item).
- Recurring task lists are useful but optional for the prototype.
- Wording is supportive and neutral.

### 1.8 Reward without guilt: delight, not streaks [practice] [product] [research-adjacent]
- Section 1.5 established that immediate rewards matter more for ADHD brains than delayed ones. Instant sensory
  feedback at the moment of completion is the cheapest immediate reward a calendar can give: motion, a check-draw, a
  small burst, and optionally sound or haptics. [S20][S21][S22]
- **Streaks are risky.** Practitioners and ADHD app makers widely report one cycle: a missed day breaks the streak,
  shame follows, executive function drops further, and the user avoids the app. The cycle is often linked to rejection
  sensitivity. Gamification designers recommend recovery-first designs: grace periods, capped or forgiving streaks, and
  never resetting to zero with a loss message. The cited quantitative studies (a CHI 2020 abandonment finding; Silverman
  & Barasch 2023 on broken streaks lowering engagement below baseline) could not be verified from primary sources here,
  so they are treated as plausible but unverified. [S26][S27][S28]
- **Punitive notifications** ("You missed …", red badges) work against this. Sunsama avoids red overdue warnings
  on purpose. [S18]
- **Motion guidance:** Material 3 Expressive uses spring physics (stiffness, damping, initial velocity) instead of
  fixed easing curves. It distinguishes "spatial" springs (position, size) from "effects" springs (opacity, colour),
  and an expressive (bouncy) from a standard (restrained) scheme. Community implementations use, for example,
  stiffness ≈ 380 with damping ratio ≈ 0.73–0.8 for default expressive spatial motion. These values are not official.
  [S29]
- **Accessibility:** motion can trigger vestibular discomfort, and for some ADHD users it is a distraction. The
  `prefers-reduced-motion` media query and an in-app animation level setting are the standard remedy, consistent with
  1.4. [S19]

**Implication:** make ticking deeply satisfying, with an animated checkbox, a strike-through, and a short sparkle
burst. Completing a whole list earns a bigger moment: confetti-like burst, card bounce, progress ring fill. Keep each
moment ≤ ~700 ms and never block input. Do not ship streaks by default: an optional "done today" count is fine, but
never show loss, reset or shame messaging. Make the animation level user-controlled (Full / Reduced / Off) and keep
sounds off by default.

### 1.9 Direct manipulation: drag and drop [practice] [product]
- Rescheduling must be low-effort, or plans go stale (1.3, tool abandonment in [S15]). Visual planners (Tiimo,
  Structured) rely on drag-and-drop on the timeline. [S10][S17]
- Mobile: a long press to pick up avoids conflict with scrolling and swiping. Haptic confirmation through
  `navigator.vibrate` works on Android Chrome. iOS Safari does not implement the Vibration API, so iOS relies on the
  visual lift.
- A physical feel (lift, follow with slight lag and tilt, spring settle) makes the object feel "real". That is
  satisfying, and it makes clear where the item will land. An accessible alternative (edit dialog) is required.

**Implication:** drag events and task lists in the week and day views (time and day, snapped to 15-minute slots) and
in the month view (day only). Persist the move immediately; on failure the card springs back and an error is shown.

### 1.10 Virtual companions: Finch vs. Forest [product] [practice]
- **Finch** (self-care pet): the pet grows when the user completes small, customisable self-care goals. It **never
  dies** when days are skipped, a deliberate choice against Tamagotchi-style punishment. Reviewers credit this with
  removing the guilt that makes wellness apps feel like pressure. Some users still report mild worry about the pet
  being "lonely". [S30][S31]
- **Forest** (focus timer): leaving the app or giving up **kills the tree**, and the dead tree stays in the forest.
  Some users find the visible consequence motivating; others describe it as a guilt trip. ADHD-oriented reviews note
  it does not help with task initiation or time blindness. [S32][S33]
- No controlled study compares the two for ADHD.

**Implication for the plant companion:** follow Finch, not Forest.
- Growth is cumulative and never lost.
- Inactivity only shows as gentle resting states (a droop, slightly muted colour) with neutral wording.
- No death, no withered or brown art, no "you neglected" messages.
- One action perks the plant up immediately (an instant reward that matches 1.5).
- Rewards come from small actions with a daily cap (anti-spam, and no pressure to grind).
- The streak flame (owner request) is counted from app opens, resets quietly, and greets the user with
  "Welcome back!". The owner will A/B test flame, plant or both through the Motivation setting.

### 1.11 Time-based remembering is the weak spot, not remembering itself [research]
- Adults with ADHD showed **no deficit on event-based prospective memory** (act when a cue appears) but a **large
  deficit on time-based** prospective memory (act at a time, with no cue) in a matched comparison. [S34] Reviews agree
  that the time-based deficit is the consistent finding; event-based results are mixed. [S35] A 2025 VR study in children
  found the problem is *how strategically* the clock is checked, not how often. [S36]
- In a complex prospective-memory task, adults with ADHD had a **large deficit in planning** the task and only small
  deficits in recalling the plan, starting it and carrying it out. [S37] Everyday prospective memory (own real-life
  intentions) is also impaired. [S38]

**Implication:** turn time-based intentions into event-based ones. The app must deliver the cue at the right moment
(notification, Now card), tie tasks to events ("after the dentist: pharmacy"), and do the planning step for the person
(leave-by times, prep steps), because planning is the weakest link.

### 1.12 Errors grow with the length of the interval [research]
- In reproduction tasks, people with ADHD under-reproduce, and the error grows with the interval. In verbal estimation
  they tend to over-estimate. The direction depends on the task; the growth with duration is the stable part. [S39][S3]

**Implication:** the further away something is, the less it is felt. Long gaps need the strongest externalisation:
"in 2 h 15 min" in words, a visual distance (clock arc, timeline), and a reminder that fires at the right moment instead
of trusting the feeling.

### 1.13 "Now" outweighs "later": delay discounting and present orientation [research]
- A meta-analysis of case-control studies found delay discounting reliably elevated in ADHD, with no difference by age.
  [S40] In a Czech national adult sample, ADHD symptoms correlated with a present-hedonistic and past-negative time
  perspective; future orientation correlated with fewer symptoms. [S41]

**Implication:** make the future present. Show consequences now ("leave in 20 min"), give immediate rewards for steps,
and break far deadlines into steps that land today.

### 1.14 Waiting mode [practice]
- Widely reported, not studied: with an appointment later in the day, people cannot start anything in the hours before
  it, from fear of missing it, fear of hyperfocus and time blindness. Suggested strategies: an alarm that guards the
  departure so the free time is safe to use, working back from the appointment to the real "start getting ready" time,
  and filling the gap with small, bounded tasks. [S42]

**Implication:** the app can *guard* the next commitment: show "free until 14:20 (leave-by)", promise "I'll remind you
at 14:10", and suggest a small task that fits the gap. This turns the waiting block into usable time.

### 1.15 Late body clock and bedtime procrastination [research]
- A systematic review of 62 studies (4 462 patients) found consistent evidence for a later chronotype and a delayed
  circadian phase (dim-light melatonin onset, sleep onset) in ADHD. [S43] A later review estimates delayed sleep phase in
  73–78 % of children and adults with ADHD, and proposes sleep hygiene, chronotherapy and morning light. [S44]
- Students with probable ADHD showed more bedtime procrastination and shorter sleep. [S45]

**Implication:** bedtime mode is well founded. The reminder has to reach the person when the app is closed (done for
the Android app, 2026-10-13). A "start winding down" cue before bedtime and gentle morning anchors would extend it.

### 1.16 Hyperfocus loses time [research, mixed]
- "Completely lost track of time" is a core item of the Adult Hyperfocus Questionnaire; more ADHD symptoms went with
  more hyperfocus in 623 adults, and a 12-item version was validated in 2024. Replication is mixed. [S46]

**Implication:** optional, gentle time check-ins during long free blocks ("It's 22:40, you've been at it for 2 h"),
never alarms by default.

### 1.17 If-then plans help [research, children]
- Children with ADHD who formed implementation intentions ("If X, then I do Y") improved response inhibition to the
  level of controls, delay of gratification and working-memory tasks. Small studies, not yet replicated in adults. [S47]

**Implication:** chaining ("when the meeting ends, then start the report") is a cheap, evidence-backed way to make
starts event-based (see 1.11).

### 1.18 Reminders: few, meaningful, at the right time [research]
- An RCT within an internet intervention for adults with ADHD tested SMS reminders on adherence and named habituation to
  constant reminders as a risk. [S48] In a within-subject experiment, turning phone alerts on raised inattention and
  hyperactivity in students. [S49]

**Implication:** every notification must earn its place. Default to the few that matter (bedtime, transitions before
real commitments), no repeated nagging, and quiet hours.

### 1.19 Planner habits are part of evidence-based treatment [research]
- CBT for medication-treated adults with ADHD (86 adults, 12 sessions) starts with organising and planning: one
  calendar and one task-list system, checked daily, plus breaking overwhelming tasks into steps. It beat relaxation with
  educational support (response about 67 % vs 33 %). [S50]

**Implication:** the daily "look at today" ritual is itself therapeutic. A short morning/evening planning view (today's
fixed points, open lists, one first step) supports the habit the treatment trains.

### 1.20 Body doubling [research, thin]
- Evidence is small and mixed: a 12-person VR preprint found benefits with a human or AI body double; a student study
  found no effect. [S51] Kept out of scope.

### 1.21 What the community says: tools fade, guilt stays [research: qualitative, community data]
Reddit blocks automated access for this research, so its posts were read through published analyses, not scraped.
- **r/ADHD, 5,379 posts on time management, 2020–2025** (human-led, LLM-assisted thematic analysis, arXiv preprint Oct
  2026). [S52] Challenges: putting tasks off until urgency forces a start (68.9 %, "If there is no urgency, I don't get it
  done"); guilt and self-blame over lost time (55.1 %, "maybe I'm just lazy"); screen sessions noticed only afterwards
  (23.6 %, "5 mins" became "3 hours"); tools breaking down (8.9 %): a planner forgotten "after about 2 weeks", reminders
  ignored once familiar, a red badge on a to-do app causing anxiety and then muting, alarms "burned out" as a strategy, a
  focus timer that "mostly just highlights how much time I wasted". The app-hopping cycle: "find a new system/app, shove
  the chaos … list of well over 100 tasks a day, get overwhelmed, stop checking the app … move to a new app".
  Strategies: other people (70.4 %; "a person, unlike a reminder, cannot be dismissed", body doubling over FaceTime);
  tools that last are **shared, separate or visible** (21.7 %): "My partner and I have a joint colour-coded Google
  Calendar and that works fairly well", "a timer that's separate from your phone", a whiteboard of done / to do / coming
  up, breaks framed as earned; success redefined as "I notice it sooner and can gently guide myself back"; friction set
  in advance (12.1 %): phone across the room, timed lock box, an alarm dismissed only by scanning a barcode in another
  room. Wished-for tools: reminders that stay visible until done, tasks pinned to the lock screen, ambient displays,
  minimal tools that do not "treat me like a child", support tied to calendar events.
  The authors' design implications: progress feedback can feed guilt, so make **recovery** visible and offer a
  manageable next step; support the transition away from the phone instead of only reminding; keep support continuous
  when people switch tools; easy to switch on, not instantly dismissible, with the person in control of strength,
  placement and repetition; judge tools by self-blame, not only by tasks done.
- **r/adhdwomen vs r/ADHD** (3,383 posts, 2025): executive-function support is discussed together with digital tools
  (OR ≈ 4.3), environmental structure (OR ≈ 4.7) and social support; r/ADHD talks more about reminders and apps,
  r/adhdwomen in more emotional and relational language. [S53]
- **ADDitude reader surveys** (self-selected): of 1,859 adults, few rated any non-drug strategy "extremely helpful"
  (family/friends 5.6 %, personal organisers 4.7 %, time-management apps 3.5 %, coaches 2.7 %); 61 % in another survey
  use paper planners, sticky notes or handwritten lists. The editors' summary: trial and error. [S54]
- Interviews (CSCW 2026, n = 22 + 20): people plan from their rare hyperfocus days and overestimate what fits; reminders
  work only inside routines or relationships ("If it's only me reminding myself, it just becomes invisible after a few
  days"); planning itself can become avoidance or a source of shame. Of 13 concepts, the favourites were a calm
  "brain weather" dashboard (14 of 20 in their top 3; "mild haze" instead of red overdue items), quiet social presence,
  pause days and flexible plans with gentle streaks; **ambient transition cues were the least liked (too subtle during
  focus)**; pattern-based nudges felt like being watched. "I want it to suggest, not decide." [S24]
- Abandonment research outside ADHD agrees: lapses (forgetting, upkeep, skipping, suspending) are normal, and the
  design task is resuming, for example by inviting people back to look at what they did before. [S55] Phone sessions
  end on competing real-world demands, not on willpower. [S56]

**Implication:** design for the second week, not the first day. Few, meaningful notifications the person tunes; nothing
red, no badge counts that accuse; show what was done and make coming back easy after a gap; one shared calendar
(the partner) and a glanceable place outside the app (widget, lock screen) instead of more in-app features; cues that
are strong enough to notice but under the person's control.

### 1.22 Time aids work best with practice, and calendars are the core of the evidence-based programmes [research]
- **Let's Get Organized (LGO-S, "Ha koll")**, a Swedish occupational-therapy group programme for adults with ADHD,
  autism or mental disorders: ten weekly sessions, **each one working with the person's own calendar**, plus estimating
  and measuring how long activities take, prioritising with a to-do list, energy levels and circadian rhythm, matching
  activities to energy, revising routines, planning rewarding weekends, and "succeed or learn" trial and error. In an RCT
  (n = 75) it improved time management, organisation and emotional regulation as much as individual occupational
  therapy, and the gain held after one year (n = 38). Parents described a family calendar or whiteboard giving the whole
  family predictability. The authors note that a calendar also lets people look back at what they have done. [S57]
- **Time-assistive devices** (reminders and alarms, day/week activity schedules, step-by-step schedules, timers that
  show time as shrinking dots or a shrinking surface): in an RCT with children with ADHD (n = 38), devices plus training
  and psychoeducation improved time processing, mostly **time orientation**, and parent-rated daily time management;
  psychoeducation alone did nothing. Young adults using such devices reported more participation and a feeling of
  control; the barriers were other people's attitudes and their own about using an aid. Time-processing ability varies
  widely within ADHD. [S58] Devices "are not sufficient as such; training in how to use them is needed". [S57]
- Assistive technology for cognition is used most for time management and planning, and is effective there (91 studies).
  [S59] A digital calendar with phone reminders improved self-rated occupational performance in a small pilot RCT, but
  people found it hard to fit into their routines. [S60] Stress, poor sleep and money or social problems undermine the
  routines that aid use depends on. [S61]

**Implication:** the calendar is the right core, but the app should teach its own use lightly (first-week hints, a
weekly look back, "estimate, then see how long it took"), support time orientation (where am I in the day, what is
next), offer an energy view of the day, and never look like a "special needs" device.

### 1.23 Circles look calmer, lines read faster [research: visualisation]
- Timelines: linear shapes are read faster and rated more readable; circles were described as "easier on the eyes".
  [S62] Circular layouts were slightly slower (not significant) and judged more aesthetic. [S63] For 24-hour data,
  linear charts were more accurate and efficient, while clock-like **sectors were easier to remember than rings**. [S64]

**Implication:** the clock is a good *glance and orientation* view (where am I in the day, how much is left: the wedge
is a sector), while reading exact times and comparing durations belongs to the linear views and words ("in 2 h 15 min").
The clock should keep its words in the middle and the linear Approaching track elsewhere.

## 2. Derived requirements

Mapped to `spec/features/` tags. P1 = must, P2 = should, P3 = optional (`@optional`).

| # | Requirement | Prio | Basis | Feature |
|---|---|---|---|---|
| R1 | Time-proportional blocks in the day and week timelines. No equal-height agenda lists; phone month taps open the proportional day timeline. Short items get a minimum tappable height but stay ordered by time. | P1 | 1.1 | timeline |
| R2 | A live "now" line in day and week views when today is visible. It moves as time passes. | P1 | 1.1 | timeline |
| R3 | A "Now" card with the current event and its time left ("Dentist · 35 min left"), a shrinking progress bar, and the next event ("Next: Call in 1 h 20 min"). | P1 | 1.1, 1.2 | timeline |
| R4 | Today's timeline auto-scrolls so that "now" is visible. | P1 | 1.1 | timeline |
| R5 | In-app transition warning N minutes before an event (default 10, settings: off/5/10/15). | P1 | 1.2 | adhd-support |
| R6 | A persistent "open tasks" tray in every view: today's and overdue open task lists, with a count. | P1 | 1.3 | open-tasks |
| R7 | Overdue open task lists carry forward to today with a gentle "From Sat 10 Oct" label (no red), and offer "Move to today". Completed past lists stay on their day. | P1 | 1.3 | open-tasks |
| R8 | Year overview with 12 mini months and density marks; tapping a month opens it. | P1 | owner, 1.3 | year |
| R9 | Month picker opened by tapping the period title: a mini month with item dots, swipe or arrows between months, tap a day to jump. | P1 | owner | month-picker |
| R10 | Optional duration estimate on task lists; shown as "~45 min"; timed lists occupy their estimate on the timeline. | P2 | 1.6 | adhd-support |
| R11 | Immediate positive feedback on tick and completion. Superseded by R18 and R19 (owner: really important). | P1 | 1.5 | reward |
| R12 | Calm mode: hides item previews and tags on cards, mutes item colours, no motion or celebrations animation. | P2 | 1.4 | adhd-support |
| R13 | The Now card shows the next small task (first unticked item of the oldest open list for today). | P2 | 1.7 | adhd-support |
| R14 | Supportive language everywhere: no "failed" or "missed" wording; overdue uses the tertiary colour, not error red. | P1 | 1.3, 1.4 | open-tasks |
| R15 | Recurring task lists (daily, weekly, monthly) with per-occurrence ticks. | P3 | 1.7 | tasklists-repeating |
| R16 | System notifications for transition warnings. They need HTTPS, permission and push support (iOS only for installed PWAs). | P3 | 1.2 | reminders (built) |
| R18 | Rewarding tick: springy checkbox with check-draw, animated strike-through, sparkle burst (≤ 700 ms, non-blocking, removed from the DOM afterwards). | P1 (owner) | 1.5, 1.8 | reward |
| R19 | List completion celebration: larger burst, card bounce, progress ring fills to 100 %, "All done! 🎉". | P1 (owner) | 1.5, 1.8 | reward |
| R20 | Micro-interactions on FAB, sheet open/close and view switch, using springs (M3 Expressive). | P2 | 1.8 | reward |
| R21 | Animation level setting Full / Reduced / Off (default: Full, or Reduced when `prefers-reduced-motion`); Reduced = no particles, short fades only; Off = no animation. Sounds setting, off by default. | P1 | 1.4, 1.8 | reward |
| R22 | No shame mechanics. The owner-requested check-in streak counts app opens, resets quietly ("Welcome back!"), never shows loss wording, and can be hidden. | P1 | 1.8 | streak |
| R24 | Plant companion (Finch-style): cumulative growth through 5 stages, gentle resting states, never dies, instant perk-up, daily point cap; Motivation setting Flame/Plant/Both/None for A/B. | P1 (owner) | 1.10 | plant |
| R23 | Drag and drop of events and task lists: long press on touch (with haptics where supported), mouse drag on desktop, 15-minute snapping, physical lift/follow/settle, persisted with spring-back on failure. | P1 (owner) | 1.9 | dnd |
| R25 | Leave-by guard: events with a location or travel time show "leave by 14:20" and a reminder before it; the Now card says "free until 14:20" in waiting-mode gaps. | P2 (proposed) | 1.11, 1.14 | – |
| R26 | Chaining: "after this event" tasks; the task shows up on the Now card when the event ends. | P2 (proposed) | 1.11, 1.17 | – |
| R27 | Wind-down cue before bedtime (separate from the bedtime reminder) and an optional morning anchor. | P3 (proposed) | 1.15 | – |
| R28 | Optional hyperfocus check-in during long free blocks, off by default. | P3 (proposed) | 1.16 | – |
| R29 | Notification budget: only bedtime, transitions before real commitments and leave-by; no repeats; quiet hours. | P1 (proposed) | 1.18 | – |
| R30 | Daily planning view: today's fixed points, open lists, one first step, reachable from a morning notification. | P2 (proposed) | 1.19 | – |
| R31 | Long horizons in words and distance: "in 2 h 15 min" next to times on the Now card, clock and widget. | P2 (proposed) | 1.12, 1.13 | – |
| R32 | Notification budget per person: choose which reminders reach the lock screen (bedtime, transitions before events, leave-by), quiet hours, no badge counts; reminders stay until acknowledged only when the person chooses so. | P1 (proposed) | 1.18, 1.21 | – |
| R33 | Transition warnings as system notifications in the Android app (the in-app warning when the app is closed). | P1 (proposed) | 1.2, 1.11, 1.21 | – |
| R34 | Look back: a calm "what I did" view (done lists and past events of the day/week), offered after a gap instead of overdue counts. | P2 (proposed) | 1.21, 1.22 | – |
| R35 | Estimate, then measure: for a task list with an estimate, record when it was started and finished and show estimate vs actual over time, without judgement. | P2 (proposed) | 1.6, 1.22 | – |
| R36 | Sharing with another person as the core social support (`shared-lists`), and widgets / lock-screen presence as the glanceable "separate" place (Android and iPhone widgets are built). | P1 (proposed) | 1.21 | shared-lists |
| R37 | Energy-aware day: optional energy level per entry or time of day (LGO session 6–7) shown as a soft band. | P3 (proposed) | 1.22 | – |
| R17 | Later ideas, not specified: estimate vs. actual learning, body-doubling or sharing, energy-based planning, lock-screen widgets (not possible for a PWA; the native Android widgets and the iPhone Scriptable widget exist). | – | 1.6, 1.7 | – |

## 3. Sources

- [S1] Marx I., Cortese S., Koelch M.G., Hacker T. *Meta-analysis: Altered Perceptual Timing Abilities in ADHD.* JAACAP, 2021. Summary: https://adhdevidence.org/blog/time-blindness-found-to-be-a-consistent-feature-of-adhd ; record: https://www.em-consulte.com/article/1527936/meta-analysis-altered-perceptual-timing-abilities- ; https://eprints.soton.ac.uk/456003
- [S2] Timing in ADHD, methodological heterogeneity: Scientific Reports 2022, https://link.springer.com/10.1038/s41598-022-05425-2
- [S3] Time perception in adults by ADHD symptom severity, Medical Science Monitor 2021: https://medscimonit.com/abstract/full/idArt/936849
- [S4] Mixed-methods study of time-related situations in adults (Charles University, 2023): https://explorer.cuni.cz/publication/619318?lang=en
- [S5] Time estimation in male vs. female adults with attention deficits: https://cris.bgu.ac.il/en/publications/time-estimation-could-be-impaired-in-male-but-not-female-adults-w/
- [S6] Barkley's executive-function view, "future blindness": https://www.simplypsychology.org/adhd-future-blindness.html
- [S7] Barkley, point of performance and externalising time (secondary summaries): https://www.greatschools.org/gk/parenting/adhd/dr-russell-barkley-ad-hd-theory-diagnosis-and-treatment-summary/ ; Barkley R.A., *Taking Charge of Adult ADHD* (Guilford, 2nd ed. 2021)
- [S8] Time Timer in special needs (vendor): https://timetimer.com/pages/time-timer-in-special-needs
- [S9] Easter Seals Tech, Time Timer overview: https://eastersealstech.com/2017/12/05/time-timer-visual-timer
- [S10] Tiimo product, visual timeline and focus countdown: https://tiimoapp.com/product ; https://tiimoapp.com/product/focus
- [S11] ADHD Australia, hyperfocus and transitions: https://www.adhdaustralia.org.au/working-with-hyperfocus-adhd-transitions-without-willpower/
- [S12] Transition steps (stop, move, start): https://rehab.pesi.com/blog/details/1989/initiation-activation-2-exercises-to-help-kids-focus ; context switching: https://focusbear.io/blog-post/adhd-context-switching-strategies-for-smoother-transitions
- [S13] Visual planners and ADHD, out of sight out of mind (practice blog): https://affine.pro/blog/visual-planner-benefits-for-adhd
- [S14] Task Vision, neurodiverse productivity dashboard (Carleton College, 2024): https://cs.carleton.edu/cs_comps/2324/productivityDashboard/final-results/index.html
- [S15] Aalborg University thesis, task management assistant for adults with ADHD: https://projekter.aau.dk/designing-a-digital-task-management-assistant-for-adults-with-adhd-a-user-centred-exploration-of-sch-bc52b1bf.html
- [S16] Desrochers, Tuson, Magee. Time management tools for adults with ADHD, ASSETS 2019 poster, doi:10.1145/3308561.3354622 (via https://commons.clarku.edu/faculty_computer_sciences/15)
- [S17] Structured Daily Planner (inbox, routines, Replan): https://apps.apple.com/app/structured-daily-planner/id1499198946
- [S18] Sunsama, rollover without red overdue (founder interview): https://nesslabs.com/sunsama-featured-tool ; https://help.sunsama.com/docs/evening-daily-planning
- [S19] Tiimo, sensory design for neurodivergent accessibility: https://www.tiimoapp.com/es/resource-hub/sensory-design-neurodivergent-accessibility
- [S20] Delay and reward choice in ADHD, experimental test of delay aversion: https://vbn.aau.dk/en/publications/delay-and-reward-choice-in-adhd-an-experimental-test-of-the-role-
- [S21] Reward processing in ADHD: https://clok.uclan.ac.uk/id/eprint/29134/1/Chronaki%20et%20al%202019.pdf ; https://www.onderzoekmetmensen.nl/en/node/36926
- [S22] Llama Life (per-task countdown, finish time, confetti): https://apps.apple.com/us/app/adhd-organizer-llama-life/id6454469750
- [S23] ADDitude, time estimation and the planning fallacy: https://www.additudemag.com/time-estimation-planning-fallacy-adhd/
- [S24] Chen, Meng, Nie. *"Not Just Me and My To-Do List": Understanding Challenges of Task Management for Adults with ADHD…* CSCW 2026, arXiv:2603.17258: https://arxiv.org/abs/2603.17258
- [S25] Tan, Jost, Gerken, Pascher. *Preliminary Results of a Scoping Review on Assistive Technologies for Adults with ADHD.* ASSETS '25 AT@WORK workshop, arXiv:2601.21791: https://www.arxiv.org/pdf/2601.21791
- [S26] "Why streaks make ADHD worse" (ADHD app developer essay): https://dev.to/nucleusos/why-streaks-make-adhd-worse-and-what-actually-helps-5147 ; https://dev.to/nucleusos/adhd-support-app-no-streaks-why-gamification-hurts-more-than-it-helps-1ae0
- [S27] Streak anxiety and forgiving habit trackers (vendor blog): https://habitdoom.com/blog/streak-anxiety-habit-trackers
- [S28] Yu-kai Chou, gamification analysis of streak mechanics: https://yukaichou.com/?p=38981
- [S29] M3 Expressive motion, spring parameters (community implementations, not official): https://pub.dev/packages/motor ; https://pub.dev/documentation/material_expressive/0.7.0/ ; official reference: https://m3.material.io/styles/motion/overview
- [S30] Mozilla *Privacy Not Included*, Finch: Self Care Pet: https://www.mozillafoundation.org/en/privacynotincluded/finch-self-care-pet/
- [S31] Finch reviews (never dies, no guilt): https://habitbox.app/blog/finch-app-review ; https://www.pastemagazine.com/article/finch-app-mental-health-virtual-pet-self-care
- [S32] Forest app reviews (dead trees, guilt): https://www.bustle.com/wellness/forest-focus-screen-time-app-review ; https://desirabilitylab.com/posts/forest
- [S33] Forest and ADHD, limitations (competitor article): https://www.getinflow.io/post/best-alternatives-forest-app-adhd
- [S34] Altgassen M., Kretschmer A., Kliegel M. *Task dissociation in prospective memory performance in individuals with ADHD.* J Atten Disord 2014: https://metatoc.com/papers/2052-task-dissociation-in-prospective-memory-performance-in-individuals-with-adhd
- [S35] Costanzo et al. 2021, review of prospective memory in ADHD (time-based consistent, event-based mixed): https://pmc.ncbi.nlm.nih.gov/articles/PMC8199111/ ; Talbot & Kerns 2014: https://uvic.academia.edu/KarleyDaleTalbot
- [S36] Seesjärvi et al. *Time-based prospective memory in children with ADHD in virtual reality.* Sci Rep 2025: https://link.springer.com/article/10.1038/s41598-025-08944-w
- [S37] Altgassen M. et al. *Complex Prospective Memory in Adults with ADHD.* PLOS ONE 2013: https://pmc.ncbi.nlm.nih.gov/articles/PMC3590133
- [S38] Everyday prospective memory and procrastination in adult ADHD, ADHD Atten Def Hyp Disord 2018: https://link.springer.com/article/10.1007/s12402-018-0273-x
- [S39] Time reproduction and estimation at longer durations: https://publications.goettingen-research-online.de/bitstream/2/8502/2/PlosOne%202015.pdf ; https://pmc.ncbi.nlm.nih.gov/articles/PMC4319812 ; meta-analysis S1
- [S40] Jackson J.N.S., MacKillop J. *ADHD and delay discounting: a meta-analytic review.* Biol Psychiatry CNNI 2016: https://pmc.ncbi.nlm.nih.gov/articles/PMC5049699 ; adult financial behaviour: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5421775/
- [S41] *ADHD Symptoms in Adults and Time Perspectives – Findings From a Czech National Sample.* Front Psychol 2020: https://pmc.ncbi.nlm.nih.gov/articles/PMC7270245
- [S42] Waiting mode (practice, not research): https://www.healthline.com/health/adhd/adhd-waiting-mode ; https://happiful.com/waiting-mode-explained ; https://stylist.co.uk/health/mental-health/waiting-mode-adhd-autism-neurodivergent/916707
- [S43] Coogan A.N., McGowan N.M. *A systematic review of circadian function, chronotype and chronotherapy in ADHD.* ADHD Atten Def Hyp Disord 2017: https://mural.maynoothuniversity.ie/id/eprint/11298/
- [S44] Bijlenga D., Vollebregt M.A., Kooij J.J.S., Arns M. *The role of the circadian system in the etiology and pathophysiology of ADHD: time to redefine ADHD?* 2019: https://cris.maastrichtuniversity.nl/en/publications/the-role-of-the-circadian-system-in-the-etiology-and-pathophysiol/ ; adult review 2013: https://pubmed.ncbi.nlm.nih.gov/24117273/
- [S45] Bahar & Uygur, bedtime procrastination and probable ADHD, J Contemp Med 2023: https://doaj.org/article/91dc5ae3dce14763bb6d5325a5809b83
- [S46] Hupfeld et al., Adult Hyperfocus Questionnaire (2019) and AHQ-D validation, Sci Rep 2024: https://doaj.org/article/4fafdcea90614363aedc3cc0d95cf462 ; mixed replication: https://gmwpublic.studenttheses.ub.rug.nl/2940/1/Master_Thesis_s3630579_SCoelho.pdf
- [S47] Gawrilow C., Gollwitzer P.M. and colleagues, implementation intentions in children with ADHD: https://www.socmot.uni-konstanz.de/sites/default/files/08_Gawrilow_Gollwitzer_Implementation_intentions_facilit.pdf ; https://www.socmot.uni-konstanz.de/sites/default/files/Gawrilow_Gollwitzer_Oettingen_Delay_2011-2.pdf
- [S48] Nordby et al. *SMS reminders in an internet intervention for adults with ADHD.* Front Digit Health 2022: https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2022.821031/full
- [S49] Kushlev, Proulx, Dunn. *"Silence your phones": smartphone notifications increase inattention and hyperactivity symptoms.* CHI 2016: https://www.interruptions.net/literature/Kushlev-CHI16.pdf
- [S50] Safren S.A. et al. *CBT vs relaxation with educational support for medication-treated adults with ADHD.* JAMA 2010;304(8):875-80: https://pmc.ncbi.nlm.nih.gov/articles/PMC3874265
- [S51] Body doubling in VR (preprint, n = 12): https://arxiv.org/abs/2509.12153 ; null result poster: https://www.ccsc.org/centralplains/2025/talks/talk-poster16/
- [S52] Liu S., Cao L., Lee C.T., Shanbhag N., Ma R., Lukoff K. *r/ADHD: Community-Based Understandings of Time Management Challenges in Digital Environments.* arXiv:2610.12629, 2026: https://arxiv.org/abs/2610.12629
- [S53] *Symptom expression and coping strategies in women-focused ADHD communities: a comparative natural language analysis of Reddit*: https://pmc.ncbi.nlm.nih.gov/articles/PMC13495778/
- [S54] ADDitude reader surveys: https://www.additudemag.com/adhd-productivity-apps-tools/ ; https://www.additudemag.com/best-planners-adhd-brains-paper-digital/
- [S55] Epstein D.A. et al. *A lived informatics model of personal informatics* (2015): https://my.eng.utah.edu/~cs5540/au16/readings/PersonalInformatics-Epstein2015.pdf ; *Beyond abandonment to next steps* (CHI 2016): https://library.selfresearch.org/research/beyond-abandonment-to-next-steps-understanding-and-designing-for-life-after-personal-informatics-tool-use/ ; *Reconsidering the device in the drawer* (UbiComp 2016): https://homes.cs.washington.edu/~jfogarty/publications/ubicomp2016.pdf
- [S56] Tran J.A., Yang K.S., Davis K., Hiniker A. *Modeling the engagement-disengagement cycle of compulsive phone use.* CHI 2019: https://faculty.washington.edu/alexisr/engagementDisengagement.pdf
- [S57] Wingren M. *Evaluation of the time management intervention Let's Get Organized.* Örebro Studies in Medicine 335, 2025: https://oru.diva-portal.org/smash/get/diva2:1967012/FULLTEXT01.pdf
- [S58] Wennberg B. *Keeping track of time.* Linköping University Medical Dissertation No. 1717, 2019: https://www.diva-portal.org/smash/get/diva2:1371347/FULLTEXT01.pdf ; RCT: https://www.researchgate.net/publication/320066896_Effectiveness_of_time-related_interventions_in_children_with_ADHD_aged_9-15_years_a_randomized_controlled_study
- [S59] Gillespie A., Best C., O'Neill B. *Cognitive function and assistive technology for cognition: a systematic review.* JINS 2012, doi:10.1017/S1355617711001548: https://dspace.stir.ac.uk/handle/1893/20146
- [S60] Andreassen M., Danielsson H., Hemmingsson H., Jaarsma T. *An interactive digital calendar with mobile phone reminders (RemindMe) for people with cognitive impairment: a pilot RCT.* Scand J Occup Ther 2021/2022: https://researchinformation.umcutrecht.nl/en/publications/an-interactive-digital-calendar-with-mobile-phone-reminders-remin/
- [S61] Lindstedt H. et al. CogniTech (WFOT 2010): https://archive.wfot.org/wfot2010/posters/pdf/1126.pdf ; *Co-exploring everyday life of adults with ADHD* (AAATE 2013): https://portal.research.lu.se/en/publications/co-exploring-everyday-life-of-adults-with-adhd/
- [S62] Di Bartolomeo S. et al. *Evaluating the effect of timeline shape on visualization task performance.* CHI 2020: https://arxiv.org/pdf/2005.06039
- [S63] Ståhlbom E. et al. *Should I make it round?* Computer Graphics Forum 2024: https://onlinelibrary.wiley.com/doi/10.1111/cgf.15102
- [S64] Waldner M. et al. *A comparison of radial and linear charts for visualizing daily patterns.* 2019: https://www.cg.tuwien.ac.at/research/publications/2019/waldner-2019-rld/waldner-2019-rld-paper.pdf
