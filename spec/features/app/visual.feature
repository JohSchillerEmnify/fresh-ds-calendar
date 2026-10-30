@visual @mobile @id:visual-states
Feature: The calendar's states look right
  Every state that is drawn (not just measured) has rules that need no reference picture — nothing is clipped, nothing
  overlaps, the pill covers the card it grew from — and a picture that guards against regressions once the state is
  right. The pictures are checked by the person who changes the UI, at the phone size, before a change is called done.

  Background:
    Given the calendar is empty
    And the expanding task-list cards experiment is on
    And today is 2026-10-12

  Scenario: The two-row week overview is tidy
    Given the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    And the calendar contains an event "Workshop" on 2026-10-12 from 13:00 to 16:00
    And the calendar contains an event "Kino" on 2026-10-18 from 20:00 to 21:30
    And the calendar contains an all-day event "Trip" on 2026-10-14
    And the calendar contains a task list "Weekend chores" on 2026-10-13 at 17:00 for 90 minutes with items:
      | Vacuum the flat   |
      | Water the plants  |
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | Tomatoes |
      | Pasta    |
    When I open the week of 2026-10-12 on a phone
    Then no text in the "week overview" is clipped
    And the "week overview" still looks like "two-row-week"

  Scenario: A task list grown downward in the overview is tidy
    Given the two-row week overview is on
    And the calendar contains a task list "Weekend chores" on 2026-10-13 at 11:00 for 90 minutes with items:
      | Vacuum the flat    |
      | Water the plants   |
      | Take out the bins  |
    And the calendar contains an event "Kino" on 2026-10-18 from 20:00 to 21:30
    When I open the week of 2026-10-12 on a phone
    And I tap "Weekend chores"
    Then no text in the "expanded task list" is clipped
    And the head row and the items of the expanded task list do not overlap
    And the pill of the expanded task list covers the card "Weekend chores" it grew from
    And the pill of the expanded task list shows the count "0/3"
    And the "top row" still looks like "two-row-grown-down"

  Scenario: A task list grown upward late in the day is tidy
    Given the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    And the calendar contains a task list "Weekend chores" on 2026-10-13 at 20:00 for 90 minutes with items:
      | Vacuum the flat    |
      | Water the plants   |
      | Take out the bins  |
    When I open the week of 2026-10-12 on a phone
    And I tap "Weekend chores"
    Then no text in the "expanded task list" is clipped
    And the head row and the items of the expanded task list do not overlap
    And the pill of the expanded task list covers the card "Weekend chores" it grew from
    And the pill of the expanded task list shows the count "0/3"
    And the "top row" still looks like "two-row-grown-up"

  Scenario: A short task list grows with a tight pill
    Given the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    And the calendar contains an event "Kino" on 2026-10-18 from 20:00 to 21:30
    And the calendar contains a task list "Call the dentist and the bank" on 2026-10-13 at 12:00 for 15 minutes with items:
      | Dentist |
      | Bank    |
    When I open the week of 2026-10-12 on a phone
    And I tap "Call the dentist and the bank"
    Then no text in the "expanded task list" is clipped
    And the head row and the items of the expanded task list do not overlap
    And the pill of the expanded task list covers the card "Call the dentist and the bank" it grew from
    And the pill of the expanded task list shows the count "0/2"
    And the "top row" still looks like "two-row-grown-tight"

  Scenario: The normal week's grown card is unchanged
    Given the calendar contains a task list "Weekend chores" on 2026-10-14 at 14:00 for 90 minutes with items:
      | Vacuum the flat    |
      | Water the plants   |
      | Take out the bins  |
    When I open the week of 2026-10-12 on a phone
    And I tap "Weekend chores"
    Then no text in the "expanded task list" is clipped
    And the head row and the items of the expanded task list do not overlap
    And the pill of the expanded task list covers the card "Weekend chores" it grew from
    And the "week overview" still looks like "week-grown"

  Scenario: The normal week's tight pill keeps its title on one line
    Given the calendar contains a task list "Weekly shopping for the big family barbecue" on 2026-10-14 at 11:00 for 30 minutes with items:
      | Milk |
    When I open the week of 2026-10-12 on a phone
    And I tap "Weekly shopping for the big family barbecue"
    Then no text in the "expanded task list" is clipped
    And the head row and the items of the expanded task list do not overlap
    And the pill of the expanded task list covers the card "Weekly shopping for the big family barbecue" it grew from
    And the "week overview" still looks like "week-grown-tight"

  # Owner, 2026-10-20: the overview's switch has the same two levels as the day view (titles only, expanded), never a
  # third. It replaces the 2026-10-19 "pills only, no switch" rule for the overview.
  Scenario: The overview's band switch has two levels, and a tap grows a list in place
    Given the two-row week overview is on
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | Tomatoes     |
      | Pasta        |
      | Coffee beans |
    And the calendar contains a task list "Prepare demo" on 2026-10-12 with items:
      | Test the walkthrough |
      | Book the room        |
    When I open the week of 2026-10-12 on a phone
    Then the band's lists are one-line pills
    And the "top row" still looks like "two-row-band"
    When I tap the band's section switch
    Then the band's lists show their items
    And the "top row" still looks like "two-row-band-full"
    When I tap the band's section switch
    Then the band's lists are one-line pills
    When I tap "Groceries"
    Then "Groceries" expands in place and shows "Tomatoes"
    And the "top row" still looks like "two-row-band-grown"

  Scenario: A grown task list in the dark theme is a box of its own
    Given the device prefers a dark color scheme
    And the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    And the calendar contains an event "Kino" on 2026-10-18 from 20:00 to 21:30
    And the calendar contains a task list "Weekend chores" on 2026-10-13 at 11:00 for 90 minutes with items:
      | Vacuum the flat    |
      | Water the plants   |
      | Take out the bins  |
    When I open the week of 2026-10-12 on a phone
    And I tap "Weekend chores"
    Then the list of the expanded task list stands out from the grid behind it
    And the "top row" still looks like "two-row-grown-dark"

  # Owner, 2026-10-20 ("about the 10th time", screenshot): a short timed task list under a later event that cascades over
  # it had its title cut in half. The overlap is right; the cut title is not. A-64: a cascade keeps the earlier title readable.
  Scenario: A task list under a later event keeps its title readable
    Given the time grid is zoomed to 72 pixels per hour
    And the calendar contains a task list "Packen Orchester, Noten, Schlägel, Notenständer, Tasche" on 2026-10-12 at 18:15 for 30 minutes with items:
      | Noten    |
      | Schlägel |
    And the calendar contains an event "Dancefitness" on 2026-10-12 from 18:30 to 19:15
    And the calendar contains an event "Ensemble rehearsal" on 2026-10-12 from 19:00 to 22:00
    When I open the day view for 2026-10-12
    Then no title in the "day column" is covered by another entry
    And no text in the "day column" is clipped

  Scenario: An event 15 minutes into a task list never covers its title at the default zoom
    Given the calendar contains a task list "Packen Orchester, Noten, Schlägel, Notenständer, Tasche" on 2026-10-12 at 18:00 for 60 minutes with items:
      | Noten    |
      | Schlägel |
    And the calendar contains an event "Dancefitness" on 2026-10-12 from 18:15 to 19:15
    When I open the day view for 2026-10-12
    Then no title in the "day column" is covered by another entry
    And no text in the "day column" is clipped

  # Owner, 2026-10-24: the clock's middle cut "Next: Anspielprobe in 3 h 17 min" to "in 3…". Title over time, two lines.
  Scenario: The clock's middle names a long title over its time and countdown
    Given the time is 2026-10-12 16:23
    And the calendar contains an event "Dentist" on 2026-10-12 from 09:00 to 10:00
    And the calendar contains an event "Anspielprobe mit dem ganzen Orchester im großen Saal" on 2026-10-12 from 19:40 to 22:00
    When I open the clock view for 2026-10-12
    Then no text in the "clock" is clipped
    And the "clock" still looks like "clock-next-long"

  Scenario: The clock's middle counts down a running entry in the dark theme
    Given the device prefers a dark color scheme
    And the time is 2026-10-12 18:30
    And the calendar contains an event "Dentist" on 2026-10-12 from 09:00 to 10:00
    And the calendar contains a task list "Laundry" on 2026-10-12 at 18:00 for 90 minutes with items:
      | Wash |
      | Fold |
    When I open the clock view for 2026-10-12
    Then no text in the "clock" is clipped
    And the "clock" still looks like "clock-running-dark"

  Scenario: The clock's middle names tomorrow's first entry in German
    Given the browser language is "de-DE"
    And the time is 2026-10-12 20:00
    And the calendar contains an event "Dentist" on 2026-10-12 from 09:00 to 10:00
    And the calendar contains an event "Probe" on 2026-10-13 from 09:00 to 11:00
    When I open the clock view for 2026-10-12
    Then no text in the "clock" is clipped
    And the "clock" still looks like "clock-tomorrow-de"

  Scenario: The rings clock's middle on a crowded German day keeps its countdown readable
    Given the browser language is "de-DE"
    And the time is 2026-10-12 09:30
    And the calendar contains these events on 2026-10-12:
      | title                                                    | from  | to    |
      | Quartalsplanung mit dem ganzen Leitungsteam              | 09:00 | 11:45 |
      | Anruf                                                    | 09:40 | 10:15 |
      | Abstimmung                                               | 09:45 | 10:30 |
      | Mittagessen                                              | 12:00 | 13:00 |
      | Physio                                                   | 13:00 | 13:45 |
      | Paket abholen                                            | 14:00 | 14:10 |
      | Probe                                                    | 19:30 | 22:00 |
    When I open the rings clock for 2026-10-12
    Then no text in the "clock" is clipped
    And no two names on the clock overlap
    And the "clock" still looks like "clock-rings-crowded-de"

  # Feature tasklist-templates (owner's design canvas, 2026-10-25)
  Scenario: The list sheet's footer offers Save as template, which opens a small sheet with the name and the items
    Given the expanding task-list cards experiment is off
    And the calendar contains a task list "Packing" on 2026-10-12 with items:
      | item       | done |
      | Passport   | yes  |
      | Charger    | no   |
      | Toothbrush | no   |
    When I open the day view for 2026-10-12
    And I tap the task list "Packing"
    Then the task list "Packing" opens as the list sheet
    And no text in the "expanded task list" is clipped
    And the "expanded task list" still looks like "template-footer"
    When I save the task list as a template
    Then no text in the "template save sheet" is clipped
    And the "template save sheet" still looks like "template-save"

  Scenario: The template pill grows into the template menu, and a pick fills the form
    Given I have the template "Clean bathroom" with the items "Sink, Floor", the estimate 45 minutes and the category "Home"
    And I have the template "Packing" with the items "Passport, Charger, Toothbrush"
    When I open the day view for 2026-10-12
    And I start creating a task list
    And I open the template picker
    Then the template menu has grown out of the template pill
    And no text in the "list form" is clipped
    And the "list form" still looks like "template-menu"
    When I choose the template "Clean bathroom"
    Then no text in the "list form" is clipped
    And the "list form" still looks like "template-form-filled"

  Scenario: Settings › Templates lists the templates with their details
    Given I have the template "Clean bathroom" with the items "Sink, Floor", the estimate 45 minutes and the category "Home"
    And I have the template "Packing" with the items "Passport, Charger, Toothbrush"
    When I open the templates in the settings
    Then the templates page lists "Clean bathroom, Packing"
    And no text in the "templates page" is clipped
    And the "templates page" still looks like "templates-page"

  Scenario: Settings › Templates without templates says how to make one
    When I open the templates in the settings
    Then the templates page offers "New template"
    And no text in the "templates page" is clipped
    And the "templates page" still looks like "templates-empty"

  # Owner, 2026-10-25: "There are two bedtimes on that clock." A bedtime at midnight belongs to the evening before.
  Scenario: The clock on a Saturday shows the midnight bedtime at the top of the dial
    Given the device prefers a dark color scheme
    And the time is 2026-10-24 20:00
    And bedtime mode is on with fixed times 23:00 and 07:00, and 00:00 and 09:00 on weekends
    When I open the clock view for 2026-10-24
    Then the "clock" still looks like "clock-bedtime-saturday-dark"

  Scenario: The clock after a midnight bedtime shows only tonight's moon
    Given the device prefers a dark color scheme
    And the time is 2026-10-25 01:12
    And bedtime mode is on with fixed times 23:00 and 07:00, and 00:00 and 09:00 on weekends
    When I open the clock view for 2026-10-25
    Then the "clock" still looks like "clock-bedtime-sunday-dark"

  Scenario: The clock on a Friday shows the midnight bedtime at the top of the dial
    Given the device prefers a dark color scheme
    And the time is 2026-10-23 20:00
    And bedtime mode is on with fixed times 23:00 and 07:00, and 00:00 and 09:00 on weekends
    When I open the clock view for 2026-10-23
    Then the "clock" still looks like "clock-bedtime-friday-dark"

  Scenario: The Saturday column shows the midnight bedtime at its bottom edge
    Given the time is 2026-10-24 12:00
    And bedtime mode is on with fixed times 23:00 and 07:00, and 00:00 and 09:00 on weekends
    When I open the day view for 2026-10-24
    And I scroll the time grid to the end of the day
    Then the "time grid" still looks like "day-bedtime-saturday-end"
