package lan.mordor.calendar.widget;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** The few texts of the widget, in the language the app uses (taken from the snapshot, not from the device). */
final class WidgetStrings {
    private static final String[] EN_DAYS = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
    private static final String[] DE_DAYS = {"Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"};

    private final boolean german;

    /** @param language the app's language code: {@code en}, {@code de}, {@code de-x-mainfr} or {@code de-x-coldmirror} */
    WidgetStrings(String language) {
        german = language != null && language.startsWith("de");
    }

    /** The language code of the device, for a widget without snapshot. */
    static String deviceLanguage() {
        return Locale.getDefault().getLanguage();
    }

    String updated() {
        return german ? "Stand" : "Updated";
    }

    String openOnce() {
        return german ? "Öffne die App einmal, um deine Woche zu laden" : "Open the app once to load your week";
    }

    String signInAgain() {
        return german ? "Öffne die App, um dich neu anzumelden" : "Open the app to sign in again";
    }

    String tasks() {
        return german ? "Aufgaben" : "Tasks";
    }

    String untitled() {
        return german ? "Ohne Titel" : "Untitled";
    }

    /** Short weekday label, Monday first (fixed forms, like the web app's). */
    String weekday(LocalDate d) {
        DayOfWeek w = d.getDayOfWeek();
        return (german ? DE_DAYS : EN_DAYS)[w.getValue() - 1];
    }

    /** The week's range for the header: {@code 12–18 Oct} or {@code 28 Sep – 4 Oct}. */
    String weekRange(LocalDate monday) {
        LocalDate sunday = monday.plusDays(6);
        DateTimeFormatter dm = DateTimeFormatter.ofPattern(german ? "d. MMM" : "d MMM", german ? Locale.GERMANY : Locale.UK);
        if (monday.getMonth() == sunday.getMonth()) return monday.getDayOfMonth() + (german ? ".–" : "–") + dm.format(sunday);
        return dm.format(monday) + " – " + dm.format(sunday);
    }
}
