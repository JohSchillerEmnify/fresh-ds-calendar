@api @security @id:security-hardening
Feature: The server protects itself and its people from the web
  The calendar is reachable from the public internet, so the server does not trust what a browser or a stranger sends.
  Every answer tells the browser what the page may do, a write must come from the app itself and be plain JSON of a
  sensible size, a made-up cookie is simply "not signed in", and a server that would serve everybody without sign-in
  on a public address refuses to start. Nothing here changes what a signed-in person sees. See ADR 0026 for the
  secrets and spec/API.md ("Sign-in") for the exact answers.

  Rule: Every answer carries the browser security headers

    Scenario Outline: The security headers are on every kind of answer
      When I request "GET <path>"
      Then the response header "X-Frame-Options" is "DENY"
      And the response header "Referrer-Policy" is "strict-origin-when-cross-origin"
      And the response header "Permissions-Policy" is "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      And the response header "Content-Security-Policy" contains "default-src 'self'"
      And the response header "Content-Security-Policy" contains "frame-ancestors 'none'"
      And the response header "Content-Security-Policy" contains "object-src 'none'"

      Examples:
        | path        |
        | /api/health |
        | /api/nope   |
        | /index.html |

    Scenario: The page may run only its own scripts, and its one inline script by its fingerprint
      When I request "GET /index.html"
      Then the response header "Content-Security-Policy" contains "script-src 'self'"
      And the Content-Security-Policy allows the inline script of the page by its fingerprint

    # unit: server/test/security-headers.test.ts:allows exactly the place search and the map picture hosts besides the app itself
    @unit
    Scenario: The page may reach only the app, the place search and the map pictures
      Given the server is set up with the default place search and map picture services
      When I request "GET /index.html"
      Then the Content-Security-Policy lets the page reach outside only the place search and the map picture services

    # unit: server/test/places.test.ts:falls back to the default for
    @unit
    Scenario Outline: An unsafe place or map address in the settings falls back to the public service
      Given the operator set the place search address to <address>
      When the server starts
      Then the place search address is the public default

      Examples:
        | address                              |
        | "a plain http address"               |
        | "an address with a user name"        |
        | "an address that breaks out of the policy" |

  Rule: Only the app itself may write

    Scenario: A write that comes from a foreign website is refused
      When I send "POST /api/streak/checkin" with the header "origin" set to "http://evil.example"
      Then the response status is 403
      And the response JSON field "error.code" equals "FORBIDDEN"

    Scenario: A write that says its origin is "null" is refused
      When I send "PATCH /api/settings" with the header "origin" set to "null"
      Then the response status is 403

    Scenario: A write without an origin is accepted, as the Android widget sends it
      When I request "POST /api/streak/checkin"
      Then the response status is 200

    Scenario: Reading is never blocked by the origin
      When I send "GET /api/settings" with the header "origin" set to "http://evil.example"
      Then the response status is 200

    # unit: server/test/security.test.ts:a non-GET request without an allowed Origin gets 403
    @unit
    Scenario: With a public address configured, only that address and the extra allowed ones may write
      Given the server is set up with a public address and one other allowed address
      Then a write from the public address is accepted
      And a write from the other allowed address is accepted
      And a write from a foreign website is refused

  Rule: Only JSON of a sensible size is read

    Scenario Outline: A body that is not declared as JSON is refused
      When I send "PATCH /api/settings" with the body "sounds=false" as "<type>"
      Then the response status is 415
      And the response JSON field "error.code" equals "UNSUPPORTED_MEDIA_TYPE"

      Examples:
        | type                              |
        | text/plain                        |
        | application/x-www-form-urlencoded |

    # unit: server/test/security.test.ts:a bodyless write passes whatever its framing says
    @unit
    Scenario: A write without a body needs no type, also when it arrives chunked as from an iPhone
      When I send "POST /api/streak/checkin" with the header "transfer-encoding" set to "chunked"
      Then the response status is 200

    Scenario: JSON declared with a character set is accepted
      When I send "PATCH /api/settings" with the body '{"sounds":false}' as "application/json; charset=utf-8"
      Then the response status is 200

    Scenario: Broken JSON is a plain bad request
      When I send "POST /api/events" with the body "{nope" as "application/json"
      Then the response status is 400
      And the response JSON field "error.code" equals "VALIDATION_ERROR"

    Scenario: A body over 256 KB is refused
      When I send "POST /api/events" with a body of 300 kilobytes
      Then the response status is 413
      And the response JSON field "error.code" equals "PAYLOAD_TOO_LARGE"

    Scenario: A theme may be larger, up to 400 KB
      When I send "POST /api/themes" with a body of 300 kilobytes
      Then the response status is not 413
      When I send "POST /api/themes" with a body of 500 kilobytes
      Then the response status is 413

  Rule: A made-up cookie is simply not signed in

    Scenario Outline: A cookie value that is a word of the programming language is not an error
      Given "jo@example.com" may use the calendar
      When I request "GET /api/auth/me" with the cookie "cal_session=<value>"
      Then the response status is 401
      When I request "GET /api/items" with the cookie "cal_session=<value>"
      Then the response status is 401

      Examples:
        | value          |
        | constructor    |
        | __proto__      |
        | toString       |
        | hasOwnProperty |
        | valueOf        |

  Rule: A server without sign-in does not start on a public address

    # unit: server/test/security.test.ts:mock mode refuses to start with an https PUBLIC_URL
    # unit: server/test/security.test.ts:mock mode refuses to start in production, and a missing PROVIDER counts as mock
    @unit
    Scenario Outline: The demo refuses to start where everybody could reach it
      Given the server runs as the demo, without Google sign-in
      And the server is set up for <setup>
      When the server starts
      Then it refuses to start
      And it tells the operator to turn on Google sign-in or to run open on purpose

      Examples:
        | setup                   |
        | "an https public address" |
        | "production mode"       |

    # unit: server/test/security.test.ts:starts when asked to, on http, in development, or with Google
    @unit
    Scenario: The demo starts when the operator allows it on purpose
      Given the server runs as the demo, without Google sign-in
      And the server is set up for "an https public address"
      And the operator allows running open on purpose
      When the server starts
      Then it starts

    # unit: server/test/security.test.ts:starts when asked to, on http, in development, or with Google
    @unit
    Scenario Outline: The demo starts at home without any override
      Given the server runs as the demo, without Google sign-in
      And the server is set up for <setup>
      When the server starts
      Then it starts

      Examples:
        | setup                     |
        | "a local http address"    |
        | "development mode"        |
        | "no address at all"       |
