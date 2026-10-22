@reminders @id:reminders
Feature: Several reminders per event, read from and written to Google
  The owner wants to be reminded e.g. 1 h 30, 30 min and 15 min before an event (2026-10-14). Google already stores
  reminders: per calendar a default list, per event either "use the default" or its own list. The app reads them, lets
  the person change them (written back to Google) and rings itself at each of them.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: An event that uses the calendar default shows that default
    Given the calendar "Personal" has the default reminders "30, 10"
    And the calendar contains an event "Dentist" on 2026-10-14 from 10:40 to 11:30
    When I open the event "Dentist"
    Then the event reminders show the calendar default "30 min, 10 min"

  Scenario: An event with its own reminders in Google shows them
    Given the calendar contains an event "Concert" on 2026-10-14 from 19:00 to 22:00
    And the event "Concert" has its own reminders "90, 30, 15" in Google
    When I open the event "Concert"
    Then the event reminders are "1 h 30 min, 30 min, 15 min"

  Scenario: I give an event its own reminders and Google gets them
    Given the calendar "Personal" has the default reminders "10"
    And the calendar contains an event "Concert" on 2026-10-14 from 19:00 to 22:00
    When I open the event "Concert"
    And I add the reminder "1 h 30 min"
    And I add the reminder "30 min"
    And I add the reminder "15 min"
    And I save the event
    Then the event "Concert" has the reminders "90, 30, 15" in Google
    And the event "Concert" does not use the calendar default in Google

  Scenario: Email reminders set in Google are kept
    Given the calendar contains an event "Concert" on 2026-10-14 from 19:00 to 22:00
    And the event "Concert" has its own reminders "10" and the email reminder "60" in Google
    When I open the event "Concert"
    And I remove the reminder "10 min"
    And I save the event
    Then the event "Concert" has the reminders "" in Google
    And the event "Concert" still has the email reminder "60" in Google

  Scenario: An event goes back to the calendar default
    Given the calendar "Personal" has the default reminders "10"
    And the calendar contains an event "Concert" on 2026-10-14 from 19:00 to 22:00
    And the event "Concert" has its own reminders "90" in Google
    When I open the event "Concert"
    And I choose the calendar default reminders
    And I save the event
    Then the event "Concert" uses the calendar default in Google

  Scenario: At most five reminders per event
    Given the calendar contains an event "Concert" on 2026-10-14 from 19:00 to 22:00
    And the event "Concert" has its own reminders "5, 10, 15, 30, 60" in Google
    When I open the event "Concert"
    Then I cannot add another reminder

  Scenario: Settings show and change a calendar's default reminders
    Given the calendar "Personal" has the default reminders "30"
    When I open the reminder settings
    Then the reminder settings show "30 min" for the calendar "Personal"
    When I add the default reminder "15 min" for the calendar "Personal"
    Then the calendar "Personal" has the default reminders "30, 15" in Google

  Scenario: The app reminds at every reminder of an event
    Given the calendar contains an event "Dentist" on 2026-10-12 from 11:00 to 11:30
    And the event "Dentist" has its own reminders "30, 15" in Google
    And the time is 2026-10-12 10:25 and the clock is running
    When I open the week view for 2026-10-12
    Then I do not see a transition warning
    When 5 minutes pass
    Then I see the transition warning "Dentist starts in 30 min"
    When I dismiss the transition warning
    And 15 minutes pass
    Then I see the transition warning "Dentist starts in 15 min"

  Scenario: No reminder when neither the calendar nor the event has one
    Given the calendar contains an event "Dentist" on 2026-10-12 from 11:00 to 11:30
    And the time is 2026-10-12 10:25 and the clock is running
    When I open the week view for 2026-10-12
    And 30 minutes pass
    Then I do not see a transition warning

  Scenario: Task list reminders only with the switch on
    Given the calendar contains a task list "Taxes" on 2026-10-12 at 11:00 for 30 minutes with items:
      | item  | done |
      | Forms | no   |
    And the task list "Taxes" has its own reminders "30" in Google
    And the time is 2026-10-12 10:25 and the clock is running
    When I open the week view for 2026-10-12
    And 6 minutes pass
    Then I do not see a transition warning
    When I open the reminder settings
    And I switch on reminders for task lists
    And I open the week view for 2026-10-12
    Then I see the transition warning "Taxes starts in 30 min"

  @web-push
  Scenario: The browser push switch subscribes this browser
    When I open the reminders settings
    And I switch on reminders in this browser
    Then this browser has a push subscription on the server

  @web-push
  Scenario: A subscribed browser sends its reminder plan and gets the push at its time
    Given the calendar "Personal" has the default reminders "30, 10"
    And the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
    And the time is 2026-10-12 10:00
    When I open the reminders settings
    And I switch on reminders in this browser
    Then the server has 2 planned pushes for this browser
    When the time is 2026-10-12 10:10
    Then the push "Dentist starts in 30 min" was sent once
