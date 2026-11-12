package lan.mordor.calendar.widget;

import static org.junit.Assert.assertTrue;

import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Context;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import android.util.SizeF;
import android.widget.RemoteViews;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Hands the system every widget kind at the sizes a phone launcher can give, up to the whole screen, with a full calendar, and
 * fails when the system refuses an update for its pictures' memory. With {@code adb shell wm size 1440x3200} on a phone started at
 * 1080x2400 the unguarded update was refused (used: 18434772, max: 15552000), the crash of a widget after a resolution change.
 */
@RunWith(AndroidJUnit4.class)
public class WidgetMaxSizeTest {
    private static final String TAG = "WidgetMaxSize";
    private static final int HOST_ID = 4712;

    private final Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();

    @Test
    public void theSystemTakesEveryWidgetUpToTheWholeScreen() throws Exception {
        android.util.DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
        int screenW = Math.round(dm.widthPixels / dm.density), screenH = Math.round(dm.heightPixels / dm.density);
        int[][] sizes = {{screenW, screenH}, {screenW, screenH * 3 / 4}, {screenW, screenH / 2}, {screenW / 2, screenH}, {screenW * 3 / 4, screenH}};
        List<String> refused = new ArrayList<>();
        for (int hours : new int[] {8, 24}) {
            seed(hours);
            run("appwidget grantbind --package " + ctx.getPackageName() + " --user 0");
            AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
            AppWidgetHost host = new AppWidgetHost(ctx, HOST_ID);
            List<Integer> ids = new ArrayList<>();
            try {
                host.startListening();
                for (AppWidgetProviderInfo info : manager.getInstalledProvidersForPackage(ctx.getPackageName(), null)) {
                    int id = host.allocateAppWidgetId();
                    ids.add(id);
                    assertTrue("bind " + info.provider, bind(manager, id, info));
                    String kind = info.provider.getShortClassName();
                    for (int[] s : sizes) {
                        Bundle o = options(s[0], s[1]);
                        LocalDate today = LocalDate.now();
                        LocalTime now = LocalTime.of(9, 0);
                        java.util.function.Supplier<RemoteViews> build;
                        if (kind.endsWith("MultiDayWidgetProvider")) build = () -> ScrollWidgetRenderer.build(ctx, id, o, today, now, true);
                        else if (kind.endsWith("ScrollWidgetProvider")) build = () -> ScrollWidgetRenderer.build(ctx, id, o, today, now, false);
                        else if (kind.endsWith("DayWidgetProvider")) build = () -> DayWidgetProvider.build(ctx, o, today, now);
                        else if (kind.endsWith("ClockWidgetProvider")) build = () -> ClockWidgetProvider.build(ctx, o, today, now);
                        else build = () -> WidgetRenderer.build(ctx, o, today);
                        String what = kind + " " + s[0] + "x" + s[1] + "dp hours " + hours;
                        if (BitmapBudget.push(ctx, manager, id, build)) Log.i(TAG, "taken: " + what);
                        else refused.add(what);
                    }
                }
            } finally {
                for (int id : ids) host.deleteAppWidgetId(id);
                host.stopListening();
            }
        }
        assertTrue("the system refused: " + String.join("\n", refused), refused.isEmpty());
    }

    /** What a launcher sets: the size range in dp and, from Android 12, the exact sizes. */
    private static Bundle options(int w, int h) {
        Bundle o = new Bundle();
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, w);
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, w);
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, h);
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, h);
        ArrayList<SizeF> exact = new ArrayList<>();
        exact.add(new SizeF(w, h));
        o.putParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, exact);
        return o;
    }

    private boolean bind(AppWidgetManager manager, int id, AppWidgetProviderInfo info) throws Exception {
        for (int attempt = 0; attempt < 10; attempt++) {
            if (manager.bindAppWidgetIdIfAllowed(id, info.provider)) return true;
            run("appwidget grantbind --package " + ctx.getPackageName() + " --user 0");
            Thread.sleep(1000);
        }
        return false;
    }

    private static String run(String command) throws Exception {
        ParcelFileDescriptor fd = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
        StringBuilder out = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new ParcelFileDescriptor.AutoCloseInputStream(fd)))) {
            for (String line; (line = r.readLine()) != null; ) out.append(line).append('\n');
        }
        return out.toString();
    }

    /** A busy fortnight: every day eight timed entries, overlapping ones and three all-day entries; the Timeline shows 7 days. */
    private void seed(int hours) throws Exception {
        LocalDate today = LocalDate.now();
        JSONArray days = new JSONArray();
        for (int i = 0; i < 16; i++) {
            JSONArray events = new JSONArray();
            for (int h = 7; h < 22; h += 2) {
                events.put(new JSONObject().put("title", "Meeting " + h).put("allDay", false).put("start", String.format("%02d:00", h)).put("end", String.format("%02d:30", h + 1)).put("color", "#039be5"));
            }
            for (int a = 0; a < 3; a++) events.put(new JSONObject().put("title", "All day " + a).put("allDay", true).put("color", "#33b679"));
            days.put(new JSONObject().put("date", today.plusDays(i).toString()).put("events", events));
        }
        String json = new JSONObject().put("v", 1).put("generatedAt", "x").put("language", "en").put("dark", false)
                .put("weekStart", today.minusDays(today.getDayOfWeek().getValue() - 1).toString()).put("days", days)
                .put("tasklists", new JSONArray()).put("minEventMinutes", 0).put("weekSideBySide", 2).put("scrollDays", 7).put("scrollHours", hours).toString();
        new WidgetStore(ctx).clearAll();
        new WidgetStore(ctx).saveSnapshot(json);
    }
}
