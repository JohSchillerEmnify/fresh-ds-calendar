package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.AlarmManager;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import androidx.test.core.app.ApplicationProvider;
import androidx.work.Configuration;
import androidx.work.WorkManager;
import java.time.LocalDate;
import java.time.LocalTime;
import lan.mordor.calendar.R;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** The Multi-day widget follows the time: its refresh icon and a periodic tick redraw its now line where the list is; it opens anew only when placed and on a new day (feature scrolling-widget). */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class MultiDayRefreshTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private final Context ctx = ApplicationProvider.getApplicationContext();
    private AppWidgetManager manager;
    private int id;

    @Before
    public void setUp() throws Exception {
        JSONArray days = new JSONArray();
        for (int i = 0; i < 16; i++) days.put(new JSONObject().put("date", LocalDate.of(2026, 10, 12).plusDays(i).toString()).put("events", new JSONArray()));
        JSONObject s = new JSONObject().put("v", 1).put("generatedAt", "x").put("language", "en").put("dark", false).put("weekStart", "2026-10-12").put("days", days)
                .put("tasklists", new JSONArray()).put("minEventMinutes", 0).put("weekSideBySide", 2).put("scrollStyle", "timeline").put("scrollDays", 3);
        WidgetStore store = new WidgetStore(ctx);
        store.clearAll();
        store.saveSnapshot(s.toString());
        try {
            WorkManager.initialize(ctx, new Configuration.Builder().build());
        } catch (IllegalStateException alreadyThere) {
            // one WorkManager per process
        }
        manager = AppWidgetManager.getInstance(ctx);
        id = shadowOf(manager).createWidget(MultiDayWidgetProvider.class, R.layout.widget_scroll);
        new MultiDayWidgetProvider().onDeleted(ctx, new int[] {id}); // forget what an earlier test pushed under this id
    }

    @Test
    public void aRefreshTapRedrawsTheShownListWithoutOpeningItAfresh() {
        assertTrue(ScrollWidgetProvider.render(ctx, manager, id, true, true, LocalDate.now(), LocalTime.now(), true));
        WidgetStore store = new WidgetStore(ctx);
        boolean layout = store.altLayout(id);
        LocalTime opened = store.opening(id, LocalDate.now());
        android.view.View shown = shadowOf(manager).getViewFor(id);
        new WidgetActionReceiver().onReceive(ctx, new Intent(WidgetActionReceiver.ACTION_REFRESH));
        assertEquals("same layout: the launcher reapplies it and the list stays where it is", layout, store.altLayout(id));
        assertEquals(opened, store.opening(id, LocalDate.now()));
        assertSame(shown, shadowOf(manager).getViewFor(id));
    }

    @Test
    public void theTickRedrawsOnceTheQuarterHourMovedOnAndKeepsThePlace() {
        assertTrue(ScrollWidgetProvider.render(ctx, manager, id, true, true, TODAY, LocalTime.of(10, 0), true));
        boolean layout = new WidgetStore(ctx).altLayout(id);
        assertFalse("not pushed within the quarter hour", ScrollWidgetProvider.render(ctx, manager, id, false, true, TODAY, LocalTime.of(10, 5)));
        assertTrue("pushed 30 minutes later: the time line moves on", ScrollWidgetProvider.render(ctx, manager, id, false, true, TODAY, LocalTime.of(10, 30)));
        assertEquals("in the same layout", layout, new WidgetStore(ctx).altLayout(id));
        assertEquals("cut into rows at the time it opened", LocalTime.of(10, 0), new WidgetStore(ctx).opening(id, TODAY));
    }

    @Test
    public void aNewDayOpensAtHalfAnHourBeforeNowAgain() {
        assertTrue(ScrollWidgetProvider.render(ctx, manager, id, true, true, TODAY, LocalTime.of(22, 0), true));
        boolean layout = new WidgetStore(ctx).altLayout(id);
        assertTrue(ScrollWidgetProvider.render(ctx, manager, id, false, true, TODAY.plusDays(1), LocalTime.of(7, 0)));
        assertNotEquals("the other layout: built afresh", layout, new WidgetStore(ctx).altLayout(id));
        assertEquals(LocalTime.of(7, 0), new WidgetStore(ctx).opening(id, TODAY.plusDays(1)));
    }

    @Test
    public void aPlacedMultiDayWidgetSchedulesTheTick() {
        new MultiDayWidgetProvider().onEnabled(ctx);
        assertFalse(shadowOf((AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE)).getScheduledAlarms().isEmpty());
    }
}
