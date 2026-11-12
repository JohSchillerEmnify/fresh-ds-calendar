package lan.mordor.calendar.widget;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.ParcelFileDescriptor;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lan.mordor.calendar.MainActivity;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Runs on a real Android system: starts the app, places every widget the manifest declares into a host window (the way a
 * launcher does), triggers an update and fails on a crash in the process or in the device log. Robolectric cannot show
 * what the system's widget machinery does with our RemoteViews.
 */
@RunWith(AndroidJUnit4.class)
public class WidgetSmokeTest {
    private static final int HOST_ID = 4711;
    private static final long SETTLE_MS = 6000;
    private static final long SOAK_MS = 120_000;

    private final Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();

    @Test
    public void everyWidgetKindSurvivesBeingPlacedAndUpdated() throws Exception {
        seedAppCopy("agenda");
        run("logcat -c");
        // binding needs the signature permission BIND_APPWIDGET that a launcher holds; the shell can grant it (exists since API 26, used by AOSP's CTS)
        run("appwidget grantbind --package " + ctx.getPackageName() + " --user 0");
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        AppWidgetHost host = new AppWidgetHost(ctx, HOST_ID);
        List<Integer> ids = new ArrayList<>();
        List<AppWidgetProviderInfo> providers = manager.getInstalledProvidersForPackage(ctx.getPackageName(), null);
        assertTrue("the manifest declares four widget providers, found " + providers.size(), providers.size() >= 4);
        try {
            host.startListening();
            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                List<AppWidgetHostView> views = new ArrayList<>();
                for (AppWidgetProviderInfo info : providers) {
                    int id = host.allocateAppWidgetId();
                    ids.add(id);
                    assertTrue("bind " + info.provider, bind(manager, id, info));
                    AppWidgetHostView view = host.createView(ctx, id, info);
                    assertNotNull(info.provider.getClassName(), view);
                    views.add(view);
                    sendUpdate(info.provider, id);
                }
                // attached to a window the lists bind their adapters (the RemoteViewsService below API 31)
                scenario.onActivity(activity -> {
                    FrameLayout root = new FrameLayout(activity);
                    for (AppWidgetHostView view : views) root.addView(view, new ViewGroup.LayoutParams(900, 900));
                    activity.addContentView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                });
                Thread.sleep(SETTLE_MS);
                scenario.onActivity(activity -> {
                    for (View view : views) assertTrue("laid out " + view, view.getHeight() > 0);
                });
            }
            // the app's screen is closed, the widgets stay bound as on a home screen: repeated updates, the clock broadcasts
            // and the background fetch run against them for a while
            long end = System.currentTimeMillis() + SOAK_MS;
            for (int round = 0; System.currentTimeMillis() < end; round++) {
                for (int i = 0; i < ids.size(); i++) sendUpdate(providers.get(i).provider, ids.get(i));
                if (round % 4 == 1) WeekWidgetProvider.enqueueFetch(ctx);
                if (round % 4 == 2) run("am broadcast -a android.intent.action.DATE_CHANGED -p " + ctx.getPackageName()); // protected: only the shell may send it
                if (round % 4 == 3) run("am broadcast -a android.intent.action.TIME_SET -p " + ctx.getPackageName());
                Thread.sleep(3000);
            }
        } finally {
            for (int id : ids) host.deleteAppWidgetId(id);
            host.stopListening();
        }
        assertNoCrashInLog();
    }

    /** The shell grant can take a moment to reach the widget service right after the app was installed. */
    private boolean bind(AppWidgetManager manager, int id, AppWidgetProviderInfo info) throws Exception {
        for (int attempt = 0; attempt < 10; attempt++) {
            if (manager.bindAppWidgetIdIfAllowed(id, info.provider)) return true;
            run("appwidget grantbind --package " + ctx.getPackageName() + " --user 0");
            Thread.sleep(1000);
        }
        return false;
    }

    private void sendUpdate(ComponentName provider, int id) {
        ctx.sendBroadcast(new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(provider)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[] {id}));
    }

    private void assertNoCrashInLog() throws Exception {
        String log = run("logcat -d -b crash -b main -b system");
        String pkg = ctx.getPackageName();
        String[] lines = log.split("\n");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            // other processes (Play services on the emulator image) crash too; only the app's own crash counts
            if (line.contains("FATAL EXCEPTION")) {
                for (int j = i; j < Math.min(i + 4, lines.length); j++) {
                    assertFalse("crash of the app in the device log: " + lines[j], lines[j].contains("Process: " + pkg));
                }
            }
            assertFalse("crash in the device log: " + line, line.contains(pkg) && (line.contains("has died") || line.contains("ANR in")));
        }
    }

    private static String run(String command) throws Exception {
        ParcelFileDescriptor fd = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
        StringBuilder out = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new ParcelFileDescriptor.AutoCloseInputStream(fd)))) {
            for (String line; (line = r.readLine()) != null; ) out.append(line).append('\n');
        }
        return out.toString();
    }

    /** The app's copy (what the web app pushes): 16 days from today with events, so the lists have real rows. */
    private void seedAppCopy(String style) throws Exception {
        LocalDate today = LocalDate.now();
        JSONArray days = new JSONArray();
        for (int i = 0; i < 16; i++) {
            JSONArray events = new JSONArray();
            if (i < 3) {
                events.put(new JSONObject().put("title", "Dentist").put("allDay", false).put("start", "09:00").put("end", "10:00").put("color", "#039be5"));
                events.put(new JSONObject().put("title", "Holiday").put("allDay", true).put("color", "#33b679"));
            }
            days.put(new JSONObject().put("date", today.plusDays(i).toString()).put("events", events));
        }
        String json = new JSONObject().put("v", 1).put("generatedAt", "x").put("language", "en").put("dark", false)
                .put("weekStart", today.minusDays(today.getDayOfWeek().getValue() - 1).toString()).put("days", days)
                .put("tasklists", new JSONArray()).put("minEventMinutes", 0).put("weekSideBySide", 2).put("scrollStyle", style).put("scrollDays", 3).toString();
        new WidgetStore(ctx).clearAll();
        new WidgetStore(ctx).saveSnapshot(json);
    }
}
