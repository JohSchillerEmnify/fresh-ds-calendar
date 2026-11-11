@iphone-widget @id:iphone-widget
Feature: iPhone widgets through Scriptable
  An iPhone has no native calendar app here, so the home-screen and lock-screen widgets are a small script that runs in
  the free Scriptable app. The person creates a widget key for the phone in Settings, pastes a tiny installer (the key and the
  server URL are already in it) into Scriptable once and runs it; the installer downloads the real widget script, which
  later updates itself. Then the person adds a Scriptable widget on the home screen. The widget reads the
  same data as the Android widgets, for that person only, and shows its last answer when there is no connection. iOS
  decides when a widget is redrawn, so it can be a few minutes to an hour behind. The script runs on the iPhone and
  the key works only for the widget data: these scenarios are proven by the server's own tests and on a device, not
  in the browser suite, except the Settings ones.
  The home screen has the Day view (small), today and tomorrow (medium) and the Week (large); the size picks the view.
  Every size reads top-down: a big date, the next entry as a large coloured block, the rest of today in small text, a compact
  "Tomorrow" section (medium), and a "+N more" line when things overflow. No size has a time strip: a widget cannot scroll,
  so a full day does not fit.
  The lock screen has the three accessory families Scriptable supports: inline, circular and rectangular. The widget draws
  no clock of its own, because iOS shows its clock on the lock screen, and no date line above the circle and the box, because
  they show it themselves. The circle says "in N min" (time until the next entry starts), never time left.
  An iPhone widget is a fixed picture: it cannot scroll or page, and Scriptable widgets have no buttons.

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  Rule: A person sets the widget up from Settings in a few taps

    @backlog
    Scenario: A widget key is created for this phone and the installer is ready to copy
      When I open the iPhone widget settings
      And I create a widget key named "My iPhone"
      Then the settings show the widget key "My iPhone"
      And the new widget key is shown once with the buttons "Copy installer" and "Open Scriptable"

    @backlog
    Scenario: The setup offers a link to get Scriptable
      When I open the iPhone widget settings
      And I create a widget key named "My iPhone"
      Then the setup offers a link to get Scriptable

    @backlog
    Scenario: The setup is a guide of seven steps
      When I open the iPhone widget settings
      And I create a widget key named "My iPhone"
      Then the setup says "Your calendar on the iPhone home screen and lock screen."
      And the setup guide step 1 says "Install the free Scriptable app:" and expects "Come back here afterwards."
      And the setup guide step 2 says "Copy installer" and has no hint
      And the setup guide step 3 says "Open Scriptable" and expects "If a welcome screen appears, close it and tap the button again."
      And the setup guide step 4 says "Tap the empty page, then tap Paste." and has no hint
      And the setup guide step 5 says "Tap ▶ at the bottom right. When “Installed” appears, close Scriptable." and has no hint
      And the setup guide step 6 says "On the home screen, press and hold an empty spot. Tap Edit › Add Widget, search for Scriptable, pick a size and tap Add Widget." and has no hint
      And the setup guide step 7 says "Tap the new widget, then Script › Calendar." and has no hint
      And the setup says "The installer only works for this iPhone and is shown only once."

    @backlog
    Scenario: Copying the installer is confirmed on the button
      Given I created a widget key named "My iPhone"
      When I copy the widget installer
      Then the button "Copy installer" now says "Copied ✓"

    @backlog
    Scenario: The settings say when the widget is connected
      Given I created a widget key named "My iPhone"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the setup guide shows "Widget connected ✓" for the widget key "My iPhone"

    @backlog
    Scenario: The copied installer has the key and the server URL filled in
      Given I created a widget key named "My iPhone"
      When I copy the widget installer
      Then the copied widget installer holds the key and the server URL
      And the copied widget installer says nothing else to fill in

    # unit: server/test/ios-widget.test.ts:saves the script as Calendar
    @unit
    Scenario: The installer downloads the widget script with the key
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When the widget installer runs with the key "My iPhone"
      Then the widget script is saved on the phone as a Scriptable script named "Calendar"
      And the saved widget script holds no key and no person
      And the key and the server URL are kept in Scriptable's storage
      And the installer says to add a Scriptable widget

    # unit: server/test/widget-keys.test.ts:refuses an unknown or malformed key
    # unit: server/test/ios-widget.test.ts:says what to do after a
    @unit
    Scenario: The widget script is refused without a valid key
      When the widget installer runs with a key that does not exist
      Then the widget script request is refused as "unknown"
      And the installer says the key is not valid and nothing is saved

    # unit: server/test/ios-widget.test.ts:says what to do after a
    @unit
    Scenario: The installer says what to do when the key was removed
      Given the widget key "My iPhone" belongs to "jo@example.com"
      And I revoke the widget key "My iPhone"
      When the widget installer runs with the key "My iPhone"
      Then the installer says "This widget was removed in the app. Add it again in Settings."

    # unit: server/test/ios-widget.test.ts:says what to do without a connection
    @unit
    Scenario: The installer says what to do without a connection
      When the widget installer runs without a connection
      Then the installer says "No connection. Connect to the internet and tap ▶ again."
      And nothing is saved

    # unit: server/test/ios-widget.test.ts:says what to do when the server does not answer
    @unit
    Scenario: The installer says what to do when the server does not answer
      When the widget installer runs and the server does not answer
      Then the installer says "The calendar is not reachable. Try again in a few minutes."
      And nothing is saved

    # unit: server/test/ios-widget.test.ts:explains how to set it up
    @unit
    Scenario: An unconfigured widget explains how to add it
      When the iPhone widget runs without a key
      Then the iPhone widget says "Not set up yet. Run the installer in Scriptable first."

    # unit: server/test/ios-widget.test.ts:saves a newer script and keeps drawing
    @unit
    Scenario: A new script version arrives on its own
      Given the iPhone widget runs script version 1
      And the server offers the widget script version 2
      When the iPhone widget refreshes with the key "My iPhone"
      Then the widget script on the phone is version 2
      And the iPhone widget shows today as before

    # unit: server/test/ios-widget.test.ts:keeps the old script when the download breaks off
    @unit
    Scenario: A failed update keeps the old script working
      Given the iPhone widget runs script version 1
      And the server offers the widget script version 2
      When the iPhone widget refreshes and the script download breaks off
      Then the widget script on the phone is still version 1
      And the iPhone widget shows today as before

    @backlog
    Scenario: The key is not shown again later
      Given I created a widget key named "My iPhone"
      When I open the iPhone widget settings again
      Then the settings show the widget key "My iPhone"
      And the settings do not show the widget key itself

  Rule: Keys are listed, revocable and one person's only

    @backlog
    Scenario: The list shows the device name and the last use
      Given the widget key "My iPhone" was last used on 2026-10-13 at 18:30
      And the widget key "Old phone" was never used
      When I open the iPhone widget settings
      Then the settings show the widget key "My iPhone" last used on 2026-10-13 at 18:30
      And the settings show the widget key "Old phone" as never used

    # unit: server/test/widget-keys.test.ts:for a removed key and
    # unit: server/test/ios-widget.test.ts:says the key was removed and still shows
    @unit
    Scenario: A revoked key stops working and the widget says so
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When I revoke the widget key "My iPhone"
      And the iPhone widget refreshes with the key "My iPhone"
      Then the widget data request is refused as "revoked"
      And the iPhone widget shows "This widget was removed in the app. Add it again in Settings."
      And the iPhone widget still shows its last answer greyed out

    # unit: server/test/widget-keys.test.ts:refuses an unknown or malformed key
    @unit
    Scenario: A wrong key is refused and reads nothing
      When the iPhone widget refreshes with a key that does not exist
      Then the widget data request is refused as "unknown"

    # unit: server/test/widget-keys.test.ts:opens the data and the script and nothing else
    @unit
    Scenario: A key reads the widget data only
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When I request "GET /api/prefs" with the widget key "My iPhone"
      Then the response status is 401
      When I request "POST /api/events" with the widget key "My iPhone"
      Then the response status is 401

    # unit: server/test/widget-keys.test.ts:keeps only a hash of the key
    @unit
    Scenario: The server keeps only a hash of the key
      Given the widget key "My iPhone" belongs to "jo@example.com"
      Then the server's key file holds a hash of the key "My iPhone" and not the key

    # unit: server/test/widget-keys.test.ts:slows a key down after 30 requests
    @unit
    Scenario: A key used too often is slowed down
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone" 40 times within a minute
      Then the response status is 429

  Rule: The widget shows that person's data, like the Android widgets

    # unit: server/test/widget-keys.test.ts:answers with the key
    @unit
    Scenario: Only the key's person is seen
      Given "jo@example.com" has the calendar "Work"
      And "ann@example.com" has the calendar "Private"
      And the calendar "Work" has an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar "Private" has an event "Yoga" on 2026-10-14 from 07:00 to 08:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the iPhone widget shows the event "Dentist"
      And the iPhone widget does not show the event "Yoga"

    # unit: server/test/widget-keys.test.ts:answers with the key
    @unit
    Scenario: Hidden calendars stay off the widget
      Given "jo@example.com" has the calendar "Work" and the shared calendar "Anna"
      And the calendar "Anna" has an event "Yoga" on 2026-10-14 from 07:00 to 08:00
      And "jo@example.com" hid the calendar "Anna"
      And the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the iPhone widget does not show the event "Yoga"

    # unit: server/test/ios-widget.test.ts:the small widget shows the Day view
    @unit
    Scenario: The small widget shows the Day view
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "small" size
      Then the iPhone widget shows the event "Dentist" from 09:00 to 10:00
      And the iPhone widget shows the date 2026-10-14

    # unit: server/test/ios-widget.test.ts:the medium widget shows today and tomorrow
    @unit
    Scenario: The medium widget shows today and tomorrow
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-15 from 18:00 to 19:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "medium" size
      Then the iPhone widget shows the event "Dentist" from 09:00 to 10:00
      And the iPhone widget shows the date 2026-10-14
      And the iPhone widget shows "Tomorrow"
      And the iPhone widget shows the event "Gym"

    # unit: server/test/ios-widget.test.ts:says how many more entries do not fit
    @unit
    Scenario: The widget says how many more entries do not fit
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains 6 more events on 2026-10-14 after 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "small" size
      Then the iPhone widget shows the event "Dentist" from 09:00 to 10:00
      And the iPhone widget shows "+5 more"

    # unit: server/test/ios-widget.test.ts:shows the week of the Monday
    @unit
    Scenario: The large widget shows the Week view
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an all-day event "Holiday" on 2026-10-14
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "large" size
      Then the iPhone widget shows the week of 2026-10-12 with the event "Dentist" on 2026-10-14
      And the iPhone widget shows the event "Dentist" with its start time "09:00" on its own line above the title
      And the iPhone widget shows "all day"

    # unit: server/test/ios-widget.test.ts:inline says the next entry
    @unit
    Scenario: The inline lock-screen widget shows the next entry
      Given the time is 2026-10-14 08:00
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "lock screen inline" size
      Then the iPhone widget says "Dentist · 09:00"
      And the iPhone widget shows no clock

    # unit: server/test/ios-widget.test.ts:circular says the minutes
    @unit
    Scenario: The circular lock-screen widget shows the minutes until the next entry
      Given the time is 2026-10-14 08:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget says "in 40 min"
      And the iPhone widget shows no clock

    # unit: server/test/ios-widget.test.ts:circular says now in the last minute
    @unit
    Scenario: The circular widget says now in the last minute and the start time when the next entry is far away
      Given the time is 2026-10-14 08:59
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget says "now"
      Given the time is 2026-10-14 07:30
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget says "09:00"

    # unit: server/test/ios-widget.test.ts:rectangular says what is going on now
    @unit
    Scenario: The rectangular lock-screen widget says what is going on now and what is next
      Given the time is 2026-10-14 09:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-14 from 18:00 to 19:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "lock screen rectangle" size
      Then the iPhone widget says "Dentist · 40 min left"
      And the iPhone widget says "Next: Gym 18:00"
      And the iPhone widget shows no date line above the box
      And the iPhone widget shows no clock

    # unit: server/test/ios-widget.test.ts:opens the app at the day view of today
    @unit
    Scenario: Tapping the widget opens the app at that day
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When I tap the iPhone widget
      Then the iPhone widget opens the app at the day view of 2026-10-14

  Rule: The widget keeps working without a connection

    # unit: server/test/ios-widget.test.ts:without a connection shows its last answer
    @unit
    Scenario: Without a connection the widget shows its last answer and says how old it is
      Given the iPhone widget showed the event "Dentist" on 2026-10-14 at 09:00 at 2026-10-14 06:00
      And the time is 2026-10-14 08:00
      When the iPhone widget refreshes without a connection
      Then the iPhone widget shows the event "Dentist"
      And the iPhone widget says its data is from 06:00

    # unit: server/test/ios-widget.test.ts:says nothing about its age
    @unit
    Scenario: A fresh answer carries no age note
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the iPhone widget says nothing about its age

    # unit: server/test/ios-widget.test.ts:says it is waiting
    @unit
    Scenario: Before the first answer the widget says it is waiting
      When the iPhone widget refreshes without a connection and has no earlier answer
      Then the iPhone widget says "No data yet. Open the widget once with a connection."

  Rule: The widget asks iOS for its next redraw

    # unit: server/test/ios-widget.test.ts:asks to be redrawn
    @unit
    Scenario: The next redraw is asked for at the next change in the day
      Given the time is 2026-10-14 09:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the iPhone widget asks to be redrawn at 10:00
