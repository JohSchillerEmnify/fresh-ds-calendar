package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.time.LocalDate;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** The scrolling widget's Agenda rows and the choice read from the app's copy (feature scrolling-widget). */
public class ScrollRowsTest {
    private static final LocalDate TODAY = LocalDate.parse("2026-10-14"), MONDAY = LocalDate.parse("2026-10-12");
    private static final WidgetStrings EN = new WidgetStrings("en");

    private static String ev(String title, String date, String from, String to) {
        return "{\"kind\":\"event\",\"id\":\"" + title + "\",\"title\":\"" + title + "\",\"start\":\"" + date + "T" + from + ":00+02:00\",\"end\":\"" + date + "T" + to
                + ":00+02:00\",\"allDay\":false,\"color\":\"#039be5\"}";
    }

    private static String allDay(String title, String date, String endExclusive) {
        return "{\"kind\":\"event\",\"id\":\"" + title + "\",\"title\":\"" + title + "\",\"start\":\"" + date + "\",\"end\":\"" + endExclusive + "\",\"allDay\":true,\"color\":\"#8e24aa\"}";
    }

    private static WeekData data(LocalDate today, String... items) throws Exception {
        LocalDate from = today.minusDays(today.getDayOfWeek().getValue() - 1);
        int span = (int) java.time.temporal.ChronoUnit.DAYS.between(from, today) + ScrollRows.DAYS;
        return WeekData.fromItems(new JSONArray("[" + String.join(",", items) + "]"), today, from, 0, true, span);
    }

    private static String titles(List<ScrollRows.Row> rows) {
        StringBuilder sb = new StringBuilder();
        for (ScrollRows.Row r : rows) sb.append(r.header ? "#" : "").append(r.title).append(r.time.isEmpty() ? "" : "@" + r.time).append(r.count.isEmpty() ? "" : "[" + r.count + "]").append("|");
        return sb.toString();
    }

    @Test
    public void agendaListsTodayAndComingDaysUnderHeaders() throws Exception {
        List<ScrollRows.Row> rows = ScrollRows.agenda(data(TODAY, ev("Dentist", "2026-10-14", "09:00", "10:00"), ev("Yoga", "2026-10-16", "07:00", "08:00")), TODAY, EN, false);
        assertEquals("#Wed 14 Oct|Dentist@09:00|#Fri 16 Oct|Yoga@07:00|", titles(rows));
        assertTrue(rows.get(0).today);
    }

    @Test
    public void agendaNamesAnUntitledTaskListByItsFirstItem() throws Exception {
        String list = "{\"kind\":\"tasklist\",\"id\":\"u\",\"title\":\"\",\"date\":\"2026-10-14\",\"time\":null,\"doneCount\":0,\"totalCount\":1,\"color\":\"#0b8043\","
                + "\"items\":[{\"title\":\"Milk\",\"done\":false}]}";
        assertEquals("#Wed 14 Oct|Milk[0/1]|", titles(ScrollRows.agenda(data(TODAY, list), TODAY, EN, false)));
    }

    @Test
    public void agendaShowsAllDayFirstAndSkipsEmptyDays() throws Exception {
        List<ScrollRows.Row> rows = ScrollRows.agenda(data(TODAY, ev("Dentist", "2026-10-14", "09:00", "10:00"), allDay("Holiday", "2026-10-14", "2026-10-15")), TODAY, EN, false);
        assertEquals("#Wed 14 Oct|Holiday@All day|Dentist@09:00|", titles(rows));
    }

    @Test
    public void agendaShowsATaskListWithItsCount() throws Exception {
        String list = "{\"kind\":\"tasklist\",\"id\":\"l\",\"title\":\"Groceries\",\"date\":\"2026-10-14\",\"doneCount\":1,\"totalCount\":3,\"color\":\"#0b8043\","
                + "\"items\":[{\"title\":\"Milk\",\"done\":true},{\"title\":\"Eggs\",\"done\":false},{\"title\":\"Bread\",\"done\":false}]}";
        assertEquals("#Wed 14 Oct|Groceries[1/3]|", titles(ScrollRows.agenda(data(TODAY, list), TODAY, EN, false)));
    }

    @Test
    public void reachesFourteenDaysAhead() throws Exception {
        List<ScrollRows.Row> rows = ScrollRows.agenda(data(TODAY, ev("Far", "2026-10-27", "09:00", "10:00"), ev("Too far", "2026-10-28", "09:00", "10:00")), TODAY, EN, false);
        assertEquals("#Tue 27 Oct|Far@09:00|", titles(rows));
    }

    @Test
    public void narrowAgendaDropsTheTimes() throws Exception {
        assertEquals("#Wed 14 Oct|Dentist|", titles(ScrollRows.agenda(data(TODAY, ev("Dentist", "2026-10-14", "09:00", "10:00")), TODAY, EN, true)));
    }

    @Test
    public void aNewDayMovesTheListOn() throws Exception {
        LocalDate next = TODAY.plusDays(1);
        WeekData d = data(next, ev("Dentist", "2026-10-14", "09:00", "10:00"), ev("Yoga", "2026-10-15", "07:00", "08:00"));
        assertEquals("#Thu 15 Oct|Yoga@07:00|", titles(ScrollRows.agenda(d, next, EN, false)));
    }

    @Test
    public void anEmptyAgendaSaysSo() throws Exception {
        assertTrue(ScrollRows.agenda(data(TODAY), TODAY, EN, false).isEmpty());
        assertEquals("Nothing planned", EN.nothingPlanned());
        assertEquals("Nichts geplant", new WidgetStrings("de").nothingPlanned());
    }

    @Test
    public void anEntryOpensItsDayAndAHeaderOpensThatDay() throws Exception {
        List<ScrollRows.Row> rows = ScrollRows.agenda(data(TODAY, ev("Yoga", "2026-10-16", "07:00", "08:00")), TODAY, EN, false);
        assertEquals("/day/2026-10-16", rows.get(0).path());
        assertEquals("/day/2026-10-16", rows.get(1).path());
    }

    @Test
    public void fallsBackToThreeDaysAndSixteenHours() throws Exception {
        assertEquals(3, ScrollRows.choice(null).days);
        assertEquals(16, ScrollRows.choice(null).hours);
        assertEquals(16, ScrollRows.choice(new JSONObject("{}")).hours);
        ScrollRows.Choice odd = ScrollRows.choice(new JSONObject("{\"scrollHours\":10,\"scrollDays\":9}"));
        assertEquals(3, odd.days);
        assertEquals(16, odd.hours);
        ScrollRows.Choice set = ScrollRows.choice(new JSONObject("{\"scrollHours\":8,\"scrollDays\":5}"));
        assertEquals(5, set.days);
        assertEquals(8, set.hours);
        for (int h : new int[] {8, 12, 16, 24}) assertEquals(h, ScrollRows.choice(new JSONObject("{\"scrollHours\":" + h + "}")).hours);
    }

    @Test
    public void germanDayHeadersReadLikeTheApp() {
        assertEquals("Mi 14. Okt", new WidgetStrings("de").agendaDay(TODAY));
        assertEquals("Mo 12. Okt", new WidgetStrings("de-x-coldmirror").agendaDay(MONDAY));
    }
}
