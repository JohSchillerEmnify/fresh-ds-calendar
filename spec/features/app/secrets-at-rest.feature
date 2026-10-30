@secrets @id:secrets-at-rest
Feature: Secrets kept on the server are not readable from its files
  Whoever gets a copy of the server's data folder must not get a way into anybody's Google account or calendar.
  The Google connection of each person is stored encrypted with a key the operator keeps outside the data folder, and
  sign-in sessions are stored only as fingerprints of the cookie value. A connection that can no longer be read means
  "sign in with Google again", never a crash. A real Google server will not start without a valid key. A sign-in
  session also has a lifetime: 90 days without use, and 180 days at the very most however often it is used. See
  ADR 0026.

  # These scenarios describe behaviour that is built. They are about the server's files and its start, which the browser
  # suite cannot reach, so each is tagged @unit and names the unit test that covers it.

  Rule: The stored Google connection is encrypted

    # unit: server/test/secretBox.test.ts:writes an envelope without the plaintext token when a key is set
    @unit
    Scenario: A person's Google connection is stored encrypted
      Given the server has a valid encryption key
      When "jo@example.com" signs in with Google
      Then the stored Google connection of "jo@example.com" does not contain the connection in readable form
      And the stored Google connection of "jo@example.com" can be read by the server's own user only
      And "jo@example.com" is connected to Google

    # unit: server/test/secretBox.test.ts:re-writes a legacy plaintext file encrypted on first read
    @unit
    Scenario: A connection stored unencrypted is converted without signing in again
      Given "jo@example.com" has a Google connection stored unencrypted from before
      And the server has a valid encryption key
      When the server next uses the Google connection of "jo@example.com"
      Then the stored Google connection of "jo@example.com" does not contain the connection in readable form
      And "jo@example.com" is connected to Google
      And "jo@example.com" is not asked to sign in again

    # unit: server/test/secretBox.test.ts:treats a wrong key or a tampered file as not connected, without throwing
    # unit: server/test/secretBox.test.ts:an envelope without any key is not connected
    @unit
    Scenario Outline: A connection that cannot be read means signing in again, not a crash
      Given the server has a valid encryption key
      And "jo@example.com" has a Google connection stored encrypted
      When the stored Google connection of "jo@example.com" is <fault>
      Then the server keeps running
      And "jo@example.com" is not connected to Google
      And "jo@example.com" is asked to sign in with Google again

      Examples:
        | fault                                      |
        | "damaged"                                  |
        | "encrypted with another key"               |
        | "encrypted but the server has lost its key" |

    # unit: server/test/secretBox.test.ts:writes an envelope without the plaintext token when a key is set
    @unit
    Scenario: Signing in again after an unreadable connection stores a fresh encrypted one
      Given the server has a valid encryption key
      And "jo@example.com" has a Google connection stored encrypted
      And the stored Google connection of "jo@example.com" is "damaged"
      When "jo@example.com" signs in with Google
      Then "jo@example.com" is connected to Google
      And the stored Google connection of "jo@example.com" does not contain the connection in readable form

  Rule: A real Google server does not start without a valid key

    # unit: server/test/secretBox.test.ts:refuses google without a valid key unless TEST_MODE
    @unit
    Scenario Outline: A server for real Google refuses to start without a valid key
      Given the server is set up for real Google sign-in
      And the encryption key is <key>
      When the server starts
      Then it refuses to start
      And it tells the operator that the encryption key must be 32 bytes in base64

      Examples:
        | key                       |
        | "missing"                 |
        | "too short"               |

    # unit: server/test/secretBox.test.ts:refuses google without a valid key unless TEST_MODE
    @unit
    Scenario: A server for real Google starts with a valid key
      Given the server is set up for real Google sign-in
      And the encryption key is "32 bytes in base64"
      When the server starts
      Then it starts

  Rule: Sessions are stored only as fingerprints

    # unit: server/test/hardening-sessions.test.ts:stores only sha256(id) as the key, read back after a restart
    @unit
    Scenario: The stored sessions do not contain the cookie value
      Given "jo@example.com" is signed in
      Then the stored sessions hold a fingerprint of the sign-in cookie and not the cookie value itself
      When the server restarts
      Then "jo@example.com" is still signed in

    # unit: server/test/hardening-sessions.test.ts:hashes legacy raw-id entries in place, so nobody is signed out
    @unit
    Scenario: A session stored in the old readable form is converted without signing anybody out
      Given "jo@example.com" has a session stored in the old readable form
      When the server starts
      Then the stored sessions hold a fingerprint of the sign-in cookie and not the cookie value itself
      And "jo@example.com" is still signed in

  Rule: A session ends after 90 days without use, and after 180 days at the latest

    # unit: server/test/auth.test.ts:expires after 90 days and is deleted on sign-out
    @unit
    Scenario: A session that is not used for 90 days ends
      Given the time is 2026-01-01 09:00
      And "jo@example.com" is signed in
      When the time is 2026-04-02 09:00
      And they open the week view for 2026-03-30
      Then they see the sign-in page

    # unit: server/test/auth.test.ts:extends on use at most once an hour
    @unit
    Scenario: Using the calendar keeps a session going
      Given the time is 2026-01-01 09:00
      And "jo@example.com" is signed in
      When the time is 2026-03-30 09:00
      And they open the week view for 2026-03-30
      And the time is 2026-06-20 09:00
      And they open the week view for 2026-06-15
      Then they see the week view for 2026-06-15

    # unit: server/test/hardening-sessions.test.ts:ends a session at the absolute cap even when it is used every day
    @unit
    Scenario: A session that is used every month still ends after 180 days
      Given the time is 2026-01-01 09:00
      And "jo@example.com" is signed in
      And the time is 2026-03-30 09:00
      And they open the week view for 2026-03-30
      And the time is 2026-06-20 09:00
      And they open the week view for 2026-06-15
      When the time is 2026-07-02 09:00
      And they open the week view for 2026-06-29
      Then they see the sign-in page
