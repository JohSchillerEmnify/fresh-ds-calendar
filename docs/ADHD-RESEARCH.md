# ADHD research: what a calendar must do differently

Research date 2026-10-12. Purpose: ground the calendar's ADHD-specific requirements in evidence and in practice from
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
transition warnings a few minutes before an event. Notifications are a later option once HTTPS exists.

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
| R15 | Recurring task lists (daily, weekly, monthly) with per-occurrence ticks. | P3 | 1.7 | adhd-support `@optional` |
| R16 | System notifications for transition warnings. They need HTTPS, permission and push support (iOS only for installed PWAs). | P3 | 1.2 | documented only |
| R18 | Rewarding tick: springy checkbox with check-draw, animated strike-through, sparkle burst (≤ 700 ms, non-blocking, removed from the DOM afterwards). | P1 (owner) | 1.5, 1.8 | reward |
| R19 | List completion celebration: larger burst, card bounce, progress ring fills to 100 %, "All done! 🎉". | P1 (owner) | 1.5, 1.8 | reward |
| R20 | Micro-interactions on FAB, sheet open/close and view switch, using springs (M3 Expressive). | P2 | 1.8 | reward |
| R21 | Animation level setting Full / Reduced / Off (default: Full, or Reduced when `prefers-reduced-motion`); Reduced = no particles, short fades only; Off = no animation. Sounds setting, off by default. | P1 | 1.4, 1.8 | reward |
| R22 | No shame mechanics. The owner-requested check-in streak counts app opens, resets quietly ("Welcome back!"), never shows loss wording, and can be hidden. | P1 | 1.8 | streak |
| R24 | Plant companion (Finch-style): cumulative growth through 5 stages, gentle resting states, never dies, instant perk-up, daily point cap; Motivation setting Flame/Plant/Both/None for A/B. | P1 (owner) | 1.10 | plant |
| R23 | Drag and drop of events and task lists: long press on touch (with haptics where supported), mouse drag on desktop, 15-minute snapping, physical lift/follow/settle, persisted with spring-back on failure. | P1 (owner) | 1.9 | dnd |
| R17 | Later ideas, not specified: estimate vs. actual learning, body-doubling or sharing, energy-based planning, lock-screen widgets (not possible for a PWA). | – | 1.6, 1.7 | – |

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
