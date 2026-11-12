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
