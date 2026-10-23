@labs @now-next @id:labs-now-next
Feature: Labs: Now and Next
  Experimental (Labs, off by default): today as a stack of big cards instead of a grid. The Now card says what is
  running and how much of it is left, in words and as a shrinking bar; with nothing running it shows the first open
  task list of today, and with nothing to do it says until when I am free. The Next card says what comes next and how
  soon. The rest of today waits folded in a Later card. A tap on a card opens the entry.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 14:00 to 15:00

  Scenario: The Now card shows what is running and the time left
    Given the time is 2026-10-14 14:25
    When I open the Now view
    Then the Now card shows "Dentist" with "35 min left"
    And the time bar of the Now card is 58 % full
    When I tap the Now card
    Then the event dialog is open

  Scenario: The Next card says how soon the next entry starts
    Given the time is 2026-10-14 14:25
    And the calendar contains an event "Call Mia" on 2026-10-14 from 16:20 to 16:40
    When I open the Now view
    Then the Next card shows "Call Mia" in "1 h 55 min" at 16:20

  Scenario: With nothing running, the first open task list is the Now card
    Given the time is 2026-10-14 10:00
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | yes  |
      | Eggs | no   |
    When I open the Now view
    Then the Now card shows the task list "Groceries" with its next task "Eggs"
    And the Next card shows "Dentist" in "4 h" at 14:00

  Scenario: With nothing to do, the Now card says until when I am free
    Given the time is 2026-10-14 10:00
    When I open the Now view
    Then the Now card says "Free until 14:00"

  Scenario: The rest of today waits folded in the Later card
    Given the time is 2026-10-14 10:00
    And the calendar contains an event "Gym" on 2026-10-14 from 17:00 to 18:00
    And the calendar contains an event "Dinner" on 2026-10-14 from 19:00 to 20:00
    When I open the Now view
    Then the Later card says "2 more"
    When I unfold the Later card
    Then the Later card lists "17:00 Gym, 19:00 Dinner"

  Scenario: Now is an experimental view that is off until switched on
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    Then the view switcher does not offer "Now"
    When I switch the Labs view "Now" on in the settings
    Then the view switcher offers the experimental views "Now"
