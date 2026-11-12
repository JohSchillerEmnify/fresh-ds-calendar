package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;

import android.graphics.Bitmap;
import java.io.File;
import java.io.FileOutputStream;
import java.time.LocalDate;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/** Draws the day and week widgets from API-shaped data into {@code build/widget-pictures/} for a look without a device. */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35)
public class DayCanvasRenderTest {
    private static final LocalDate MONDAY = LocalDate.parse("2026-10-12"), TODAY = LocalDate.parse("2026-10-14");

    private static String ev(String title, String start, String end, boolean allDay, String color) {
        return "{\"kind\":\"event\",\"id\":\"" + title + "\",\"title\":\"" + title + "\",\"start\":\"" + start + "\",\"end\":\"" + end + "\",\"allDay\":" + allDay
                + ",\"color\":\"" + color + "\"}";
    }

    private static String t(String hm) {
        return "2026-10-14T" + hm + ":00+02:00";
    }

    @Test
    public void drawsDayAndWeek() throws Exception {
        String list = "{\"kind\":\"tasklist\",\"id\":\"l\",\"title\":\"Laundry\",\"date\":\"2026-10-14\",\"time\":\"18:30\",\"estimateMinutes\":60,\"doneCount\":1,"
                + "\"totalCount\":3,\"color\":\"#0b8043\",\"items\":[{\"title\":\"Wash\",\"done\":true},{\"title\":\"Hang up\",\"done\":false},{\"title\":\"Fold\",\"done\":false}]}";
        // untitled lists: a short one named by its first item, an untimed one by its open names, and a tall one that lists its items
        String untitled = "{\"kind\":\"tasklist\",\"id\":\"u1\",\"title\":\"\",\"date\":\"2026-10-14\",\"time\":\"19:00\",\"estimateMinutes\":30,\"doneCount\":0,"
                + "\"totalCount\":1,\"color\":\"#8e24aa\",\"items\":[{\"title\":\"Call the plumber\",\"done\":false}]}";
        String untimed = "{\"kind\":\"tasklist\",\"id\":\"u2\",\"title\":\"\",\"date\":\"2026-10-14\",\"time\":null,\"doneCount\":0,\"totalCount\":2,"
                + "\"color\":\"#f4511e\",\"items\":[{\"title\":\"Milk\",\"done\":false},{\"title\":\"Eggs\",\"done\":false}]}";
        WeekData data = WeekData.fromItems(new JSONArray("[" + String.join(",",
                ev("Standup", t("09:30"), t("09:45"), false, "#039be5"), ev("Dentist", t("10:00"), t("11:00"), false, "#d50000"),
                ev("Lunch with Sam", t("12:30"), t("13:30"), false, "#33b679"), ev("Deep work", t("14:00"), t("16:30"), false, "#3f51b5"),
                ev("Gym", t("17:00"), t("18:00"), false, "#f4511e"), ev("Holiday in Lisbon", "2026-10-14", "2026-10-15", true, "#039be5"),
                ev("Trip", "2026-10-13", "2026-10-16", true, "#8e24aa"), list, untitled, untimed) + "]"), TODAY, MONDAY, 0, true);
        File dir = new File("build/widget-pictures");
        dir.mkdirs();
        float d = 2.75f;
        Bitmap day = WeekCanvas.drawDay(data, WidgetTheme.defaults(false), new WidgetStrings("en"), MONDAY, TODAY, TODAY, 10 * 60 + 20, "Updated: 10:18", false,
                Math.round(180 * d), Math.round(300 * d), d);
        assertEquals(Math.round(180 * d), day.getWidth());
        save(day, new File(dir, "day-light.png"));
        save(WeekCanvas.drawDay(data, WidgetTheme.defaults(true), new WidgetStrings("de"), MONDAY, TODAY, TODAY, 10 * 60 + 20, "Stand: 10:18", false,
                Math.round(180 * d), Math.round(300 * d), d), new File(dir, "day-dark-de.png"));
        save(WeekCanvas.draw(data, WidgetTheme.defaults(false), new WidgetStrings("en"), MONDAY, TODAY, 10 * 60 + 20, "Updated: 10:18", false,
                Math.round(360 * d), Math.round(220 * d), d), new File(dir, "week-light.png"));
    }

    private static void save(Bitmap b, File f) throws Exception {
        try (FileOutputStream out = new FileOutputStream(f)) {
            b.compress(Bitmap.CompressFormat.PNG, 100, out);
        }
    }
}
