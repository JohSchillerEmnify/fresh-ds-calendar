package lan.mordor.calendar.crash;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import java.io.File;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** A crash is written to a file with class and frames and without its message, and the earlier handler still runs. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class CrashRecorderTest {
    private final Context ctx = ApplicationProvider.getApplicationContext();

    @Test
    public void recordsTheExceptionClassAndFramesOfACrashWithoutItsMessage() throws Exception {
        Exception error = new IllegalStateException("Dentist Meyer", new RuntimeException("Dentist cause"));
        String json = CrashRecorder.describe(error, "main", "1.1.9", 35, 1_760_000_000_000L).toString();
        assertFalse(json.contains("Dentist"));
        JSONObject r = new JSONObject(json);
        assertEquals("java.lang.IllegalStateException", r.getString("exception"));
        assertEquals("java.lang.RuntimeException", r.getJSONArray("causes").getString(0));
        assertTrue(r.getJSONArray("frames").getString(0).contains("CrashRecorderTest.recordsTheExceptionClassAndFrames"));
        assertEquals("main", r.getString("thread"));
        assertEquals(35, r.getInt("android"));
        assertEquals("1.1.9", r.getString("app"));
    }

    @Test
    public void keepsTheMessageAndFramesOfCausesTheFrameworkThrew() throws Exception {
        // what Parcel.readException hands an app when the system refuses a call: the system's exception plus its stack as a cause
        IllegalArgumentException refused = new IllegalArgumentException("RemoteViews for widget update exceeds maximum bitmap memory usage (used: 20000000, max: 15552000)");
        refused.setStackTrace(new StackTraceElement[] {new StackTraceElement("android.os.Parcel", "createExceptionOrNull", "Parcel.java", 3300),
                new StackTraceElement("android.appwidget.AppWidgetManager", "updateAppWidget", "AppWidgetManager.java", 600),
                new StackTraceElement("lan.mordor.calendar.widget.ScrollWidgetProvider", "render", "ScrollWidgetProvider.java", 94)});
        android.os.RemoteException remote = new android.os.RemoteException("Remote stack trace:\n\tat com.android.server.appwidget.AppWidgetServiceImpl.updateAppWidgetInstanceLocked(AppWidgetServiceImpl.java:2854)");
        remote.setStackTrace(new StackTraceElement[0]);
        refused.initCause(remote);
        RuntimeException top = new RuntimeException("Unable to start receiver lan.mordor.calendar.widget.ScrollWidgetProvider: " + refused, refused);
        top.setStackTrace(new StackTraceElement[] {new StackTraceElement("android.app.ActivityThread", "handleReceiver", "ActivityThread.java", 5410)});

        JSONObject r = CrashRecorder.describe(top, "main", "1.1.9", 37, 1L);
        assertTrue(r.getString("message").startsWith("Unable to start receiver"));
        JSONArray details = r.getJSONArray("causeDetails");
        JSONObject iae = details.getJSONObject(0);
        assertEquals("java.lang.IllegalArgumentException", iae.getString("exception"));
        assertTrue(iae.getString("message").contains("exceeds maximum bitmap memory usage (used: 20000000, max: 15552000)"));
        assertEquals("lan.mordor.calendar.widget.ScrollWidgetProvider.render(ScrollWidgetProvider.java:94)", iae.getJSONArray("frames").getString(2));
        assertTrue(details.getJSONObject(1).getString("message").contains("AppWidgetServiceImpl.updateAppWidgetInstanceLocked"));
        assertEquals("java.lang.IllegalArgumentException", r.getJSONArray("causes").getString(0));
    }

    @Test
    public void dropsTheMessageOfOurOwnExceptionsAndCutsLongMessages() throws Exception {
        IllegalStateException ours = new IllegalStateException("Dentist Meyer");
        RuntimeException framework = new RuntimeException("x".repeat(1000), ours);
        framework.setStackTrace(new StackTraceElement[] {new StackTraceElement("android.app.ActivityThread", "handleReceiver", "ActivityThread.java", 1)});
        JSONObject r = CrashRecorder.describe(framework, "main", "1.1.9", 37, 1L);
        assertFalse(r.toString().contains("Dentist"));
        assertEquals(CrashRecorder.MAX_MESSAGE, r.getString("message").length());
        JSONObject cause = r.getJSONArray("causeDetails").getJSONObject(0);
        assertFalse(cause.has("message"));
        assertTrue(cause.getJSONArray("frames").getString(0).contains("CrashRecorderTest.dropsTheMessage"));
    }

    @Test
    public void theInstalledHandlerWritesTheRecordThenCallsThePreviousHandler() throws Exception {
        Thread.UncaughtExceptionHandler before = Thread.getDefaultUncaughtExceptionHandler();
        Throwable[] seen = new Throwable[1];
        try {
            Thread.setDefaultUncaughtExceptionHandler((t, e) -> seen[0] = e);
            CrashRecorder.install(ctx);
            IllegalArgumentException boom = new IllegalArgumentException("Dentist Meyer");
            Thread.getDefaultUncaughtExceptionHandler().uncaughtException(Thread.currentThread(), boom);
            assertSame(boom, seen[0]);
            JSONArray taken = CrashReports.take(ctx, java.util.Collections.emptyList());
            assertEquals(1, taken.length());
            assertEquals("java.lang.IllegalArgumentException", taken.getJSONObject(0).getString("exception"));
            assertFalse(taken.toString().contains("Dentist"));
            assertEquals(0, CrashReports.take(ctx, java.util.Collections.emptyList()).length());
        } finally {
            Thread.setDefaultUncaughtExceptionHandler(before);
        }
    }

    @Test
    public void keepsTheLast20Records() throws Exception {
        File file = new File(ctx.getFilesDir(), CrashRecorder.FILE);
        for (int i = 0; i < 25; i++) CrashRecorder.append(file, new JSONObject().put("time", i));
        JSONArray all = CrashRecorder.readAll(file);
        assertEquals(20, all.length());
        assertEquals(5, all.getJSONObject(0).getInt("time"));
        file.delete();
    }

    @Test
    public void aCrashInAWidgetCallbackIsRecordedWithNoActivityStarted() throws Exception {
        // the Application (not the activity) installs the handler, so a widget broadcast with the app closed is covered
        assertTrue(ctx instanceof lan.mordor.calendar.CalendarApp);
        Throwable thrown = null;
        try {
            new lan.mordor.calendar.widget.WeekWidgetProvider().onUpdate(ctx, null, new int[] {1});
        } catch (Throwable t) {
            thrown = t;
        }
        assertTrue("the provider callback must throw for this test", thrown != null);
        Thread.UncaughtExceptionHandler[] previous = {Thread.getDefaultUncaughtExceptionHandler()};
        Throwable[] seen = new Throwable[1];
        try {
            Thread.setDefaultUncaughtExceptionHandler((t, e) -> seen[0] = e);
            CrashRecorder.install(ctx);
            Thread.getDefaultUncaughtExceptionHandler().uncaughtException(Thread.currentThread(), thrown);
            JSONArray taken = CrashReports.take(ctx, java.util.Collections.emptyList());
            assertEquals(1, taken.length());
            assertEquals(thrown.getClass().getName(), taken.getJSONObject(0).getString("exception"));
            assertTrue(taken.getJSONObject(0).getJSONArray("frames").getString(0).length() > 0);
        } finally {
            Thread.setDefaultUncaughtExceptionHandler(previous[0]);
        }
    }
}
