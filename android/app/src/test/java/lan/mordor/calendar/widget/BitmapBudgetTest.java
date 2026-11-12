package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import androidx.test.core.app.ApplicationProvider;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/**
 * A screen of 1080x2400 pixels while the system measured 720x1600 when the phone started (the resolution was changed since): the
 * system refuses more than 6 bytes per pixel of that, as on the emulator (used: 18434772, max: 15552000). No widget may crash then.
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, qualifiers = "w360dp-h800dp-xxhdpi")
public class BitmapBudgetTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private static final LocalTime NOW = LocalTime.of(9, 0);
    private static final int BOOT_LIMIT = 6 * 720 * 1600;
    private final Context ctx = ApplicationProvider.getApplicationContext();

    /** Behaves like AppWidgetServiceImpl.updateAppWidgetInstanceLocked: the views' bitmap bytes against the limit, the same message. */
    private static final class Service implements BitmapBudget.Updater {
        final int limit;
        final boolean withNumbers;
        final List<Integer> taken = new ArrayList<>();
        int refused;

        Service(int limit, boolean withNumbers) {
            this.limit = limit;
            this.withNumbers = withNumbers;
        }

        @Override
        public void update(int widgetId, RemoteViews views) {
            int used = memory(views);
            if (used > limit) {
                refused++;
                throw new IllegalArgumentException("RemoteViews for widget update exceeds maximum bitmap memory usage"
                        + (withNumbers ? " (used: " + used + ", max: " + limit + ")" : ""));
            }
            taken.add(used);
        }
    }

    /** RemoteViews.estimateMemoryUsage, what the system measures (hidden on a device, reachable under Robolectric). */
    private static int memory(RemoteViews views) {
        try {
            return (Integer) RemoteViews.class.getMethod("estimateMemoryUsage").invoke(views);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
    }

    @Before
    public void seed() throws Exception {
        BitmapBudget.reset();
        JSONArray days = new JSONArray();
        for (int i = 0; i < 16; i++) {
            JSONArray events = new JSONArray();
            for (int h = 7; h < 22; h += 2) events.put(new JSONObject().put("title", "Meeting").put("allDay", false).put("start", String.format("%02d:00", h)).put("end", String.format("%02d:30", h + 1)).put("color", "#039be5"));
            events.put(new JSONObject().put("title", "Holiday").put("allDay", true).put("color", "#33b679"));
            days.put(new JSONObject().put("date", LocalDate.of(2026, 10, 12).plusDays(i).toString()).put("events", events));
        }
        new WidgetStore(ctx).clearAll();
        new WidgetStore(ctx).saveSnapshot(new JSONObject().put("v", 1).put("generatedAt", "x").put("language", "en").put("dark", false).put("weekStart", "2026-10-12")
                .put("days", days).put("tasklists", new JSONArray()).put("minEventMinutes", 0).put("weekSideBySide", 2).put("scrollHours", 8).put("scrollDays", 7).toString());
    }

    @After
    public void forget() {
        BitmapBudget.reset();
    }

    /** The whole screen, the largest a launcher gives. */
    private static Bundle fullScreen() {
        Bundle o = new Bundle();
        o.putInt("appWidgetMinWidth", 360);
        o.putInt("appWidgetMaxWidth", 360);
        o.putInt("appWidgetMinHeight", 800);
        o.putInt("appWidgetMaxHeight", 800);
        return o;
    }

    private List<Supplier<RemoteViews>> everyKind() {
        Bundle o = fullScreen();
        return List.of(() -> WidgetRenderer.build(ctx, o, TODAY), () -> DayWidgetProvider.build(ctx, o, TODAY, NOW), () -> ClockWidgetProvider.build(ctx, o, TODAY, NOW),
                () -> ScrollWidgetRenderer.build(ctx, 1, o, TODAY, NOW, true), () -> ScrollWidgetRenderer.build(ctx, 1, o, TODAY, NOW, false));
    }

    @Test
    public void theSystemRefusesTheFullSizeMultiDayPictureAtThisScreen() {
        try {
            new Service(BOOT_LIMIT, true).update(1, ScrollWidgetRenderer.build(ctx, 1, fullScreen(), TODAY, NOW, true));
            fail("the picture of one screen at 4 bytes is above 6 bytes per pixel of the smaller boot screen");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("max: " + BOOT_LIMIT));
        }
    }

    @Test
    public void everyWidgetIsTakenWithinTheLimitTheRefusalNames() {
        Service system = new Service(BOOT_LIMIT, true);
        for (Supplier<RemoteViews> kind : everyKind()) assertTrue(BitmapBudget.push(ctx, system, 1, kind));
        assertEquals(5, system.taken.size());
        for (int used : system.taken) assertTrue("used " + used, used <= BOOT_LIMIT);
        assertTrue("one refusal teaches the limit to all widgets, refused " + system.refused, system.refused <= 1);
    }

    @Test
    public void aRefusalWithoutNumbersStillEndsInAPictureTheSystemTakes() {
        Service system = new Service(BOOT_LIMIT, false);
        assertTrue(BitmapBudget.push(ctx, system, 1, () -> ScrollWidgetRenderer.build(ctx, 1, fullScreen(), TODAY, NOW, true)));
        assertEquals(1, system.taken.size());
    }

    @Test
    public void aSystemThatTakesNoPictureMakesTheUpdateFailWithoutACrash() {
        assertFalse(BitmapBudget.push(ctx, new Service(0, true), 1, () -> WidgetRenderer.build(ctx, fullScreen(), TODAY)));
    }

    @Test(expected = IllegalArgumentException.class)
    public void anyOtherRefusalStillReachesTheCrashRecord() {
        BitmapBudget.push(ctx, (id, views) -> {
            throw new IllegalArgumentException("Bad widget id");
        }, 1, () -> WidgetRenderer.build(ctx, fullScreen(), TODAY));
    }
}
