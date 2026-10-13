package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.time.LocalDate;
import org.json.JSONArray;
import org.junit.Test;

/** The API path of {@link WeekData} must split items into days and bars exactly like the web app's {@code itemSegments} and {@code computeBars}. */
public class WeekDataTest {
    private static final LocalDate MONDAY = LocalDate.parse("2026-10-12");
    private static final LocalDate TODAY = LocalDate.parse("2026-10-14");

    private static String event(String title, String start, String end, boolean allDay) {
        return "{\"kind\":\"event\",\"id\":\"" + title + "\",\"title\":\"" + title + "\",\"start\":\"" + start + "\",\"end\":\"" + end + "\",\"allDay\":" + allDay + ",\"color\":\"#1a73e8\"}";
    }

    private static String list(String title, String date, String time, Integer estimate, int done, int total) {
        return "{\"kind\":\"tasklist\",\"id\":\"" + title + "\",\"title\":\"" + title + "\",\"date\":\"" + date + "\",\"time\":" + (time == null ? "null" : "\"" + time + "\"")
                + ",\"estimateMinutes\":" + estimate + ",\"doneCount\":" + done + ",\"totalCount\":" + total + ",\"color\":\"#0b8043\","
                + "\"items\":[{\"title\":\"Milk\",\"done\":true},{\"title\":\"Eggs\",\"done\":false}]}";
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
        assertEquals(3, wed.items.size());
        assertEquals("Holiday", wed.items.get(0).title);
        assertTrue(wed.items.get(0).allDay);
        assertEquals("Early", wed.items.get(1).title);
        assertEquals(9 * 60 + 15, wed.items.get(1).startMin);
        assertEquals(10 * 60, wed.items.get(1).endMin);
        assertEquals("Late", wed.items.get(2).title);
    }

    @Test
    public void multiDayAllDayEventIsABarWithExclusiveEnd() throws Exception {
        WeekData w = parse(event("Trip", "2026-10-16", "2026-10-19", true));
        assertEquals(1, w.bars.size());
        assertEquals(4, w.bars.get(0).startCol);
        assertEquals(6, w.bars.get(0).endCol);
        assertEquals(0, w.bars.get(0).lane);
        for (WeekData.Day d : w.days) assertEquals(0, d.items.size());
    }

    @Test
    public void singleDayAllDayEventStaysAnItemInTheBand() throws Exception {
        WeekData w = parse(event("Holiday", "2026-10-14", "2026-10-15", true));
        assertTrue(w.bars.isEmpty());
        assertTrue(w.days.get(2).items.get(0).allDay);
    }

    @Test
    public void barsClipToTheWeekAndTakeFreeLanes() throws Exception {
        WeekData w = parse(event("A", "2026-10-08", "2026-10-14", true), event("B", "2026-10-13", "2026-10-16", true), event("C", "2026-10-15", "2026-10-20", true));
        assertEquals(3, w.bars.size());
        WeekData.Bar a = w.bars.get(0), b = w.bars.get(1), c = w.bars.get(2);
        assertEquals("A", a.title);
        assertEquals(0, a.startCol);
        assertEquals(1, a.endCol);
        assertTrue(a.continuedFromPrev);
        assertEquals(0, a.lane);
        assertEquals(1, b.lane); // overlaps A on Tuesday
        assertEquals(0, c.lane); // starts after A ended
        assertTrue(c.continuesToNext);
        assertEquals(2, w.laneCount());
    }

    @Test
    public void overnightEventKeepsPerDayBlocks() throws Exception {
        WeekData w = parse(event("Night", "2026-10-13T22:00:00+02:00", "2026-10-14T00:00:00+02:00", false),
                event("Long", "2026-10-14T22:00:00+02:00", "2026-10-15T02:00:00+02:00", false));
        assertEquals(1, w.days.get(1).items.size());
        assertEquals(24 * 60, w.days.get(1).items.get(0).endMin);
        assertEquals(0, w.days.get(2).items.size() - 1);
        assertEquals(22 * 60, w.days.get(2).items.get(0).startMin);
        assertEquals(24 * 60, w.days.get(2).items.get(0).endMin);
        assertEquals(0, w.days.get(3).items.get(0).startMin);
        assertEquals(2 * 60, w.days.get(3).items.get(0).endMin);
        assertTrue(w.bars.isEmpty());
    }

    @Test
    public void timedTaskListIsABlockSizedByItsEstimate() throws Exception {
        WeekData w = parse(list("Groceries", "2026-10-15", "17:00", 45, 2, 5), list("Short", "2026-10-15", "09:00", null, 0, 1));
        WeekData.Item g = w.days.get(3).items.get(1), s = w.days.get(3).items.get(0);
        assertEquals("Short", s.title);
        assertEquals(9 * 60 + WeekData.TASKLIST_BLOCK_MINUTES, s.endMin);
        assertTrue(g.taskList && g.timed());
        assertEquals(17 * 60 + 45, g.endMin);
        assertEquals(2, g.done);
        assertEquals(5, g.total);
        assertEquals(java.util.List.of("Eggs"), g.openItems);
    }

    @Test
    public void untimedTaskListGoesToTheBandAfterAllDayEvents() throws Exception {
        WeekData w = parse(list("Chores", "2026-10-15", null, null, 1, 3), event("Holiday", "2026-10-15", "2026-10-16", true));
        WeekData.Day thu = w.days.get(3);
        assertEquals("Holiday", thu.items.get(0).title);
        assertEquals("Chores", thu.items.get(1).title);
        assertFalse(thu.items.get(1).timed());
    }

    @Test
    public void undatedListsAreNotShownAndOpenPastListsCarryOverToToday() throws Exception {
        WeekData w = parse("{\"kind\":\"tasklist\",\"id\":\"u\",\"title\":\"Undated\",\"date\":null,\"time\":null,\"doneCount\":0,\"totalCount\":1,\"color\":\"#000000\"}",
                list("Old", "2026-10-12", "10:00", null, 1, 3), list("Finished", "2026-10-12", null, null, 3, 3));
        assertEquals(0, w.days.get(0).items.size() - 1); // only "Finished" stays on Monday
        assertEquals("Finished", w.days.get(0).items.get(0).title);
        WeekData.Item carried = w.days.get(2).items.get(0);
        assertEquals("Old", carried.title);
        assertFalse(carried.timed()); // the time is dropped, like the web
    }
}
