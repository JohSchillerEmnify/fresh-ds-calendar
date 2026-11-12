package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.Application;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;
import androidx.test.core.app.ApplicationProvider;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import lan.mordor.calendar.MainActivity;
import lan.mordor.calendar.R;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/** The scrolling widget inflates like a launcher does and reads the app's copy (feature scrolling-widget). */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35)
public class ScrollWidgetInflateTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private static final LocalTime NOW = LocalTime.of(10, 20);
    private final Context ctx = ApplicationProvider.getApplicationContext();

    /** The app's copy: the 14 days from Monday 2026-10-12 to today + 13, one event per entry of {@code events} ({@code day|title|from|to}). */
    private static String snapshot(boolean dark, String style, int days, String... events) throws Exception {
        JSONArray all = new JSONArray();
        for (int i = 0; i < 16; i++) {
            JSONArray list = new JSONArray();
            for (String e : events) {
                String[] p = e.split("\\|");
                if (Integer.parseInt(p[0]) == i) list.put(new JSONObject().put("title", p[1]).put("allDay", false).put("start", p[2]).put("end", p[3]).put("color", "#039be5"));
            }
            all.put(new JSONObject().put("date", LocalDate.of(2026, 10, 12).plusDays(i).toString()).put("events", list));
        }
        JSONObject s = new JSONObject().put("v", 1).put("generatedAt", "x").put("language", "en").put("dark", dark).put("weekStart", "2026-10-12").put("days", all)
                .put("tasklists", new JSONArray()).put("minEventMinutes", 0).put("weekSideBySide", 2).put("scrollStyle", style).put("scrollDays", days);
        return s.toString();
    }

    private static Bundle size(int widthDp, int heightDp) {
        Bundle b = new Bundle();
        b.putInt("appWidgetMinWidth", widthDp);
        b.putInt("appWidgetMaxWidth", widthDp);
        b.putInt("appWidgetMinHeight", heightDp);
        b.putInt("appWidgetMaxHeight", heightDp);
        return b;
    }

    private List<RemoteViews> items(Bundle options) {
        return items(options, false);
    }

    private List<RemoteViews> items(Bundle options, boolean timeline) {
        return ScrollWidgetRenderer.items(ctx, ScrollWidgetRenderer.load(ctx, TODAY), options, TODAY, NOW, timeline);
    }

    private static String text(Context ctx, RemoteViews rv, int id) {
        return ((TextView) rv.apply(ctx, new FrameLayout(ctx)).findViewById(id)).getText().toString();
    }

    @Test
    public void bothStylesInflateInLightAndDark() throws Exception {
        for (boolean dark : new boolean[] {false, true}) {
            for (String style : new String[] {"agenda", "timeline"}) {
                new WidgetStore(ctx).clearAll();
                new WidgetStore(ctx).saveSnapshot(snapshot(dark, style, 3, "2|Dentist|09:00|10:00"));
                boolean timeline = "timeline".equals(style);
                RemoteViews rv = ScrollWidgetRenderer.build(ctx, 1, size(250, 250), TODAY, NOW, timeline);
                assertNotNull(style, rv.apply(ctx, new FrameLayout(ctx)));
                for (RemoteViews row : items(size(250, 250), timeline)) assertNotNull(row.apply(ctx, new FrameLayout(ctx)));
            }
        }
        assertTrue(new WidgetStore(ctx).snapshot().optBoolean("dark"));
    }

    @Test
    public void withoutAConnectionTheAppsCopyIsShown() throws Exception {
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "agenda", 3, "2|Dentist|09:00|10:00"));
        List<RemoteViews> rows = items(size(250, 250));
        assertEquals("Wed 14 Oct", text(ctx, rows.get(0), R.id.title));
        assertEquals("Dentist", text(ctx, rows.get(1), R.id.title));
        assertEquals("09:00", text(ctx, rows.get(1), R.id.time));
    }

    @Test
    public void aNewSnapshotRedrawsTheScrollingWidget() throws Exception {
        WidgetStore store = new WidgetStore(ctx);
        store.saveSnapshot(snapshot(false, "agenda", 3, "2|Dentist|09:00|10:00"));
        assertEquals("09:00", text(ctx, items(size(250, 250)).get(1), R.id.time));
        assertTrue(store.saveSnapshot(snapshot(false, "agenda", 3, "2|Dentist|11:00|12:00")));
        assertEquals("11:00", text(ctx, items(size(250, 250)).get(1), R.id.time));
    }

    @Test
    public void aShortAgendaHoldsEveryRowForScrolling() throws Exception {
        List<String> ten = new ArrayList<>();
        for (int i = 0; i < 10; i++) ten.add("2|Event " + i + "|0" + i + ":00|0" + i + ":30");
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "agenda", 3, ten.toArray(new String[0])));
        assertEquals("a header and ten entries, however short the widget", 11, items(size(250, 110)).size());
    }

    @Test
    public void narrowWidgetShowsTitlesOnly() throws Exception {
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "agenda", 3, "2|Dentist|09:00|10:00"));
        RemoteViews entry = items(size(120, 250)).get(1);
        assertEquals(View.GONE, entry.apply(ctx, new FrameLayout(ctx)).findViewById(R.id.time).getVisibility());
    }

    @Test
    public void timelineTapsOpenTheDay() throws Exception {
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "timeline", 3, "2|Dentist|09:00|10:00"));
        RemoteViews rv = ScrollWidgetRenderer.build(ctx, 1, size(250, 250), TODAY, NOW, true);
        View view = rv.apply(ctx, new FrameLayout(ctx));
        assertEquals(View.VISIBLE, view.findViewById(R.id.head).getVisibility());
        assertEquals(View.GONE, view.findViewById(R.id.d3).getVisibility());
        view.findViewById(R.id.d1).performClick();
        Intent started = shadowOf((Application) ctx).getNextStartedActivity();
        assertEquals("/day/2026-10-15", started.getStringExtra(MainActivity.EXTRA_PATH));
    }

    @Test
    public void factoryHandsOutTheSameRowsOnOlderAndroid() throws Exception {
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "agenda", 3, "2|Dentist|09:00|10:00"));
        ScrollWidgetService.Factory factory = new ScrollWidgetService.Factory(ctx, 1, false, TODAY);
        factory.onDataSetChanged();
        assertEquals(2, factory.getCount());
        assertEquals("Dentist", text(ctx, factory.getViewAt(1), R.id.title));
    }

    @Test
    public void anEmptyAgendaShowsTheMessage() throws Exception {
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "agenda", 3));
        View view = ScrollWidgetRenderer.build(ctx, 1, size(250, 250), TODAY, NOW, false).apply(ctx, new FrameLayout(ctx));
        assertEquals("Nothing planned", ((TextView) view.findViewById(R.id.empty)).getText().toString());
    }

    @Test
    public void thePickerOffersAListAndAMultiDayWidget() throws Exception {
        PackageManager pm = ctx.getPackageManager();
        ActivityInfo list = pm.getReceiverInfo(new ComponentName(ctx, ScrollWidgetProvider.class), 0);
        ActivityInfo multi = pm.getReceiverInfo(new ComponentName(ctx, MultiDayWidgetProvider.class), 0);
        assertEquals("List", list.loadLabel(pm).toString());
        assertEquals("Multi-day", multi.loadLabel(pm).toString());
        assertTrue(new MultiDayWidgetProvider() instanceof AppWidgetProvider);
    }

    @Test
    public void aListWidgetPlacedAsATimelineIsAListNow() throws Exception {
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "timeline", 3, "2|Dentist|09:00|10:00"));
        View view = ScrollWidgetRenderer.build(ctx, 1, size(250, 250), TODAY, NOW, false).apply(ctx, new FrameLayout(ctx));
        assertEquals(View.GONE, view.findViewById(R.id.head).getVisibility());
        List<RemoteViews> rows = items(size(250, 250), false);
        assertEquals("Wed 14 Oct", text(ctx, rows.get(0), R.id.title));
    }

    @Test
    public void multiDayRowsEndInBlankSpaceWhenNowMinusHalfAnHourNeedsIt() throws Exception {
        new WidgetStore(ctx).saveSnapshot(snapshot(false, "timeline", 3, "2|Dentist|09:00|10:00"));
        Bundle o = size(250, 380);
        TimelineRows.Plan plan = TimelineRows.plan(ScrollWidgetRenderer.load(ctx, TODAY).data, TODAY, 3, new WidgetStrings("en"), 16, 380, LocalTime.of(14, 10));
        assertEquals(plan.rowCount(), ScrollWidgetRenderer.items(ctx, ScrollWidgetRenderer.load(ctx, TODAY), o, TODAY, LocalTime.of(14, 10), true).size());
        assertTrue(plan.spacerDp > 0);
    }
}
