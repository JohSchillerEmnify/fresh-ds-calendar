@scrolling-widget @id:scrolling-widget
Feature: Scrolling phone widget
  A new Android home-screen widget that scrolls. In Settings › Widgets › Android the person chooses what it shows:
  the "Agenda" (today and the coming days under day headers, one text row per entry) or the "Timeline" (the next days
  as columns side by side, the hours running top to bottom, scrolled with a finger; 1 to 7 days, 3 by default). The
  week, day and clock widgets stay exactly as they are. Like them it is native, reads with the app's sign-in and keeps
  showing the app's last copy when the server cannot be reached. The choice is per person, kept in the app and handed
  to the widget with the rest of its copy; there is no separate screen when a widget is placed. The widget scenarios
  are proven by its own Android unit tests or on a device; the settings scenarios run in the browser suite.

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  Rule: The Android section of the Widgets settings chooses the style and the days

    Scenario: The scrolling widget starts as an Agenda with a three-day Timeline
      When I open the settings
      And I open the settings group "Widgets"
      Then the scrolling widget style is set to "Agenda"
      And the scrolling widget Timeline days are set to "3"

    Scenario: The style and the number of days can be changed
      When I open the settings
      And I open the settings group "Widgets"
      And I set the scrolling widget style to "Timeline"
      And I set the scrolling widget Timeline days to "5"
      Then the scrolling widget style is set to "Timeline"
      And the scrolling widget Timeline days are set to "5"

    Scenario: Search finds the List widget under Widgets
      When I open the settings
      And I search the settings for "agenda"
      Then the settings search shows "List widget" in "Widgets"

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

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/TimelineRowsTest.java:holdsMoreHoursThanFitSoItScrolls
    @unit
    Scenario: The Timeline scrolls through the hours
      Given the calendar contains an event "Early" on 2026-10-14 from 06:00 to 07:00
      And the calendar contains an event "Late" on 2026-10-14 from 21:00 to 22:00
      When I look at a short scrolling widget in the "Timeline" style
      Then the scrolling widget shows fewer hours than it holds and scrolls to the others

  Rule: What the widget shows follows the app

    # unit: web/test/widget-snapshot.test.ts:carries the next 14 days, the style and the number of days
    @unit
    Scenario: The style and the days reach the widget
      Given the scrolling widget style is chosen as "Timeline" with 5 days
      When the app hands the widget its copy
      Then the scrolling widget shows the "Timeline" style with 5 days

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/ScrollRowsTest.java:fallsBackToAgendaAndThreeDays
    @unit
    Scenario: A missing or unknown choice means an Agenda and three days
      Given the app's copy has no choice for the scrolling widget
      When I look at the scrolling widget
      Then the scrolling widget shows the "Agenda" style with 3 days

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
