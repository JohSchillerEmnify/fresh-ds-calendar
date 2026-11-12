package lan.mordor.calendar.crash;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import java.util.Arrays;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** Exits Android reports (API 30+) become records once; a Java crash the recorder holds is not doubled. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class ExitReasonReaderTest {
    private final Context ctx = ApplicationProvider.getApplicationContext();

    private static ExitReasonReader.Exit exit(int reason, long ts, String trace) {
        return new ExitReasonReader.Exit() {
            @Override public int reason() { return reason; }
            @Override public long timestamp() { return ts; }
            @Override public String trace() { return trace; }
        };
    }

    private static final String TRACE = "----- pid 1 -----\nCmd line: lan.mordor.calendar\n\n\"main\" prio=5 tid=1 Blocked\n"
            + "  | group=\"main\" sCount=1\n  at android.os.MessageQueue.nativePollOnce(Native method)\n"
            + "  at lan.mordor.calendar.widget.WeekFetcher.fetch(WeekFetcher.java:50)\n\n\"Binder:1_1\" prio=5\n  at other.Thread.run(Thread.java:1)\n";

    @Test
    public void reportsCrashesAndANRsSinceTheLastStartOnce() throws Exception {
        // newest first, as the system lists them; reason 10 (user request) is not a failure and is not recorded
        List<ExitReasonReader.Exit> exits = Arrays.asList(exit(5, 3000, null), exit(6, 2000, TRACE), exit(10, 1500, null), exit(6, 500, TRACE));
        JSONArray first = CrashReports.take(ctx, exits);
        assertEquals(3, first.length());
        assertEquals("ANR", first.getJSONObject(0).getString("exception"));
        assertEquals("ANR", first.getJSONObject(1).getString("exception"));
        assertEquals("CRASH_NATIVE", first.getJSONObject(2).getString("exception"));
        JSONArray frames = first.getJSONObject(1).getJSONArray("frames");
        assertEquals(2, frames.length());
        assertEquals("lan.mordor.calendar.widget.WeekFetcher.fetch(WeekFetcher.java:50)", frames.getString(1));
        assertFalse(first.toString().contains("other.Thread"));
        assertEquals(0, CrashReports.take(ctx, exits).length());
        assertEquals(1, CrashReports.take(ctx, Arrays.asList(exit(5, 4000, null), exits.get(0))).length());
    }

    @Test
    public void aJavaCrashTheRecorderHoldsIsNotReportedTwice() throws Exception {
        JSONArray java = new JSONArray().put(new JSONObject().put("time", 10_000));
        JSONArray out = ExitReasonReader.read(Arrays.asList(exit(4, 12_000, null), exit(4, 500_000, null)), 0, java);
        assertEquals(1, out.length());
        assertEquals(500_000, out.getJSONObject(0).getLong("time"));
    }
}
