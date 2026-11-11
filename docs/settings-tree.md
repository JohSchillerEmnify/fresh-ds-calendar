# Settings tree (approved by the owner, 2026-11-01)

Every setting of today ([`settings-audit.md`](settings-audit.md)) in its new place: **group › subgroup › setting**.
Notes: *(moved from …)*, *(merged: …)*, *(removed: …)*, *(new)*. Unmarked = stays as it is, only regrouped.
Look: M3 Expressive (ADR 0032) — settings home = list of groups (icon, title, one-line summary) with a search bar on
top; each group is its own page with M3 list items (name, supporting text, control at the end), subgroups as section
headers; choices with more than 3 options open a menu, times open the M3 time picker in a sheet.

```
Settings  [search bar: "Search settings"]
│
├─ Calendars                                    "Which calendars show, and when"
│  ├─ <one row per calendar, e.g. Work>  ›      (new page per calendar)
│  │  ├─ Show this calendar             switch  (moved from the filter chips / side menu; chips keep working)
│  │  ├─ Plan                           Always on | Off for a while | Off at set times (row opens the plan sheet of
│  │  │                                         feature calendar-off-plan, same as the chip's long press)
│  │  └─ Default reminders              list    (moved from the Reminders page, per calendar)
│  └─ Task lists calendar  ›            (the hidden calendar that holds task lists)
│     └─ Show in Google                 switch  (moved from Calendar: "Show the task lists calendar in Google")
│
├─ Views                                        "Default view, month, week and day"
│  ├─ General
│  │  ├─ Default view                   menu Month/Week/Day
│  │  └─ Minimum event length           Off/15/30 min
│  ├─ Month
│  │  └─ Month view scrolls             menu Sideways/Up and down/One month at a time
│  ├─ Week and day
│  │  ├─ Events side by side: day       Up to 2/3/4   (merged: the two rows share one hint now)
│  │  └─ Events side by side: week      Up to 2/3
│  └─ Approaching card
│     ├─ Approaching card               switch
│     ├─ Time left                      switch  (only shown while the card is on)
│     ├─ Approaching track              switch  (only shown while the card is on)
│     └─ Track reaches ahead            slider 1–24 h (only while track is on; replaces select + number field)
│
├─ Task lists                                   "Categories, templates, what a tap does"
│  ├─ Categories
│  │  ├─ Use categories                 switch  ("Task list categories")
│  │  ├─ <category rows>                drag to reorder, tap to edit/share (replaces up/down buttons)
│  │  └─ Add category                   tonal button, right under the list (moved from the end of the card)
│  ├─ Behaviour
│  │  ├─ Tapping a task list            Expands in place / Opens the list
│  │  ├─ Show where carried-over lists come from   switch
│  │  └─ Finished list without a date   Show on the day / Archive only
│  └─ Templates  ›
│
├─ Reminders                                    "Notifications before events, lists, bedtime"
│  │                                            (merged: Notifications card + Reminders page into one group)
│  ├─ Where reminders arrive
│  │  └─ Reminders in this browser      switch  (moved from the Reminders page)
│  ├─ Before appointments               switch  (notify.events) — default reminders: per calendar, see Calendars
│  ├─ Task lists
│  │  ├─ Before task lists with a time  switch  (merged: was twice — Notifications + Reminders page)
│  │  └─ Default reminders of task lists list   (moved from the Reminders page)
│  ├─ Morning overview                  switch
│  │  └─ Time of the overview           time picker (only while on)
│  └─ Bedtime reminder                  → shown in Focus & calm › Bedtime (one row, see there)
│
├─ Appearance & layout                          "Theme, language, bars and hands"
│  ├─ Theme  ›                          (unchanged page: mode, colours, scene, glow, entries, corners, density …)
│  │  └─ Scene › Sunflowers             Grow with points / Full field (moved from Focus; only exists for that scene)
│  ├─ Language                          menu
│  ├─ Navigation
│  │  ├─ View switcher on phones        menu Bottom/Top/Side rail/Side menu (moved from Calendar)
│  │  └─ View switcher on desktop       menu Bottom/Top/Side rail       (moved from Calendar)
│  ├─ Bars
│  │  ├─ Top bar size                   Automatic/Expressive/Compact (moved from Calendar; Automatic added back)
│  │  └─ Bottom bar size                Automatic/Expressive/Compact (moved from Calendar; Automatic added back)
│  ├─ Left-handed mode                  switch  (moved from Calendar)
│  ├─ Sync indicator always on          switch  (moved from Calendar)
│  └─ Show version in the corner        switch  (moved from Account)
│
├─ Focus & calm                                 "Calm mode, motion, sounds, streak, bedtime"
│  │                                            (merged: Focus & motivation + Motion & sound + Bedtime)
│  ├─ Calm mode                         switch  (independent of Animations: owner, 2026-11-01)
│  ├─ Motion and sound
│  │  ├─ Animations                     Full/Reduced/Off
│  │  ├─ Ignore the device setting      switch  (only shown when the device asks for less motion)
│  │  └─ Sounds                         switch
│  ├─ Motivation
│  │  ├─ Streak                         Off/Flame/Plant — supporting text shows current and best streak
│  │  │                                         (merged: the two info rows become the row's supporting text)
│  │  └─ Support cat                    Off/Sometimes/Every time
│  └─ Bedtime  ›                        (was a top-level card; now a page)
│     ├─ Bedtime mode                   switch
│     ├─ Mode                           Fixed / Dynamic
│     ├─ Bedtime, Wake up               time pickers
│     ├─ Different on weekends          switch → Weekend bedtime, Weekend wake up
│     ├─ Sleep, Wind down before        menus (Dynamic only)
│     └─ Reminder                       Off/5…60 min before (merged: notify.bedtime + reminderMinutes = one row)
│
├─ Labs                                         "Try features that are not finished"
│  ├─ Show Labs features                switch  (renamed from "Experimental views": it gates more than views)
│  ├─ Views:  Clock, Clock rings, Timeline, Strip, Zoom, Horizontal, Runway, Now & next   switches
│  ├─ Two-row week overview             switch → Days on the top row 4/3 3/4
│  ├─ Handwritten lists                 switch
│  └─ Generate themes with AI           switch
│
└─ Account & app                                "Google account, backup, install, version"
   ├─ Account
   │  ├─ Signed in as <e-mail>          Sign out (text button)
   │  ├─ Sign out everywhere            text button
   │  └─ Calendar access                tonal button (only when missing)
   ├─ Backup to Google Drive            status · Back up now · Restore (text buttons; Allow when missing)
   ├─ App
   │  ├─ Install this app (iOS) / Android app   tonal button
   │  ├─ What's new  ›                  (row opens the sheet; no "Show" button)
   │  ├─ Error log  ›                   (page /settings/error-log, feature device-log)
   │  ├─ Version                        info
   │  └─ App signing certificate        info (only when the server offers an app)
   └─ Reset demo data                   (demo server only)
```

## Removed

Nothing is removed outright. Gone are only the second copies and the rows folded into others:
- "Remind about task lists" on the Reminders page (duplicate of "Before task lists with a time").
- The separate "Bedtime reminder" notification switch (folded into Bedtime › Reminder: Off).
- The "Current streak" and "Best streak" rows (become the Streak row's supporting text).
- The "Custom…" + number field of "Track reaches ahead" (one control instead).
- The `/settings/reminders` page as a page of its own (content moves to Reminders and to each calendar's page).

## Not in Settings (on purpose)

Tasks view grouping, sorting and filter (chosen in the Tasks view); hour-height zoom, collapsed tray, collapsed lists
(view state on the device).
