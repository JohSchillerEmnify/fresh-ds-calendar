# 0045 — The error log may be sent to the server: per person, by tap or by an opt-in pref

- Status: accepted
- Views shaped: `server`, `web`, `android`
- Extends: [0009](0009-diagnostics-client-beacon.md)

## Context

"Fresh-D keeps stopping" on Android could not be diagnosed: nobody could get a stack trace off the phone, and the device
error log (feature device-log) could only be copied, shared or downloaded. ADR 0009 allows only logging, with whitelisted
fields; nothing the person sent was kept.

## Decision

- `POST /api/diag/device-log` stores the person's device error log as one of their **last 5 uploads** in their own server
  folder (`device-log-uploads.json`), never in Google. At most one upload per person per minute, 256 KB at most, a strict
  shape (known entry fields, text values at most 400 characters). The server writes one log line (`client_device_log`:
  person pseudonym, entry and crash counts, app version) and no entry text, so the maintainer finds the upload with the
  server logs and reads the file.
- The entries are the ones the device log already holds: scrubbed of titles, texts, e-mail addresses and tokens. Crash
  entries from the Android app carry only the exception class, the causes' classes and stack frames, never a message.
- Uploading is the person's action: the **Send to server** button, or the per-person pref `sendReportsAuto`, which is off
  and never switched on by the app. With it on, the app sends the entries the server does not have yet at start and when
  it returns to the foreground. Offline the log stays on the device (device-first) and the next try sends it.

## Alternatives

- **A crash service (Sentry or Crashlytics):** a third party would receive the data and the app would need an SDK and a
  consent flow; the maintainer wants a stack trace, not a dashboard.
- **Upload without a per-person store (log line only):** a log line cannot carry a stack trace within ADR 0009's field rules.
- **Automatic sending on by default:** rejected by the owner; it is a choice the person makes.
