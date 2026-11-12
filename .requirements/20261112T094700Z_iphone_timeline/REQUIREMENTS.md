# iPhone widget Timeline (#108)

Spec: spec/features/app/iphone-widget.feature (Timeline scenarios). Built unattended; assumptions to review:

1. The day count lives in the iPhone section only (owner's words), not a shared setting.
2. A `widgetLayout` pref (standard | timeline, default standard) chooses the Timeline, so the existing week keeps working; `widgetTimelineDays` 1 to 7, default 3. Both are per-person prefs delivered in the widget data.
3. The Timeline applies to the medium and large widgets; small and the lock screen are unchanged.
4. The days row appears only with the Timeline chosen.
5. Widget script version raised to 2 so installed scripts update themselves.
6. Hours are fitted to the entries of the shown days (shared `hourRange`); columns thinner than 56 pt use one-letter day names.
