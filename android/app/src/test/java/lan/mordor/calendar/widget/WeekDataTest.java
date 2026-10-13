package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.time.LocalDate;
import org.json.JSONArray;
import org.junit.Test;

/** The API path of {@link WeekData} must split events into days exactly like the web app's snapshot builder. */
public class WeekDataTest {
    private static final LocalDate MONDAY = LocalDate.parse("2026-10-12");
    private static final LocalDate TODAY = LocalDate.parse("2026-10-14");

    private static String event(String title, String start, String end, boolean allDay) {
        return "{\"kind\":\"event\",\"title\":\"" + title + "\",\"start\":\"" + start + "\",\"end\":\"" + end + "\",\"allDay\":" + allDay + ",\"color\":\"#1a73e8\"}";
    }

    private static WeekData parse(String... items) throws Exception {
        return WeekData.fromItems(new JSONArray("[" + String.join(",", items) + "]"), TODAY, MONDAY, 0);
    }

    @Test
    public void ordersADayAllDayFirstThenByTime() throws Exception {
        WeekData w = parse(event("Late", "2026-10-14T18:00:00+02:00", "2026-10-14T19:00:00+02:00", false),
                event("Early", "2026-10-14T09:15:00+02:00", "2026-10-14T10:00:00+02:00", false),
                event("Holiday", "2026-10-14", "2026-10-15", true));
        WeekData.Day wed = w.days.get(2);
        assertEquals(3, wed.events.size());
        assertEquals("Holiday", wed.events.get(0).title);
        assertTrue(wed.events.get(0).allDay);
        assertEquals("Early", wed.events.get(1).title);
        assertEquals("09:15", wed.events.get(1).start);
        assertEquals("10:00", wed.events.get(1).end);
        assertEquals("Late", wed.events.get(2).title);
    }

    @Test
    public void allDayEndIsExclusive() throws Exception {
        WeekData w = parse(event("Trip", "2026-10-16", "2026-10-19", true));
        for (int i = 0; i < 7; i++) assertEquals("day " + i, i >= 4 ? 1 : 0, w.days.get(i).events.size());
    }

    @Test
    public void overnightEventKeepsItsTimeOnTheFirstDayOnly() throws Exception {
        WeekData w = parse(event("Night", "2026-10-13T22:00:00+02:00", "2026-10-14T00:00:00+02:00", false),
                event("Long", "2026-10-14T22:00:00+02:00", "2026-10-15T02:00:00+02:00", false));
        assertEquals("24:00", w.days.get(1).events.get(0).end);
        assertEquals(0, w.days.get(1).events.size() - 1);
        assertEquals(1, w.days.get(2).events.size());
        assertEquals("22:00", w.days.get(2).events.get(0).start);
        assertEquals("24:00", w.days.get(2).events.get(0).end);
        assertNull(w.days.get(3).events.get(0).start);
        assertTrue(w.days.get(3).events.get(0).allDay);
    }

    @Test
    public void taskListsOfTodayGoToTheTaskRowNotTheColumns() throws Exception {
        WeekData w = parse("{\"kind\":\"tasklist\",\"title\":\"Groceries\",\"date\":\"2026-10-14\",\"doneCount\":2,\"totalCount\":5,\"color\":\"#0b8043\"}",
                "{\"kind\":\"tasklist\",\"title\":\"Tomorrow\",\"date\":\"2026-10-15\",\"doneCount\":0,\"totalCount\":3,\"color\":\"#0b8043\"}");
        assertEquals(1, w.tasks.size());
        assertEquals("Groceries", w.tasks.get(0).title);
        assertEquals(2, w.tasks.get(0).done);
        assertEquals(5, w.tasks.get(0).total);
        for (WeekData.Day d : w.days) assertEquals(0, d.events.size());
    }
}
