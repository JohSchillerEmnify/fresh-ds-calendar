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
- RemoteViews.setScrollPosition = ListView.smoothScrollToPosition(int); setRelativeScrollPosition = smoothScrollByOffset(int)
  (developer.android.com/reference/android/widget/RemoteViews). Both are the only scroll calls a RemoteViews can make.
- AbsListView.PositionScroller (AOSP): a target row below the view is reached in several frame steps, each adding the
  fading edge (12 dp, ViewConfiguration) and overshooting by what the previous step still had to scroll; a target row that
  is already partly visible is reached in one step that puts its bottom at the list's bottom (scrollToVisible). So the
  list is two rows, [top .. end of the opening view] and [rest], and scrolls to the first: the opening minute is at the top
  exactly. ScrollPositionTest proves it on the framework's own ListView for 8, 12 and 16 hours at every hour.
- "The only gestures available for widgets are touch and vertical swipe" (developer.android.com/develop/ui/views/appwidgets/overview):
  no pinch, so the Hours in view setting is the way to zoom.
- AppWidgetServiceImpl limits a widget update to 6 x screen pixels of bitmap memory (AOSP, `mMaxWidgetBitmapMemory`).

## Assumptions
1. Hours in view counts the hour grid only (all-day band and day names are extra).
2. A List widget set to Timeline before this change becomes a List.
3. The top minute is min(now - 30 min, 24:00 - hours in view); the list never scrolls past 24:00 (no blank space).
4. The list height is the widget height minus 38 dp (day names and padding); a launcher that adds its own padding shifts the opening minute by that much (unverified on a device).
