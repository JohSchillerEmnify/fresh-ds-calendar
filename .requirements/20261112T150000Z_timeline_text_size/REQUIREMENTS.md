# Timeline text size (issue #131)

## As Is
The Multi-day widget (Android) and the Timeline layout of the iPhone widget draw their texts at fixed sizes.

## To Be
One per-person setting `widgetTimelineTextSize` (90 to 150 %, steps of 5, default 110) in Settings > Widgets > "Timeline (iPhone and Android)" scales the texts of both.

## Requirements and acceptance
1. `shared/prefs.js` validates the pref; 85, 155, 112 and non-numbers are refused (`server/test/prefs.test.ts`).
2. Android: `/snapshot` `scrollTextPercent` (`web/test/widget-snapshot.test.ts`), read by `ScrollRows.choice` (unknown means 110), applied to day names, hour labels, entry texts, chips; row heights follow (`ScrollWidgetPictureTest`, `ScrollRowsTest`).
3. iPhone: `/api/widget/data` carries `widgetTimelineTextSize`; the script scales fonts, header, chip rows and still fits the hours in the height; VERSION 3 (`server/test/ios-widget.test.ts`, `widget-keys.test.ts`).
4. Settings slider (e2e scenario "The text size of the Timeline starts at 110 % and can be changed").

## Assumptions
- Default 110 % also applies to everyone with no choice (texts become 10 % larger than before).
- The week widget, the List widget and the iPhone week layout are unchanged.
- The hour gutter keeps its width; at 150 % the hour labels still fit.
