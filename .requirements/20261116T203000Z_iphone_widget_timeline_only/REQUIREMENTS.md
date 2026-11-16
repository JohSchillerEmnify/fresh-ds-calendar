# iPhone widget: Timeline only, labels as text, tap runs Scriptable (#95 reopened, #160)

## As Is
- `ios/widget/calendar-widget.js` draws small = today's list, medium = today + tomorrow, large = Monday week, or with the
  "Timeline" layout medium/large = 1–7 days from today as one `DrawContext` picture.
- In the picture, every day label except today's and the hour lines use `Color.dynamic`, which Scriptable does not
  support in `DrawContext` (https://docs.scriptable.app/color/): only today's label shows.
- The picture is fixed at 338 pt wide (the 390/393 pt iPhones in Apple's HIG table); other iPhones get a scaled picture.
- A tap opens `https://<server>/day/<date>`, which iOS sends to Safari; iOS cannot open an installed web app from a link
  (https://firt.dev/notes/pwa-ios/).
- Settings › Widgets › iPhone has a layout choice (Standard / Timeline).

## To Be
- Every home-screen size shows the Timeline: small = today as one column, medium and large = the chosen 1–7 days.
- Day labels and hours are `WidgetText` in stacks (they take `Color.dynamic`); only blocks, hour lines and the now-line
  are drawn into the picture, in fixed colours that read on light and dark.
- The picture size comes from Apple's widget size table keyed by `Device.screenSize()` (no API gives the real size:
  https://talk.automators.fm/t/any-way-for-widget-to-check-what-size-it-is/8812).
- A tap runs the widget in Scriptable (`scriptable:///run/Calendar`, https://docs.scriptable.app/urlscheme): fresh data,
  the manual refresh. No separate refresh target.
- The iPhone layout choice is gone from Settings; a stored choice is ignored; the server no longer sends it.
- Lock-screen widgets unchanged.

## Requirements and acceptance
Scenarios in `spec/features/app/iphone-widget.feature` (tagged `@backlog` until built), owner decisions on #160.

## Testing plan
- Unit (`server/test/ios-widget.test.ts`, fake Scriptable): every size draws the Timeline; day labels are `WidgetText`;
  no text drawn into the `DrawContext`; size table; tap URL; stored "standard" ignored.
- Unit (`server/test/widget-keys.test.ts`): data carries day count and no layout.
- e2e (mobile, targeted): Settings scenarios + the three `@visual` settings pictures (re-recorded after looking).
- Device check on an iPhone by a human: labels in light and dark, tap runs Scriptable, widget redraws afterwards.

## Implementation plan
1. Script: size table + Timeline in every size (red: size/stored-layout tests). 
2. Script: labels and hours as text around the picture, fixed picture colours (red: label/no-text tests).
3. Script: tap URL → `scriptable:///run/Calendar` (red: tap test). Bump `VERSION` so phones update themselves.
4. Server: drop `widgetLayout` from the widget data (red: widget-keys test).
5. Web: remove the iPhone layout row + its i18n strings; update the settings pictures. — PR boundary (one PR, `Fixes #95`, `Fixes #160`).

## Assumptions
1. The look follows the board option the owner picks (A filled or B tinted); built only after that pick.
2. iPhones missing from Apple's table (402 and 440 pt wide, iPhone 16 Pro / Pro Max) use the row of the nearest smaller
   screen width; unverified sizes.
3. Hour labels are text in a fixed-height column beside the picture; their rows line up with the drawn hour lines.
4. The stored `widgetLayout` preference stays in the prefs store (never overwritten) but is no longer read or sent.
5. Whether running the script in the app redraws the home-screen widget is unverified (no docs or reports either way);
   the device check decides whether the tap also needs `Script.setWidget` or a note.
