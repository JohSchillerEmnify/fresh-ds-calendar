# Two Android widgets: List and Multi-day (issue #112)

## As Is
One scrolling widget (#96) with a per-person style (Agenda or Timeline, pref `androidWidgetStyle`). The Timeline holds
only the hours its events need (at least six) at a fixed 40 dp per hour.

## To Be
- Two picker entries: "List" (`ScrollWidgetProvider`, Agenda) and "Multi-day" (`MultiDayWidgetProvider`, Timeline).
- Style row removed from Settings; `androidWidgetStyle` stays stored and readable, unused.
- Multi-day holds the whole day (00:00-24:00); the row height follows the widget height so that "Hours in view"
  (`androidWidgetHours`: 8, 12, 16, 24; default 16) hours fit; it opens with now minus 30 minutes at the top.
- Per person, device-first: the pref travels in the snapshot (`scrollHours`) like `scrollDays`.

## Requirements and acceptance
See `spec/features/app/scrolling-widget.feature`.

## Docs
- RemoteViews.setScrollPosition = ListView.smoothScrollToPosition(int) (developer.android.com/reference/android/widget/RemoteViews).
  AbsListView.PositionScroller (AOSP) brings a target below the view to the bottom edge, not the top: the row to scroll to
  is the one that ends at the bottom when the wanted row is at the top, so the list is cut at exactly those two minutes.
- Widgets take no pinch gestures: an app widget is a RemoteViews tree; the supported interaction is click and collection
  scroll (developer.android.com/develop/ui/views/appwidgets/overview).
- AppWidgetServiceImpl limits a widget update to 6 x screen pixels of bitmap memory (AOSP, `mMaxWidgetBitmapMemory`).

## Assumptions
1. Hours in view counts the hour grid only (all-day band and day names are extra).
2. A List widget set to Timeline before this change becomes a List.
3. The scroll lands within the list's fading-edge length of the wanted minute; unverified on a device.
