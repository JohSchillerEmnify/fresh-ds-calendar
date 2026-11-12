package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import java.time.LocalDate;
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

    private static WeekData data(String... items) throws Exception {
        return WeekData.fromItems(new JSONArray("[" + String.join(",", items) + "]"), TODAY, LocalDate.parse("2026-10-12"), 0, true, 16);
    }

    @Test
    public void drawsThreeDayColumnsByDefault() throws Exception {
        TimelineRows.Plan plan = TimelineRows.plan(data(ev("Dentist", "2026-10-14", "09:00", "10:00")), TODAY, ScrollRows.DEFAULT_TIMELINE_DAYS, EN);
        assertEquals(3, plan.columns.size());
        assertEquals("Wed 14 Oct", plan.columns.get(0).longName);
        assertEquals("Fri 16 Oct", plan.columns.get(2).longName);
        assertTrue(plan.columns.get(0).today);
        assertTrue(plan.lastHour > plan.firstHour);
    }

    @Test
    public void drawsTheChosenNumberOfDays() throws Exception {
        assertEquals("Wed 14 Oct", TimelineRows.plan(data(), TODAY, 1, EN).columns.get(0).longName);
        List<TimelineRows.Column> seven = TimelineRows.plan(data(), TODAY, 7, EN).columns;
        assertEquals(7, seven.size());
        assertEquals("Tue 20 Oct", seven.get(6).longName);
    }

    @Test
    public void placesAnEventInItsColumnAndHours() throws Exception {
        TimelineRows.Plan plan = TimelineRows.plan(data(ev("Yoga", "2026-10-15", "07:00", "08:00")), TODAY, 3, EN);
        assertEquals(LocalDate.parse("2026-10-15"), plan.columns.get(1).date);
        WeekData.Item yoga = plan.columns.get(1).items.get(0);
        assertEquals("Yoga", yoga.title);
        assertEquals(7 * 60, yoga.startMin);
        assertEquals(8 * 60, yoga.endMin);
        assertTrue(plan.firstHour <= 7 && plan.lastHour >= 8);
        assertTrue(plan.columns.get(0).items.isEmpty());
    }

    @Test
    public void holdsMoreHoursThanFitSoItScrolls() throws Exception {
        TimelineRows.Plan plan = TimelineRows.plan(data(ev("Early", "2026-10-14", "06:00", "07:00"), ev("Late", "2026-10-14", "21:00", "22:00")), TODAY, 3, EN);
        assertEquals(6, plan.firstHour);
        assertEquals(22, plan.lastHour);
        assertTrue("a short widget (110 dp) shows less than the picture holds", plan.totalDp() > 110);
    }

    @Test
    public void slicesCoverTheWholePictureBandFirstThenOneRowPerHour() throws Exception {
        String allDay = "{\"kind\":\"event\",\"id\":\"h\",\"title\":\"Holiday\",\"start\":\"2026-10-14\",\"end\":\"2026-10-15\",\"allDay\":true,\"color\":\"#8e24aa\"}";
        WeekData d = data(ev("Dentist", "2026-10-14", "09:00", "10:00"), allDay);
        TimelineRows.Plan plan = TimelineRows.plan(d, TODAY, 3, EN);
        assertTrue(plan.bandDp > 0);
        float scale = 2.75f;
        List<Bitmap> rows = TimelineRows.slices(d, plan, WidgetTheme.defaults(false), EN, TODAY, 10 * 60, Math.round(300 * scale), scale);
        assertEquals(1 + plan.lastHour - plan.firstHour, rows.size());
        int total = 0;
        for (Bitmap b : rows) {
            assertEquals(Math.round(300 * scale), b.getWidth());
            total += b.getHeight();
        }
        assertEquals(Math.round(plan.totalDp() * scale), total, 2);
    }
}
