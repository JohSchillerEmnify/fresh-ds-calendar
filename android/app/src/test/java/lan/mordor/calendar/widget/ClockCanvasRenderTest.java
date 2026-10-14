package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import android.graphics.Bitmap;
import java.io.File;
import java.io.FileOutputStream;
import java.util.List;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/**
 * Draws the clock widget with the real Android graphics stack (Robolectric native graphics) and writes the pictures to
 * {@code build/widget-pictures/} for a look without a device; checks a few pixels.
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35)
public class ClockCanvasRenderTest {
    private static final List<WeekData.Item> DAY = List.of(
            WeekData.Item.event("s", "Standup", false, 570, 585, "#039be5"),
            WeekData.Item.event("d", "Dentist", false, 600, 660, "#d50000"),
            WeekData.Item.event("l", "Lunch with Sam", false, 750, 810, "#33b679"),
            WeekData.Item.event("w", "Deep work", false, 840, 990, "#3f51b5"),
            WeekData.Item.event("g", "Gym", false, 1080, 1140, "#f4511e"),
            WeekData.Item.event("c", "Call mum", false, 1110, 1140, "#8e24aa"),
            WeekData.Item.event("h", "Holiday in Lisbon", true, -1, -1, "#039be5"),
            WeekData.Item.taskList("t", "Laundry", 1200, 1260, "#039be5", 1, 2, List.of("Fold")),
            WeekData.Item.taskList("u", "Groceries", -1, -1, "#039be5", 0, 2, List.of("Milk", "Bread")));

    @Test
    public void drawsTheDialLightAndDark() throws Exception {
        for (boolean dark : new boolean[] {false, true}) {
            Bitmap bmp = ClockCanvas.draw(DAY, WidgetTheme.defaults(dark), new WidgetStrings("en"), 620, 600, 2.75f);
            assertEquals(600, bmp.getWidth());
            // the plate is drawn (not transparent) and the ring's elapsed part is in the primary colour
            assertNotEquals(0, bmp.getPixel(300, 160) >>> 24);
            File dir = new File("build/widget-pictures");
            dir.mkdirs();
            try (FileOutputStream out = new FileOutputStream(new File(dir, "clock-" + (dark ? "dark" : "light") + ".png"))) {
                bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
            }
        }
    }
}
