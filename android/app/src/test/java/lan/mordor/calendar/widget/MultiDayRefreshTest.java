package lan.mordor.calendar.widget;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotSame;
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

/** The Multi-day widget follows the time: its refresh icon redraws it and a periodic tick moves its now line and opening row on (feature scrolling-widget). */
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
    public void aRefreshTapWithUnchangedDataPushesTheMultiDayWidgetAgain() {
        assertTrue(ScrollWidgetProvider.render(ctx, manager, id, false, true, LocalDate.now(), LocalTime.now()));
        shadowOf(manager).setAlwaysRecreateViewsDuringUpdate(true); // a new view per push, so that a push shows
        android.view.View before = shadowOf(manager).getViewFor(id);
        new WidgetActionReceiver().onReceive(ctx, new Intent(WidgetActionReceiver.ACTION_REFRESH));
        assertNotSame("pushed anew", before, shadowOf(manager).getViewFor(id));
    }

    @Test
    public void theTickPushesTheMultiDayWidgetOnceTheOpeningQuarterHourMovedOn() {
        shadowOf(manager).setAlwaysRecreateViewsDuringUpdate(true);
        assertTrue(ScrollWidgetProvider.render(ctx, manager, id, false, true, TODAY, LocalTime.of(10, 0)));
        ScrollWidgetProvider.renderMultiDay(ctx, false, TODAY, LocalTime.of(10, 10));
        android.view.View sameQuarter = shadowOf(manager).getViewFor(id);
        ScrollWidgetProvider.renderMultiDay(ctx, false, TODAY, LocalTime.of(10, 5));
        assertSame("not pushed within the quarter hour", sameQuarter, shadowOf(manager).getViewFor(id));
        ScrollWidgetProvider.renderMultiDay(ctx, false, TODAY, LocalTime.of(10, 30));
        assertNotSame("pushed 30 minutes later", sameQuarter, shadowOf(manager).getViewFor(id));
    }

    @Test
    public void aPlacedMultiDayWidgetSchedulesTheTick() {
        new MultiDayWidgetProvider().onEnabled(ctx);
        assertFalse(shadowOf((AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE)).getScheduledAlarms().isEmpty());
    }
}
