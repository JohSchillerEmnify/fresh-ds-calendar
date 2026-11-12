package lan.mordor.calendar.crash;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;

/** The records the web app takes at its start: the recorder's file plus the exits Android reports since the last take. */
public final class CrashReports {
    static final String PREFS = "crash_reports";
    static final String LAST_EXIT = "lastExitMs";
    private static final int MAX_TRACE_BYTES = 200_000;

    private CrashReports() {}

    /** Hands over every record not handed over before, oldest first, and forgets them natively. */
    public static JSONArray take(Context context) throws JSONException {
        return take(context, Build.VERSION.SDK_INT >= 30 ? systemExits(context) : new ArrayList<>());
    }

    static JSONArray take(Context context, List<? extends ExitReasonReader.Exit> exits) throws JSONException {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray java = CrashRecorder.drain(new java.io.File(context.getFilesDir(), CrashRecorder.FILE));
        JSONArray all = ExitReasonReader.read(exits, prefs.getLong(LAST_EXIT, 0), java);
        for (int i = 0; i < java.length(); i++) all.put(java.get(i));
        long newest = ExitReasonReader.newest(exits);
        if (newest > prefs.getLong(LAST_EXIT, 0)) prefs.edit().putLong(LAST_EXIT, newest).apply();
        return all;
    }

    /** {@code getHistoricalProcessExitReasons(null, 0, 0)}: all records of the app's package, newest first, from a ring buffer. */
    private static List<ExitReasonReader.Exit> systemExits(Context context) {
        List<ExitReasonReader.Exit> out = new ArrayList<>();
        try {
            ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            for (ApplicationExitInfo info : am.getHistoricalProcessExitReasons(null, 0, 0)) {
                out.add(new ExitReasonReader.Exit() {
                    @Override public int reason() { return info.getReason(); }
                    @Override public long timestamp() { return info.getTimestamp(); }
                    @Override public String trace() { return info.getReason() == ApplicationExitInfo.REASON_ANR ? traceOf(info) : null; }
                });
            }
        } catch (RuntimeException ignored) {
            // the system may throttle the call; the exits are still there at the next start
        }
        return out;
    }

    private static String traceOf(ApplicationExitInfo info) {
        try (InputStream in = info.getTraceInputStream()) {
            if (in == null) return null;
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            for (int n; buf.size() < MAX_TRACE_BYTES && (n = in.read(chunk)) > 0; ) buf.write(chunk, 0, n);
            return buf.toString("UTF-8");
        } catch (Exception e) {
            return null;
        }
    }
}
