# Automatic hours (#133, #113)
Android Multi-day: Automatic (WeekLayout.hourRange of the days shown, port of shared/weekHours.js) | Fixed (slider 4-24, default 16).
iPhone Timeline: Automatic (default) | Fixed range From/To; entries outside get an edge marker.
Prefs per person (shared/prefs.js): androidWidgetHours 4-24, androidWidgetHoursMode (default fixed), widgetTimelineHours {mode, from, to} (default auto).
Assumptions: Android Automatic = window of exactly the range, list opens at its first hour, rest of the day scrolls (the now-30 rule is clamped into the range); a fixed range rounds From down and To up to whole hours; one marker per edge with "+n"; mockup text not readable by the agent, hints written from the brief.
