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

  Scenario: Reminders of a read-only event are kept by the app and survive a reload
    Google has no reminders for single events of a calendar I can only read, so the app keeps them and never asks
    Google (owner, 2026-10-23).
    Given a calendar "Anna" shared with me read-only by "anna@example.org"
    And the calendar "Anna" contains an event "Yoga" on 2026-10-14 from 07:00 to 08:00
    And the event "Yoga" has its own reminders "30" in Google
    When I open the week view for 2026-10-12
    And I open the event "Yoga"
    And I add the reminder "15 min"
    Then the event reminders are "30 min, 15 min"
    And the event dialog is read-only
    And the event "Yoga" has the reminders "30" in Google
    And the event "Yoga" in Google is still "Yoga" on 2026-10-14 from 07:00 to 08:00
    And the app keeps the reminders "30, 15" for the event "Yoga"
    When I reload the page
    And I open the event "Yoga"
    Then the event reminders are "30 min, 15 min"

  Scenario: Reminders kept by the app ring like any other
    Given a calendar "Anna" shared with me read-only by "anna@example.org"
    And the calendar "Anna" contains an event "Yoga" on 2026-10-12 from 11:00 to 12:00
    And the time is 2026-10-12 10:25 and the clock is running
    When I open the week view for 2026-10-12
    And I open the event "Yoga"
    And I add the reminder "30 min"
    And I cancel the event dialog
    And 5 minutes pass
    Then I see the transition warning "Yoga starts in 30 min"

  Scenario: The rest of a read-only event still cannot be edited
    Given a calendar "Anna" shared with me read-only by "anna@example.org"
    And the calendar "Anna" contains an event "Yoga" on 2026-10-14 from 07:00 to 08:00
    When I open the week view for 2026-10-12
    And I open the event "Yoga"
    And I add the reminder "15 min"
    Then the event dialog has no save or delete button
    When I try to rename the event "Yoga" through the API
    Then the API answers 403

  Scenario: Settings show and change a calendar's default reminders
    Given the calendar "Personal" has the default reminders "30"
    When I open the reminder settings
    Then the reminder settings show "30 min" for the calendar "Personal"
    When I add the default reminder "15 min" for the calendar "Personal"
    Then the calendar "Personal" has the default reminders "30, 15" in Google

  Scenario: Settings change a read-only calendar's default reminders, and Google gets them
    Google stores notifications for the whole calendar per person, also for a calendar I can only read (owner, 2026-10-23).
    Given a calendar "Anna" shared with me read-only by "anna@example.org"
    And the calendar "Anna" has the default reminders "30"
    When I open the reminder settings
    And I add the default reminder "15 min" for the calendar "Anna"
    Then the calendar "Anna" has the default reminders "30, 15" in Google

  Scenario: Events that use the calendar default ring with it
    Given a calendar "Anna" shared with me read-only by "anna@example.org"
    And the calendar "Anna" has the default reminders "15"
    And the calendar "Anna" contains an event "Standup" on 2026-10-12 from 10:00 to 10:30
    And the time is 2026-10-12 09:40 and the clock is running
    When I open the week view for 2026-10-12
    And 5 minutes pass
    Then I see the transition warning "Standup starts in 15 min"

  Scenario: An event's own reminders still win over the calendar default
    Given a calendar "Anna" shared with me read-only by "anna@example.org"
    And the calendar "Anna" has the default reminders "15"
    And the calendar "Anna" contains an event "Standup" on 2026-10-12 from 10:00 to 10:30
    And the event "Standup" has its own reminders "5" in Google
    And the time is 2026-10-12 09:40 and the clock is running
    When I open the week view for 2026-10-12
    And 5 minutes pass
    Then I do not see a transition warning
    When 10 minutes pass
    Then I see the transition warning "Standup starts in 5 min"

  Scenario: The app reminds at every reminder of an event and counts down while it is open
    The reminder in the open app says how long is left and keeps that right as the minutes pass.
    Given the calendar contains an event "Dentist" on 2026-10-12 from 11:00 to 11:30
    And the event "Dentist" has its own reminders "30, 15" in Google
    And the time is 2026-10-12 10:25 and the clock is running
    When I open the week view for 2026-10-12
    Then I do not see a transition warning
    When 5 minutes pass
    Then I see the transition warning "Dentist starts in 30 min"
    When 2 minutes pass
    Then I see the transition warning "Dentist starts in 28 min"
    When I dismiss the transition warning
    And 13 minutes pass
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
    Then I see the transition warning "Taxes starts in 29 min"

  Scenario Outline: An all-day event rings at 00:00 of its day minus each reminder set for it
    The rule, like Google (owner, 2026-10-23): an all-day event rings at 00:00 of its first day, in the calendar's time
    zone, minus each reminder that is set for it. The time is whatever reminder is set, not a fixed one: "5 min" rings at
    23:55 the evening before, "90 min" at 22:30, and 900 min (Google: "1 day before at 09:00") at 09:00 the day before.
    Given the calendar "Personal" has the default reminders "<reminder>"
    And the calendar contains an all-day event "Anna's birthday" on 2026-10-13
    And the time is 2026-10-12 <five minutes before> and the clock is running
    When I open the week view for 2026-10-12
    Then I do not see a transition warning
    When 5 minutes pass
    Then I see the transition warning "Anna's birthday starts in <left>"

    Examples:
      | reminder | five minutes before | left        |
      | 5        | 23:50               | 5 min       |
      | 90       | 22:25               | 1 h 30 min  |
      | 900      | 08:55               | 15 h        |

  Scenario: An all-day event's own reminder wins over the calendar default
    Same rule: 00:00 of its first day minus its own reminder "45 min" is 23:15 the evening before; the calendar default
    "5 min" does not ring for it.
    Given the calendar "Personal" has the default reminders "5"
    And the calendar contains an all-day event "Anna's birthday" on 2026-10-13
    And the event "Anna's birthday" has its own reminders "45" in Google
    And the time is 2026-10-12 23:10 and the clock is running
    When I open the week view for 2026-10-12
    Then I do not see a transition warning
    When 5 minutes pass
    Then I see the transition warning "Anna's birthday starts in 45 min"
    When I dismiss the transition warning
    And 40 minutes pass
    Then I do not see a transition warning

  @web-push
  Scenario: A multi-day all-day event rings once, saying its day
    Only its first day rings; the notification gives the day and "all day", never "in 30 min".
    Given the calendar contains an all-day event "Holiday" from 2026-10-13 to 2026-10-15
    And the event "Holiday" has its own reminders "30" in Google
    And the time is 2026-10-12 10:00
    When I open the reminders settings
    And I switch on reminders in this browser
    Then the server has 1 planned pushes for this browser
    And the server plans the push "Holiday" saying "Tue 13 Oct, all day" for 2026-10-12 23:30

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
    Then the push "Dentist" saying "10:40 – 11:30" was sent once

  @web-push
  Scenario: A reminder push names the event's times, not how long until it starts
    The push may be read long after it came, so it never says "in 30 min"; like Google Calendar it gives the times,
    and the day first when the event is not on the day the reminder comes.
    Given the calendar contains an event "Trip" on 2026-10-13 from 12:00 to 13:30
    And the event "Trip" has its own reminders "1440, 30" in Google
    And the time is 2026-10-12 10:00
    When I open the reminders settings
    And I switch on reminders in this browser
    Then the server plans the push "Trip" saying "Tue 13 Oct, 12:00 – 13:30" for 2026-10-12 12:00
    And the server plans the push "Trip" saying "12:00 – 13:30" for 2026-10-13 11:30

  @web-push
  Scenario: Each kind of reminder push has its own icon
    Given the calendar contains an event "Dentist" on 2026-10-12 from 11:00 to 11:30
    And the event "Dentist" has its own reminders "30" in Google
    And the calendar contains a task list "Taxes" on 2026-10-12 at 11:00 for 30 minutes with items:
      | item  | done |
      | Forms | no   |
    And the task list "Taxes" has its own reminders "30" in Google
    And the time is 2026-10-12 10:00
    When I open the reminder settings
    And I switch on reminders for task lists
    And I switch on reminders in this browser
    And the time is 2026-10-12 10:30
    Then the push "Dentist" was sent once with the "calendar page" icon
    And the push "Taxes" was sent once with the "checklist" icon

  @web-push
  Scenario: The bedtime reminder and the morning overview also come as browser pushes
    They follow the same rules as the appointments: the bedtime itself, never "in 30 minutes", and each its own icon.
    Given bedtime mode is on with fixed times 23:00 and 07:00
    And the morning overview is on at 07:30
    And the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And the time is 2026-10-12 20:00
    When I open the reminders settings
    And I switch on reminders in this browser
    Then the server plans the push "Bedtime at 23:00" saying "" for 2026-10-12 22:30
    And the server plans the push "Your day" saying "1 appointment · no lists · first: Dentist 10:00" for 2026-10-13 07:30
    When the time is 2026-10-12 22:30
    Then the push "Bedtime at 23:00" was sent once with the "moon" icon
    When the time is 2026-10-13 07:30
    Then the push "Your day" was sent once with the "sunrise" icon

  @web-push @backlog
  Scenario: Signing out stops reminders in this browser
    Given "jo@example.com" is signed in
    And I open the reminders settings
    And I switch on reminders in this browser
    When they sign out in the settings
    Then this browser has no push subscription on the server
