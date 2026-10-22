# 0015 — Reminders come from Google and ring on the device

- Status: accepted (owner, 2026-10-14)
- Views shaped: `remindersRing`, `androidApp`, `server`

## Context

The owner wants several reminders per event, and asked to respect the reminders events already have in Google. Google
stores them per calendar (defaults) and per event. The app should ring itself, even if the Google Calendar app rings too.

## Decision

- Google is the source of truth: an event's reminders are its Google reminders (calendar default or its own list); the
  app reads and writes them there. They replace the app's own single warning time.
- The open app shows each reminder as a snackbar. The Android app also schedules the next ones as phone notifications
  through its own small native plugin.
- A browser gets reminders while closed only when the person switches it on there: the app sends the server its plan of
  the next 7 days and the server sends each one as a Web Push at its time. The Android app does not subscribe, so a
  phone never rings twice.

## Alternatives

- *`@capacitor/local-notifications`* — a generic plugin with more surface than one reminder needs, and its own
  permission flow.
- *Firebase push for the app* — needs a Google project and a server sender, for a reminder the phone can compute itself.

## Consequences

- An event changed only in Google gets its notifications and pushes updated at the next sync of one of the person's
  apps (owner accepted); the widget's background fetch does not schedule.
- Two separate "minutes before" settings cannot contradict each other: there is only Google's.
