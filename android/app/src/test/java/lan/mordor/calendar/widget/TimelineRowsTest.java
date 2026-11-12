package lan.mordor.calendar.widget;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/** The scrolling widget's Timeline: day columns with the hours running down, cut into list rows (feature scrolling-widget). */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35)
public class TimelineRowsTest {
    private static final LocalDate TODAY = LocalDate.parse("2026-10-14");
    private static final WidgetStrings EN = new WidgetStrings("en");

    private static String ev(String title, String date, String from, String to) {
        return "{\"kind\":\"event\",\"id\":\"" + title + "\",\"title\":\"" + title + "\",\"start\":\"" + date + "T" + from + ":00+02:00\",\"end\":\"" + date + "T" + to
                + ":00+02:00\",\"allDay\":false,\"color\":\"#039be5\"}";
    }

    private static final LocalTime T1410 = LocalTime.of(14, 10);

    private static TimelineRows.Plan plan(WeekData d, int days, int hours, float heightDp, LocalTime now) {
        return TimelineRows.plan(d, TODAY, days, EN, hours, heightDp, now, 1f);
    }

    private static TimelineRows.Plan plan(WeekData d, int days) {
        return plan(d, days, 16, 380, T1410);
    }

    private static WeekData data(String... items) throws Exception {
        return WeekData.fromItems(new JSONArray("[" + String.join(",", items) + "]"), TODAY, LocalDate.parse("2026-10-12"), 0, true, 16);
    }

    @Test
    public void drawsThreeDayColumnsByDefault() throws Exception {
        TimelineRows.Plan plan = plan(data(ev("Dentist", "2026-10-14", "09:00", "10:00")), ScrollRows.DEFAULT_TIMELINE_DAYS);
        assertEquals(3, plan.columns.size());
        assertEquals("Wed 14 Oct", plan.columns.get(0).longName);
        assertEquals("Fri 16 Oct", plan.columns.get(2).longName);
        assertTrue(plan.columns.get(0).today);
    }

    @Test
    public void drawsTheChosenNumberOfDays() throws Exception {
        assertEquals("Wed 14 Oct", plan(data(), 1).columns.get(0).longName);
        List<TimelineRows.Column> seven = plan(data(), 7).columns;
        assertEquals(7, seven.size());
        assertEquals("Tue 20 Oct", seven.get(6).longName);
    }

    @Test
    public void placesAnEventInItsColumnAndHours() throws Exception {
        TimelineRows.Plan plan = plan(data(ev("Yoga", "2026-10-15", "07:00", "08:00")), 3);
        assertEquals(LocalDate.parse("2026-10-15"), plan.columns.get(1).date);
        WeekData.Item yoga = plan.columns.get(1).items.get(0);
        assertEquals("Yoga", yoga.title);
        assertEquals(7 * 60, yoga.startMin);
        assertEquals(8 * 60, yoga.endMin);
        assertTrue(plan.columns.get(0).items.isEmpty());
    }

    @Test
    public void holdsTheWholeDayAndFitsTheChosenHours() throws Exception {
        WeekData d = data(ev("Early", "2026-10-14", "06:00", "07:00"));
        for (int hours : new int[] {8, 12, 16, 24}) {
            TimelineRows.Plan plan = plan(d, 3, hours, 380, T1410);
            assertEquals(0, plan.firstHour);
            assertEquals(24, plan.lastHour);
            assertEquals("the hours in view fill the list below the day names", 380 - TimelineRows.HEAD_DP, plan.hourDp * hours, 0.5);
        }
    }

    @Test
    public void opensHalfAnHourBeforeNow() throws Exception {
        WeekData d = data(ev("Early", "2026-10-14", "06:00", "07:00"));
        TimelineRows.Plan mid = plan(d, 3, 8, 380, LocalTime.of(10, 20));
        assertEquals(9 * 60 + 50, mid.startMin);
        // one row from the top to the end of the opening view, one after it; the list scrolls to the first
        assertArrayEquals(new int[] {0, 9 * 60 + 50 + 8 * 60, 24 * 60}, mid.marks);
        assertEquals(0, mid.scrollRow);
        assertEquals(-1, plan(d, 3, 16, 380, LocalTime.of(0, 20)).scrollRow);
    }

    @Test
    public void lateInTheDayTheLastHoursShowAndTheListNeverScrollsPast24() throws Exception {
        WeekData d = data(ev("Late", "2026-10-14", "21:00", "22:00"));
        for (LocalTime now : new LocalTime[] {LocalTime.of(14, 10), LocalTime.of(21, 30), LocalTime.of(23, 50)}) {
            TimelineRows.Plan plan = plan(d, 3, 16, 380, now);
            assertEquals("the top minute is 24:00 minus 16 hours at the latest", Math.min(now.getHour() * 60 + now.getMinute() - 30, 8 * 60 + Math.round(4 / plan.hourDp * 60)), plan.startMin);
            assertEquals("one row to the end of the day", 1, plan.rowCount());
            assertEquals(0, plan.scrollRow);
        }
    }

    @Test
    public void aFullDayNeedsNoScrolling() throws Exception {
        assertEquals(-1, plan(data(), 3, 24, 380, T1410).scrollRow);
    }

    @Test
    public void slicesCoverTheWholePictureBandFirstThenOneRowPerHourAndTheStartMinute() throws Exception {
        String allDay = "{\"kind\":\"event\",\"id\":\"h\",\"title\":\"Holiday\",\"start\":\"2026-10-14\",\"end\":\"2026-10-15\",\"allDay\":true,\"color\":\"#8e24aa\"}";
        WeekData d = data(ev("Dentist", "2026-10-14", "09:00", "10:00"), allDay);
        TimelineRows.Plan plan = plan(d, 3);
        assertTrue(plan.bandDp > 0);
        float scale = 2.75f;
        List<Bitmap> rows = TimelineRows.slices(d, plan, WidgetTheme.defaults(false), EN, TODAY, 10 * 60, Math.round(300 * scale), scale, 1f);
        assertEquals(plan.rowCount(), rows.size());
        int total = 0;
        for (Bitmap b : rows) {
            assertEquals(Math.round(300 * scale), b.getWidth());
            total += b.getHeight();
        }
        assertEquals(Math.round(plan.totalDp() * scale), total, 2);
    }
}
