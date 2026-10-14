package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.List;
import org.junit.Test;

/** The clock widget's rules match the web clock's (web/test/calendar/clock.test.ts). */
public class ClockLayoutTest {
    private static WeekData.Item ev(String title, int start, int end, String color) {
        return WeekData.Item.event(title, title, false, start, end, color);
    }

    @Test
    public void putsOverlapsOnInnerLanesAndSkipsAllDayAndUntimed() {
        List<WeekData.Item> items = List.of(ev("Dentist", 540, 600, "#111111"), WeekData.Item.taskList("Laundry", "Laundry", 570, 660, "#222222", 0, 1, List.of()),
                ev("Call", 1080, 1110, "#333333"), WeekData.Item.event("Trip", "Trip", true, -1, -1, "#444444"),
                WeekData.Item.taskList("Groceries", "Groceries", -1, -1, "#555555", 0, 2, List.of()));
        List<ClockLayout.Arc> arcs = ClockLayout.arcs(items);
        assertEquals(3, arcs.size());
        assertEquals("Dentist", arcs.get(0).item.title);
        assertEquals(0, arcs.get(0).lane);
        assertEquals("Laundry", arcs.get(1).item.title);
        assertEquals(1, arcs.get(1).lane);
        assertEquals(0, arcs.get(2).lane);
    }

    @Test
    public void wedgeRunsToTheEndOfTheRunningEventElseToTheNextStart() {
        List<WeekData.Item> items = List.of(ev("A", 540, 600, "#111111"), ev("B", 780, 840, "#222222"),
                WeekData.Item.taskList("L", "L", 660, 690, "#333333", 0, 1, List.of()));
        ClockLayout.Wedge running = ClockLayout.wedge(items, 570);
        assertEquals(600, running.to);
        assertEquals("#111111", running.color);
        ClockLayout.Wedge next = ClockLayout.wedge(items, 630);
        assertEquals(780, next.to);
        assertNull(ClockLayout.wedge(items, 900));
    }

    @Test
    public void saysWhatIsRunningOrNextInTheAppsWords() {
        List<WeekData.Item> items = List.of(ev("Dentist", 540, 600, "#111111"), ev("Gym", 1080, 1140, "#222222"));
        WidgetStrings en = new WidgetStrings("en"), de = new WidgetStrings("de");
        assertEquals("Dentist · 40 min left", ClockLayout.nowLine(items, 560, en));
        assertEquals("Next: Gym in 2 h", ClockLayout.nowLine(items, 960, en));
        assertEquals("Als Nächstes: Gym in 1 Std. 20 Min.", ClockLayout.nowLine(items, 1000, de));
        assertEquals("Nothing else today", ClockLayout.nowLine(items, 1200, en));
        assertEquals("Dentist · noch 5 Min.", ClockLayout.nowLine(items, 595, de));
    }
}
