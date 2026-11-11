# Scrolling Android widget (issue #96)

## As Is
- Week, day and clock widgets (`WeekWidgetProvider`, `DayWidgetProvider`, `ClockWidgetProvider`) draw one bitmap into an
  `ImageView` (`setImageViewBitmap`), so they cannot scroll. They have no configure screen.
- Data: `WeekFetcher` reads `GET /api/items?from=<Monday>&to=<Monday+7>&excludeHidden=1` with the app's session; on failure
  `WidgetStore` holds the app's snapshot (`web/src/native/widgetSnapshot.ts`, the current week, theme, language, today's
  task lists). Hidden calendars: server side via `excludeHidden`, web side via the calendars store when it builds the snapshot.
- Refresh: WorkManager every 30 min (`updatePeriodMillis=0`), on every new snapshot, on date/time/timezone change.
- minSdk 26, targetSdk 36.

## To Be
A NEW widget "Scrolling" (week, day, clock unchanged). Today plus the next 13 days (14 days). Per widget style:
- Agenda: `ListView`, one text row per entry under a day header (days without entries have no header).
- Timeline: one picture row per day that has entries, each drawn with the existing day drawing (`WeekCanvas.drawDay`), scrolling vertically.
Taps: entry opens it in the app, day header or strip opens that day. Theme and language from the snapshot (light/dark).

## Requirements
1. New provider, own `appwidget-provider` xml, listed in the picker; existing three untouched.
2. Style chosen per widget instance, in a configure activity (`android:configure`, `widgetFeatures="reconfigurable"` so
   long-press -> Reconfigure on API 28+; on API 26-27 only at placement). Default Agenda. Stored per widget id in `WidgetStore`.
3. Reach: today + 13 days. The fetch asks `from=today&to=today+14&excludeHidden=1` (the API allows 100 days).
4. Device-first: the snapshot carries the same 14 days so the widget shows them when the fetch fails. Fetch newer than
   snapshot wins (existing `PickData` rule).
5. Hidden calendars / plan-off calendars: the same two routes as now (server `excludeHidden`, web snapshot filter). No new rule.
6. Task lists: as in the other widgets (title, done/total, list colour), on their day.
7. Collection mechanism: API 31+ `RemoteViews.RemoteCollectionItems` (no factory, no latency on scroll); API 26-30 a
   `RemoteViewsService` + `RemoteViewsFactory` with `notifyAppWidgetViewDataChanged`. One row builder feeds both.
8. Taps: `setPendingIntentTemplate` on the list (FLAG_MUTABLE), `setOnClickFillInIntent` per row with the date / item id.
9. Refresh: same cadence as the others (30 min, snapshot change, date change); redraws when the data changed only.
10. Sizes: min 2x2 cells, resizable both ways. Narrow (< ~3 cells): titles without times. Short: fewer rows visible, always scrollable.
    Empty: "Nothing planned".
11. Strings in all locales; tap targets are the rows.

## Acceptance criteria
See `spec/features/app/scrolling-widget.feature` (all `@backlog`; they become `@unit`/device checks with the tests below).

## Docs checked (developer.android.com, 2026-11-11)
- Collections: RemoteViewsService/RemoteViewsFactory; `onCreate` more than 20 s is an ANR; heavy work belongs in
  `onDataSetChanged`/`getViewAt`. API 31 adds `setRemoteAdapter(int, RemoteViews.RemoteCollectionItems)`, preferred while
  the collection is small: no factory, no `notifyAppWidgetViewDataChanged`, no latency on scroll. Item taps need a
  pending-intent template plus fill-in intents.
- RemoteViews cross a binder boundary with a size limit (about 1 MB in practice, from general Android knowledge, not on
  the collections page): up to 14 full-width bitmaps may exceed it. The Timeline therefore draws each row at the widget's
  pixel width and a modest height, RGB565 where possible, and the plan is checked on a device (see risks).
- minSdk 26 < 31, so the factory fallback is needed.

## Testing plan (Android unit tests, to be written first, red)
- `ScrollWidgetRowsTest`: rows from a week/14-day dataset: headers, all-day first, empty days skipped, task list row, range cut at 14 days.
- `ScrollWidgetStyleStoreTest`: style stored per widget id, default Agenda, removed with the widget.
- `ScrollWidgetTapTest`: fill-in intent carries the date / item id; header and strip give the day.
- `ScrollWidgetInflateTest` (like `WidgetInflateTest`): both layouts inflate narrow and short; empty text.
- `TimelineRowRenderTest` (like `DayCanvasRenderTest`): one day row draws at a given size, light and dark.
- `WeekFetcher` range test: `to=today+14`; `PickDataTest` extension for the 14-day snapshot.
- Web: `web/test/widget-snapshot.test.ts` extended: snapshot has 14 days from today, hidden calendars left out.
- Device check: place both styles, rotate, dark mode, airplane mode, 14 Timeline rows with a busy calendar.

## Implementation plan
1. Snapshot: 14 days from today (web), fetch range (native). Tests first. Does not change what the week widget draws.
2. Rows model + style store (pure Java). 3. Agenda with factory + RemoteCollectionItems. 4. Configure activity.
5. Timeline rows. 6. Taps. 7. Sizes, strings, theme. Mockup (see below) before steps 3 and 5.
One PR is fine (single feature, atomic commits). Native change: ships with the APK (AGENTS.md).

## Mockup must show (phone size 375x812, light and dark)
- Agenda: a day header with date and "today" mark, rows with time, colour dot, title; all-day row; task list row with done/total; the empty state; a row that is cut off at the bottom to show it scrolls.
- Timeline: two or three day strips under a day header each (all-day band, hour grid fitted to the day, blocks, now line only on today), and the cut-off third.
- Narrow (2 cells) and short (2 rows) variants of both.
- The configure screen: the two styles as a choice with a small preview each, and where it is reached from (placement, long-press Reconfigure).
- Reuse the app's M3 widget look (theme roles from the snapshot); no new button/pill variants.

## Assumptions / open questions
1. Reach 14 days (the week widget reaches only the current week; the device holds a year but a widget list that long is not useful).
2. Existing widgets have no configure screen, so there is nothing to reuse; a new configure activity is added.
3. "Optionally a timeline" read as a per-widget choice of the two styles, not two widgets.
4. Days without entries are skipped in both styles (a Timeline of 14 mostly empty strips would waste the space).
5. No new shared/ rule: visibility has no pure function in `shared/` today (server `excludeHidden` + web snapshot filter); this widget uses both routes as the others. Moving it into `shared/` would be a separate refactor.
6. Timeline of a busy 14 days may hit the RemoteViews size limit; fall back to fewer rows (e.g. 7 days) if the device check shows it.
7. No ADR: no cross-cutting decision beyond this feature. No REST change (`spec/API.md` unchanged).
8. Is a "now" line / auto-scroll to today needed? Assumed: list starts at today (past entries of today stay).
