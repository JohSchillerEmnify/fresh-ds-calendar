package lan.mordor.calendar.widget;

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
        return TimelineRows.plan(d, TODAY, days, EN, hours, heightDp, now);
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
        // 16 hours from 13:40 reach past midnight: blank space below 24:00 lets 13:40 reach the top
        TimelineRows.Plan late = plan(d, 3, 16, 380, T1410);
        assertEquals(13 * 60 + 40, late.startMin);
        assertTrue(contains(late.marks, 13 * 60 + 40));
        float after = (13 * 60 + 40 + 16 * 60 - 24 * 60) / 60f * late.hourDp;
        assertEquals(after, late.spacerDp, 0.01);
        assertEquals(late.rowCount() - 1, late.scrollRow);
        // 8 hours from 07:40 end at 15:40: the row that ends there is the one to scroll to, and no blank space is needed
        TimelineRows.Plan early = plan(d, 3, 8, 380, LocalTime.of(8, 10));
        assertEquals(7 * 60 + 40, early.startMin);
        assertEquals(0, early.spacerDp, 0);
        assertTrue(contains(early.marks, 7 * 60 + 40));
        assertTrue(contains(early.marks, 15 * 60 + 40));
        int rowEndingAtEnd = early.bandRows + indexOf(early.marks, 15 * 60 + 40) - 1;
        assertEquals(rowEndingAtEnd, early.scrollRow);
        // the first minutes of the day: nothing to scroll
        TimelineRows.Plan midnight = plan(d, 3, 16, 380, LocalTime.of(0, 20));
        assertEquals(-1, midnight.scrollRow);
    }

    @Test
    public void aFullDayNeedsNoScrolling() throws Exception {
        TimelineRows.Plan plan = plan(data(), 3, 24, 380, T1410);
        assertEquals(-1, plan.scrollRow);
        assertEquals(0, plan.spacerDp, 0);
    }

    private static boolean contains(int[] a, int v) {
        return indexOf(a, v) >= 0;
    }

    private static int indexOf(int[] a, int v) {
        for (int i = 0; i < a.length; i++) if (a[i] == v) return i;
        return -1;
    }

    @Test
    public void slicesCoverTheWholePictureBandFirstThenOneRowPerHourAndTheStartMinute() throws Exception {
        String allDay = "{\"kind\":\"event\",\"id\":\"h\",\"title\":\"Holiday\",\"start\":\"2026-10-14\",\"end\":\"2026-10-15\",\"allDay\":true,\"color\":\"#8e24aa\"}";
        WeekData d = data(ev("Dentist", "2026-10-14", "09:00", "10:00"), allDay);
        TimelineRows.Plan plan = plan(d, 3);
        assertTrue(plan.bandDp > 0);
        float scale = 2.75f;
        List<Bitmap> rows = TimelineRows.slices(d, plan, WidgetTheme.defaults(false), EN, TODAY, 10 * 60, Math.round(300 * scale), scale);
        assertEquals(plan.bandRows + plan.marks.length - 1, rows.size());
        int total = 0;
        for (Bitmap b : rows) {
            assertEquals(Math.round(300 * scale), b.getWidth());
            total += b.getHeight();
        }
        assertEquals(Math.round(plan.totalDp() * scale), total, 2);
    }
}
