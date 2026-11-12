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
  The home screen has today (small), today and tomorrow side by side (medium) and the Week as a time grid (large); the size
  picks the view. Small and medium share one row style: a compact bold header ("WED 14"; "TODAY · WED 14" and
  "TOMORROW · THU 15" on medium, with a thin divider), an all-day band, one row per entry in its calendar colour with the
  start in bold and then the title, and "+N more" when it overflows. There is no big date and no time strip there: a
  widget cannot scroll, so a full day does not fit. Large draws the days across the top, an all-day band, an hour scale and
  a block per entry placed by its start and as tall as it lasts, with a red line for now.
  The lock screen has the accessory families inline and rectangular; the circular one shows the next start time (the default) or, if the person chooses it in Settings, a live countdown that iOS updates by itself and that may lag a few minutes behind. The widget draws
  no clock of its own, because iOS shows its clock on the lock screen,, and no date line above the box, because
  it shows it itself. Inline and rectangular show start times and titles only, which do not go stale.
  An iPhone widget is a fixed picture: it cannot scroll or page, and Scriptable widgets have no buttons.
  The iPhone section of Settings › Widgets also offers a layout: Standard (as above) or Timeline. With the Timeline the
  medium and large widgets draw the next days as columns from today, hours from top to bottom, as many days as the person
  picks (1 to 7, default 3). The hours are fitted to the entries of those days, because the widget cannot scroll. The
  small widget and the lock screen do not change. The layout belongs to the iPhone section; the day count is one setting in
  its own section "Timeline (iPhone and Android)" of Widgets settings, shared with the Android List widget's Timeline, and a day
  count chosen earlier for the Android widget carries over until one is chosen there. Both are per person.

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  Rule: A person sets the widget up from Settings in a few taps

    Scenario: A widget key is created for this phone and the installer is ready to copy
      When I open the iPhone widget settings
      And I create a widget key named "My iPhone"
      Then the settings show the widget key "My iPhone"
      And the new widget key is shown once with the buttons "Copy installer" and "Open Scriptable"

    Scenario: The setup offers a link to get Scriptable
      When I open the iPhone widget settings
      And I create a widget key named "My iPhone"
      Then the setup offers a link to get Scriptable

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

    Scenario: The setup guide is in German
      Given the browser language is "de-DE"
      When I open the iPhone widget settings
      And I create a widget key named "Mein iPhone"
      Then the setup says "Dein Kalender auf dem Home-Bildschirm und dem Sperrbildschirm deines iPhones."
      And the setup guide step 1 says "Installiere die kostenlose App Scriptable:" and expects "Danach kommst du hierher zurück."
      And the setup guide step 2 says "Installer kopieren" and has no hint
      And the setup guide step 5 says "Tippe unten rechts auf ▶. Wenn „Installiert“ erscheint, schließe Scriptable." and has no hint
      And the setup guide step 6 says "Halte auf dem Home-Bildschirm eine freie Stelle gedrückt. Tippe auf „Bearbeiten › Widget hinzufügen“, suche nach Scriptable, wähle eine Größe und tippe auf „Widget hinzufügen“." and has no hint
      And the setup says "Der Installer funktioniert nur für dieses iPhone und wird nur einmal angezeigt."

    Scenario: Copying the installer is confirmed on the button
      Given I created a widget key named "My iPhone"
      When I copy the widget installer
      Then the button "Copy installer" now says "Copied ✓"

    Scenario: The settings say when the widget is connected
      Given I created a widget key named "My iPhone"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the setup guide shows "Widget connected ✓" for the widget key "My iPhone"

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

    Scenario: The lock screen circle can show the start time or a countdown
      When I open the iPhone widget settings
      Then the lock screen circle is set to "Start time"
      And the lock screen circle row says "Countdown may lag a few minutes behind."
      When I set the lock screen circle to "Countdown"
      Then the lock screen circle is set to "Countdown"

    Scenario: The layout is set in the iPhone section and the number of days in the Timeline section
      When I open the iPhone widget settings
      Then the iPhone widget layout is set to "Standard"
      When I set the iPhone widget layout to "Timeline"
      Then the iPhone widget layout is set to "Timeline"
      And the timeline days are set to "3"
      When I set the timeline days to "5"
      Then the timeline days are set to "5"

    @visual
    Scenario: The iPhone section with the Timeline chosen looks right in the light theme
      When I open the iPhone widget settings
      And I set the iPhone widget layout to "Timeline"
      And I set the timeline days to "5"
      Then the "settings page" still looks like "settings-iphone-timeline-light"

    @visual
    Scenario: The iPhone section with the Timeline chosen looks right in the dark theme
      Given the device prefers a dark color scheme
      When I open the iPhone widget settings
      And I set the iPhone widget layout to "Timeline"
      And I set the timeline days to "2"
      Then the "settings page" still looks like "settings-iphone-timeline-dark"

    Scenario: The key is not shown again later
      Given I created a widget key named "My iPhone"
      When I open the iPhone widget settings again
      Then the settings show the widget key "My iPhone"
      And the settings do not show the widget key itself

  Rule: Keys are listed, revocable and one person's only

    Scenario: The list shows the device name and the last use
      Given the widget key "My iPhone" was last used on 2026-10-13 at 18:30
      And the widget key "Old phone" was never used
      When I open the iPhone widget settings
      Then the settings show the widget key "My iPhone" last used on 2026-10-13 at 18:30
      And the settings show the widget key "Old phone" as never used

    # unit: server/test/widget-keys.test.ts:for a removed key and
    # unit: server/test/ios-widget.test.ts:says the key was removed, drops the cached answer
    @unit
    Scenario: A revoked key stops working and the widget says so
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When I revoke the widget key "My iPhone"
      And the iPhone widget refreshes with the key "My iPhone"
      Then the widget data request is refused as "revoked"
      And the iPhone widget shows "This widget was removed in the app. Add it again in Settings."
      And the iPhone widget keeps no calendar data

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

    # unit: server/test/ios-widget.test.ts:draws its texts in German
    @unit
    Scenario: The widget speaks German when the app language is German
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-15 from 18:00 to 19:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      And the app language is chosen as "de"
      When I look at the iPhone widget in the "medium" size
      Then the iPhone widget shows "HEUTE · MI 14"
      And the iPhone widget shows "MORGEN · DO 15"

    # unit: server/test/ios-widget.test.ts:follows the iPhone when the app language is auto
    @unit
    Scenario: With the app language on automatic the widget follows the iPhone
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      And the app language is chosen as "auto"
      When I look at the iPhone widget in the "small" size on an iPhone set to "de-DE"
      Then the iPhone widget shows "MI 14"

    # unit: server/test/widget-keys.test.ts:carries the app language
    @unit
    Scenario: The widget data carries the app language
      Given the widget key "My iPhone" belongs to "jo@example.com"
      And the app language is chosen as "de"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the widget data carries the app language "de"

    # unit: server/test/ios-widget.test.ts:the small widget shows today in one compact header
    @unit
    Scenario: The small widget shows today
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "small" size
      Then the iPhone widget shows "WED 14"
      And the iPhone widget shows the entry "Dentist" with its start "09:00"

    # unit: server/test/ios-widget.test.ts:the medium widget shows today and tomorrow
    @unit
    Scenario: The medium widget shows today and tomorrow as two identical columns
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-15 from 18:00 to 19:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "medium" size
      Then the iPhone widget shows "TODAY · WED 14"
      And the iPhone widget shows the entry "Dentist" with its start "09:00"
      And the iPhone widget shows "TOMORROW · THU 15"
      And the iPhone widget shows the entry "Gym" with its start "18:00"

    # unit: server/test/ios-widget.test.ts:says how many more entries do not fit
    @unit
    Scenario: The widget says how many more entries do not fit
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains 8 more events on 2026-10-14 after 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "small" size
      Then the iPhone widget shows the entry "Dentist" with its start "09:00"
      And the iPhone widget shows "+3 more"

    # unit: server/test/ios-widget.test.ts:the week grid places
    @unit
    Scenario: The large widget shows the Week as a time grid
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-14 from 18:00 to 19:00
      And the calendar contains an all-day event "Holiday" on 2026-10-14
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "large" size
      Then the iPhone widget shows the week of 2026-10-12 with the event "Dentist" on 2026-10-14
      And the iPhone widget places the event "Dentist" in the week grid from 09:00 to 10:00
      And the iPhone widget shows "Holiday" in the all-day band
      And the iPhone widget shows the hours from 09:00 to 19:00

    # unit: server/test/ios-widget.test.ts:the week grid draws the red now-line
    @unit
    Scenario: The week grid has a red line for now in today's column
      Given the time is 2026-10-14 09:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "large" size
      Then the iPhone widget draws a red now-line at 09:20 in today's column

    # unit: server/test/ios-widget.test.ts:the week hours follow the Android rule
    @unit
    Scenario: The week grid shows all timed entries within hours picked like the Android week widget
      Given the time is 2026-10-14 08:00
      And the calendar contains an event "Early" on 2026-10-14 from 06:00 to 07:00
      And the calendar contains an event "Late" on 2026-10-14 from 19:00 to 20:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "large" size
      Then the iPhone widget shows the hours from 06:00 to 20:00
      And the iPhone widget places the event "Late" in the week grid from 19:00 to 20:00

    # unit: server/test/ios-widget.test.ts:the timeline shows the chosen days
    @unit
    Scenario: The medium widget can show the Timeline of the next days from today
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-15 from 18:00 to 19:00
      And the calendar contains an event "Dinner" on 2026-10-17 from 19:00 to 21:00
      And the iPhone widget layout is chosen as "timeline"
      And the timeline days are chosen as 3
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "medium" size
      Then the iPhone widget shows the timeline of 3 days from 2026-10-14
      And the iPhone widget places the event "Dentist" in the timeline from 09:00 to 10:00
      And the iPhone widget places the event "Gym" in the timeline from 18:00 to 19:00
      And the iPhone widget does not show the event "Dinner"

    # unit: server/test/ios-widget.test.ts:the timeline defaults to three days
    @unit
    Scenario: The Timeline shows three days unless the person picks another number
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the iPhone widget layout is chosen as "timeline"
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "large" size
      Then the iPhone widget shows the timeline of 3 days from 2026-10-14

    # unit: server/test/ios-widget.test.ts:the timeline hours follow the days shown
    @unit
    Scenario: The Timeline fits its hours to the entries of the days shown
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-14 from 18:00 to 19:00
      And the calendar contains an event "Night" on 2026-10-17 from 22:00 to 23:00
      And the iPhone widget layout is chosen as "timeline"
      And the timeline days are chosen as 2
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "large" size
      Then the iPhone widget shows the hours from 09:00 to 19:00

    # unit: server/test/ios-widget.test.ts:the timeline runs up to seven days
    @unit
    Scenario: The Timeline can show a whole week from today
      Given the calendar contains an event "Review" on 2026-10-20 from 14:00 to 15:00
      And the iPhone widget layout is chosen as "timeline"
      And the timeline days are chosen as 7
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "large" size
      Then the iPhone widget shows the timeline of 7 days from 2026-10-14
      And the iPhone widget places the event "Review" in the timeline from 14:00 to 15:00

    # unit: server/test/ios-widget.test.ts:the timeline draws the red now-line
    @unit
    Scenario: The Timeline has a red line for now in today's column
      Given the time is 2026-10-14 09:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the iPhone widget layout is chosen as "timeline"
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "medium" size
      Then the iPhone widget draws a red now-line at 09:20 in today's column

    # unit: server/test/ios-widget.test.ts:the small widget stays
    @unit
    Scenario: The Timeline does not change the small widget
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the iPhone widget layout is chosen as "timeline"
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "small" size
      Then the iPhone widget shows "WED 14"
      And the iPhone widget shows the entry "Dentist" with its start "09:00"

    # unit: server/test/ios-widget.test.ts:inline says the next entry
    @unit
    Scenario: The inline lock-screen widget shows the next entry
      Given the time is 2026-10-14 08:00
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "lock screen inline" size
      Then the iPhone widget says "Dentist · 09:00"
      And the iPhone widget shows no clock

    # unit: server/test/ios-widget.test.ts:circular shows the next start time by default
    @unit
    Scenario: The circular lock-screen widget shows the next start time by default
      Given the time is 2026-10-14 08:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget says "09:00"
      And the iPhone widget shows no clock

    # unit: server/test/ios-widget.test.ts:circular countdown counts down live
    @unit
    Scenario: The countdown circle counts down to the next entry
      Given the time is 2026-10-14 08:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      And the lock screen circle is chosen as "countdown"
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget counts down live to 09:00
      And the iPhone widget shows no clock

    # unit: server/test/ios-widget.test.ts:circular countdown says now in the last minute
    @unit
    Scenario: The countdown circle says now in the last minute and then moves on
      Given the time is 2026-10-14 08:59
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-14 from 18:00 to 19:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      And the lock screen circle is chosen as "countdown"
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget says "now"
      Given the time is 2026-10-14 09:02
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget says "18:00"

    # unit: server/test/ios-widget.test.ts:circular countdown shows the start time when far away
    @unit
    Scenario: The countdown circle shows the start time when the next entry is more than an hour away
      Given the time is 2026-10-14 07:30
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      And the lock screen circle is chosen as "countdown"
      When I look at the iPhone widget in the "lock screen circle" size
      Then the iPhone widget says "09:00"

    # unit: server/test/widget-keys.test.ts:carries the lock screen circle setting
    @unit
    Scenario: The widget data carries the lock screen circle setting
      Given the widget key "My iPhone" belongs to "jo@example.com"
      And the lock screen circle is chosen as "countdown"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the widget data carries the lock screen circle "countdown"

    # unit: server/test/widget-keys.test.ts:carries the layout and the timeline days
    @unit
    Scenario: The widget data carries the layout and the number of timeline days
      Given the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the widget data carries the iPhone widget layout "standard" and 3 timeline days
      Given the iPhone widget layout is chosen as "timeline"
      And the timeline days are chosen as 5
      When the iPhone widget refreshes with the key "My iPhone"
      Then the widget data carries the iPhone widget layout "timeline" and 5 timeline days

    # unit: server/test/widget-keys.test.ts:falls back to the earlier Android day count
    @unit
    Scenario: A day count chosen earlier for the Android widget carries over
      Given the earlier Android day count was 5
      And the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the widget data carries the iPhone widget layout "standard" and 5 timeline days
      Given the timeline days are chosen as 2
      When the iPhone widget refreshes with the key "My iPhone"
      Then the widget data carries the iPhone widget layout "standard" and 2 timeline days

    # unit: web/test/widget-snapshot.test.ts:carries the next 14 days
    @unit
    Scenario: The Android widget uses the same day count
      Given the timeline days are chosen as 4
      Then the Android widget snapshot carries 4 timeline days

    # unit: server/test/prefs.test.ts:timeline days
    @unit
    Scenario: A number of timeline days outside 1 to 7 is refused
      Then setting the timeline days to 0 is refused
      And setting the timeline days to 8 is refused

    # unit: server/test/ios-widget.test.ts:rectangular says what is going on now
    @unit
    Scenario: The rectangular lock-screen widget says what is going on now and what is next
      Given the time is 2026-10-14 09:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Gym" on 2026-10-14 from 18:00 to 19:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When I look at the iPhone widget in the "lock screen rectangle" size
      Then the iPhone widget says "Dentist · until 10:00"
      And the iPhone widget says "After: Gym 18:00"
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
      Then the iPhone widget says "No data yet. The widget loads it as soon as your iPhone is online."

  Rule: The widget asks iOS for its next redraw

    # unit: server/test/ios-widget.test.ts:asks to be redrawn
    @unit
    Scenario: The next redraw is asked for at the next change in the day
      Given the time is 2026-10-14 09:20
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
      And the widget key "My iPhone" belongs to "jo@example.com"
      When the iPhone widget refreshes with the key "My iPhone"
      Then the iPhone widget asks to be redrawn at 10:00
