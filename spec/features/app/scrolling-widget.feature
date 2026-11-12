@scrolling-widget @id:scrolling-widget
Feature: Scrolling phone widgets (List and Multi-day)
  Two Android home-screen widgets that scroll, both in the widget picker. "List" (Agenda) shows today and the coming days
  under day headers, one text row per entry. "Multi-day" (Timeline) shows the next days as columns side by side with the
  hours running top to bottom, scrolled with a finger; 1 to 7 days (3 by default, the shared "Days in the Timeline"
  setting). The Multi-day widget fits about 16 hours into its height and opens with half an hour before now at the top;
  the person can choose 8, 12, 16 or 24 hours in view in Settings > Widgets > Android. Widgets cannot be pinched, so the
  setting is the way to zoom. A List widget placed before the split that showed the Timeline is a List now; the person
  adds a Multi-day widget from the picker. The week, day and clock widgets stay exactly as they are. Like them both are
  native, read with the app's sign-in and keep showing the app's last copy when the server cannot be reached. The choice
  is per person, kept in the app and handed to the widget with the rest of its copy; there is no separate screen when a
  widget is placed. The widget scenarios are proven by their own Android unit tests or on a device; the settings scenarios
  run in the browser suite. In the scenarios below the "Agenda" style is the List widget and the "Timeline" style is the
  Multi-day widget.

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  Rule: The Android section of the Widgets settings chooses the hours in view; the days are the shared Timeline setting

    Scenario: The Multi-day widget starts with 16 hours in view and three days
      When I open the settings
      And I open the settings group "Widgets"
      Then the hours in view are set to "16"
      And the timeline days are set to "3"

    Scenario: The hours in view and the number of days can be changed
      When I open the settings
      And I open the settings group "Widgets"
      And I set the hours in view to "8"
      And I set the timeline days to "5"
      Then the hours in view are set to "8"
      And the timeline days are set to "5"

    Scenario: The List widget has no style choice any more
      When I open the settings
      And I open the settings group "Widgets"
      Then the widget settings have no style choice for the List widget

    Scenario: Search finds the hours in view under Widgets
      When I open the settings
      And I search the settings for "hours"
      Then the settings search shows "Hours in view" in "Widgets"

  Rule: The picker offers a List and a Multi-day widget

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetInflateTest.java:thePickerOffersAListAndAMultiDayWidget
    @unit
    Scenario: The widget picker lists "List" and "Multi-day"
      When I open the Android widget picker
      Then the picker offers the widgets "List" and "Multi-day" next to the week, day and clock widgets

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetInflateTest.java:aListWidgetPlacedAsATimelineIsAListNow
    @unit
    Scenario: A List widget that showed the Timeline is a List now
      Given a List widget was placed while the app's copy chose the "Timeline" style
      When I look at the scrolling widget
      Then it shows the Agenda

  Rule: The Agenda lists the coming days

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:agendaListsTodayAndComingDaysUnderHeaders
    @unit
    Scenario: The Agenda lists today and the coming days under day headers
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Yoga" on 2026-10-16 from 07:00 to 08:00
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget shows the day header "Wed 14 Oct" with the entry "Dentist" at "09:00"
      And the scrolling widget shows the day header "Fri 16 Oct" with the entry "Yoga" at "07:00"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:agendaShowsAllDayFirstAndSkipsEmptyDays
    @unit
    Scenario: The Agenda shows all-day events first and skips empty days
      Given the calendar contains an all-day event "Holiday" on 2026-10-14
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget lists "Holiday" before "Dentist" under the day header "Wed 14 Oct"
      And the scrolling widget has no day header "Thu 15 Oct"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:agendaShowsATaskListWithItsCount
    @unit
    Scenario: The Agenda shows a task list like the other widgets
      Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
        | item  | done |
        | Milk  | yes  |
        | Eggs  | no   |
        | Bread | no   |
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget shows the day header "Wed 14 Oct" with the task list "Groceries" and "1/3"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:reachesFourteenDaysAhead
    @unit
    Scenario: The widget reaches 14 days ahead
      Given the calendar contains an event "Far" on 2026-10-27 from 09:00 to 10:00
      And the calendar contains an event "Too far" on 2026-10-28 from 09:00 to 10:00
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget shows the entry "Far" at "09:00"
      And the scrolling widget does not show the entry "Too far"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:narrowAgendaDropsTheTimes
    @unit
    Scenario: A narrow widget shows the entry titles only
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      When I look at a narrow scrolling widget in the "Agenda" style
      Then the scrolling widget shows the entry "Dentist" without a time

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetInflateTest.java:aShortAgendaHoldsEveryRowForScrolling
    @unit
    Scenario: A short widget still scrolls
      Given the calendar contains 10 events on 2026-10-14
      When I look at a short scrolling widget in the "Agenda" style
      Then the scrolling widget shows fewer entries than exist and scrolls to the others

  Rule: The Timeline draws the next days as columns with the hours running down

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/TimelineRowsTest.java:drawsThreeDayColumnsByDefault
    @unit
    Scenario: The Timeline draws three day columns with the hours running down
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      When I look at the scrolling widget in the "Timeline" style
      Then the scrolling widget draws 3 day columns, from "Wed 14 Oct" to "Fri 16 Oct"
      And the scrolling widget draws the hours from the top to the bottom of the columns

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/TimelineRowsTest.java:drawsTheChosenNumberOfDays
    @unit
    Scenario Outline: The Timeline follows the number of days
      When I look at the scrolling widget in the "Timeline" style with <days> days
      Then the scrolling widget draws <days> day columns, from "Wed 14 Oct" to "<last>"

      Examples:
        | days | last       |
        | 1    | Wed 14 Oct |
        | 7    | Tue 20 Oct |

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/TimelineRowsTest.java:placesAnEventInItsColumnAndHours
    @unit
    Scenario: An event stands in its day's column at its hours
      Given the calendar contains an event "Yoga" on 2026-10-15 from 07:00 to 08:00
      When I look at the scrolling widget in the "Timeline" style
      Then the scrolling widget draws "Yoga" in the column "Thu 15 Oct" from 07:00 to 08:00

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/TimelineRowsTest.java:holdsTheWholeDayAndFitsTheChosenHours
    @unit
    Scenario Outline: The Multi-day widget holds the whole day and fits the chosen hours into its height
      Given the calendar contains an event "Early" on 2026-10-14 from 06:00 to 07:00
      When I look at a 380 dp tall Multi-day widget with <hours> hours in view
      Then the widget holds the hours from 00:00 to 24:00
      And about <hours> hours fit into its height

      Examples:
        | hours |
        | 8     |
        | 12    |
        | 16    |
        | 24    |

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollPositionTest.java:theListOpensWithTheWantedMinuteAtTheTop
    @unit
    Scenario: The Multi-day widget opens with half an hour before now at the top
      When I look at the Multi-day widget at 14:10 with 8 hours in view
      Then the widget scrolls so that 13:40 is at the top

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/TimelineRowsTest.java:lateInTheDayTheLastHoursShowAndTheListNeverScrollsPast24
    @unit
    Scenario: Late in the day the widget shows the last hours and never scrolls past 24:00
      When I look at the Multi-day widget at 21:30 with 16 hours in view
      Then the widget shows the last 16 hours of the day with 24:00 at the bottom of the list
      And the list has no blank space below 24:00

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/TimelineRowsTest.java:aFullDayNeedsNoScrolling
    @unit
    Scenario: With 24 hours in view the whole day is shown from the top
      When I look at the Multi-day widget at 14:10 with 24 hours in view
      Then the widget does not scroll

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetPictureTest.java:drawsTheWidget
    @unit
    Scenario: The Multi-day widget is drawn for 8, 16 and 24 hours in view
      When I look at the Multi-day widget with 8, 16 and 24 hours in view
      Then each picture shows the hours from the top to the bottom of the columns with its own row height

  Rule: What the widget shows follows the app

    # unit: web/test/widget-snapshot.test.ts:carries the next 14 days, the hours in view and the number of days
    @unit
    Scenario: The hours in view and the days reach the widget
      Given the Multi-day widget is chosen with 5 days and 8 hours in view
      When the app hands the widget its copy
      Then the Multi-day widget shows 5 days and 8 hours in view

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:fallsBackToThreeDaysAndSixteenHours
    @unit
    Scenario: A missing or unknown choice means three days and 16 hours
      Given the app's copy has no choice for the scrolling widget
      When I look at the Multi-day widget
      Then the Multi-day widget shows 3 days and 16 hours in view

    # unit: web/test/widget-snapshot.test.ts:leaves out events of hidden calendars
    @unit
    Scenario: Hidden calendars stay off the scrolling widget
      Given "jo@example.com" has the calendar "Work" and the shared calendar "Anna"
      And the calendar "Anna" has an event "Yoga" on 2026-10-14 from 07:00 to 08:00
      And "jo@example.com" hid the calendar "Anna"
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget does not show the entry "Yoga"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetInflateTest.java:withoutAConnectionTheAppsCopyIsShown
    @unit
    Scenario: Without a connection the widget shows the app's last copy
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the phone has no connection to the server
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget shows the entry "Dentist" at "09:00"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetInflateTest.java:aNewSnapshotRedrawsTheScrollingWidget
    @unit
    Scenario: A change in the app shows in the widget without a manual refresh
      Given the scrolling widget shows the entry "Dentist" at "09:00"
      When the event "Dentist" moves to 11:00 in the app
      Then the scrolling widget shows the entry "Dentist" at "11:00"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:aNewDayMovesTheListOn
    @unit
    Scenario: A new day moves the list on
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Yoga" on 2026-10-15 from 07:00 to 08:00
      When the date changes to 2026-10-15
      Then the scrolling widget shows no day header "Wed 14 Oct"
      And the scrolling widget shows the day header "Thu 15 Oct" with the entry "Yoga" at "07:00"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:anEmptyAgendaSaysSo
    @unit
    Scenario: An empty list says so
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget says "Nothing planned"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetInflateTest.java:bothStylesInflateInLightAndDark
    @unit
    Scenario: The widget follows the dark and light theme
      Given the app's theme is dark
      When I look at the scrolling widget in the "Agenda" style
      Then the scrolling widget uses the dark theme colours

  Rule: Taps open the app

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:anEntryOpensItsDayAndAHeaderOpensThatDay
    @unit
    Scenario: Tapping an entry opens its day in the app
      Given the calendar contains an event "Yoga" on 2026-10-16 from 07:00 to 08:00
      When I tap the entry "Yoga" in the scrolling widget
      Then the app opens the day view for 2026-10-16

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:anEntryOpensItsDayAndAHeaderOpensThatDay
    @unit
    Scenario: Tapping a day header opens that day
      Given the calendar contains an event "Yoga" on 2026-10-16 from 07:00 to 08:00
      When I tap the day header "Fri 16 Oct" in the scrolling widget
      Then the app opens the day view for 2026-10-16

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollWidgetInflateTest.java:timelineTapsOpenTheDay
    @unit
    Scenario: Tapping a day's name above the Timeline opens that day
      When I tap the Timeline day "Thu 15 Oct" in the scrolling widget
      Then the app opens the day view for 2026-10-15

  Rule: The other widgets stay as they are

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/WidgetInflateTest.java:weekWidgetInflates
    @unit
    Scenario: The existing widgets are unchanged
      When I look at the week widget, the day widget and the clock widget
      Then they are still drawn as one picture each and do not scroll
