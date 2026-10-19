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

  Scenario: The overview's band shows the lists in full as stacked cards
    Given the two-row week overview is on
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | Tomatoes     |
      | Pasta        |
      | Coffee beans |
    And the calendar contains a task list "Prepare demo" on 2026-10-12 with items:
      | Test the walkthrough |
      | Book the room        |
    When I open the week of 2026-10-12 on a phone
    And I show the band's task lists in full
    Then the head row and the items of the band's cards do not overlap
    And the "top row" still looks like "two-row-band-full"

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
