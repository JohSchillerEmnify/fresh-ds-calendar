package lan.mordor.calendar.crash;

import android.content.Context;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Writes a Java crash of the app process (the widgets run in it) to a file before the process dies; the web app picks the
 * records up at its next start ({@link CrashReports}). A record holds the exception class, its causes' classes, the stack
 * frames (class, method, file, line), the thread name, the app and Android version and the time. The exception message is
 * never recorded: it can carry a calendar title.
 */
public final class CrashRecorder {
    static final String FILE = "crash-records.jsonl";
    static final int MAX_FRAMES = 40;
    static final int MAX_CAUSES = 5;
    static final int MAX_RECORDS = 20;

    private CrashRecorder() {}

    /** Chains in front of the handler that was installed before, which still ends the process the usual way. */
    public static void install(Context context) {
        File file = new File(context.getFilesDir(), FILE);
        String app = versionOf(context);
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                append(file, describe(error, thread.getName(), app, android.os.Build.VERSION.SDK_INT, System.currentTimeMillis()));
            } catch (Throwable ignored) {
                // recording must never hide the crash itself
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    private static String versionOf(Context context) {
        try {
            return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    /** The record of one crash: no message text, only class names and frames. */
    public static JSONObject describe(Throwable error, String thread, String app, int sdk, long timeMs) throws JSONException {
        JSONArray causes = new JSONArray();
        Throwable cause = error.getCause();
        for (int i = 0; cause != null && i < MAX_CAUSES; i++, cause = cause.getCause()) causes.put(cause.getClass().getName());
        JSONArray frames = new JSONArray();
        StackTraceElement[] stack = error.getStackTrace();
        for (int i = 0; i < stack.length && i < MAX_FRAMES; i++) frames.put(stack[i].toString());
        return new JSONObject().put("source", "java").put("exception", error.getClass().getName()).put("causes", causes)
                .put("frames", frames).put("thread", thread).put("app", app).put("android", sdk).put("time", timeMs);
    }

    static synchronized void append(File file, JSONObject record) throws IOException {
        JSONArray kept = readAll(file);
        kept.put(record);
        try (FileWriter out = new FileWriter(file, false)) {
            for (int i = Math.max(0, kept.length() - MAX_RECORDS); i < kept.length(); i++) out.write(kept.opt(i) + "\n");
        }
    }

    /** The records in the file, oldest first; an unreadable line is skipped. */
    static synchronized JSONArray readAll(File file) {
        JSONArray all = new JSONArray();
        if (!file.exists()) return all;
        try (java.io.BufferedReader in = new java.io.BufferedReader(new java.io.FileReader(file))) {
            for (String line; (line = in.readLine()) != null; ) {
                try {
                    all.put(new JSONObject(line));
                } catch (JSONException ignored) {
                    // a half-written last line from a dying process
                }
            }
        } catch (IOException ignored) {
            // no readable file: nothing recorded
        }
        return all;
    }

    /** Returns the records and empties the file. */
    static synchronized JSONArray drain(File file) {
        JSONArray all = readAll(file);
        file.delete();
        return all;
    }
}
