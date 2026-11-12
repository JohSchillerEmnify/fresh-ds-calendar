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
 * frames (class, method, file, line), the thread name, the app and Android version and the time. A message is kept only when
 * the Android or Java framework wrote it (see {@link #fromFramework}): the system's reason for refusing a call is the decisive
 * part, while our own messages can carry a calendar title.
 */
public final class CrashRecorder {
    static final String FILE = "crash-records.jsonl";
    static final int MAX_FRAMES = 40;
    static final int MAX_CAUSES = 5;
    static final int MAX_RECORDS = 20;
    static final int MAX_MESSAGE = 300;
    private static final int MAX_CAUSE_FRAMES = 20;
    private static final String[] FRAMEWORK = {"android.", "com.android.", "java.", "javax.", "dalvik.", "libcore."};

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

    /** The record of one crash: class names, frames, and only the messages the framework wrote. */
    public static JSONObject describe(Throwable error, String thread, String app, int sdk, long timeMs) throws JSONException {
        JSONArray causes = new JSONArray();
        JSONArray details = new JSONArray();
        Throwable cause = error.getCause();
        for (int i = 0; cause != null && i < MAX_CAUSES; i++, cause = cause.getCause()) {
            causes.put(cause.getClass().getName());
            JSONObject d = new JSONObject().put("exception", cause.getClass().getName()).put("frames", frames(cause, MAX_CAUSE_FRAMES));
            if (fromFramework(cause)) d.put("message", message(cause));
            details.put(d);
        }
        JSONObject r = new JSONObject().put("source", "java").put("exception", error.getClass().getName()).put("causes", causes)
                .put("causeDetails", details).put("frames", frames(error, MAX_FRAMES)).put("thread", thread).put("app", app).put("android", sdk).put("time", timeMs);
        if (fromFramework(error)) r.put("message", message(error));
        return r;
    }

    /**
     * True when the framework threw it: its own top frame is in a framework package, or it has no frames and a framework class
     * (Parcel attaches the system's stack that way, as a frameless RemoteException).
     */
    static boolean fromFramework(Throwable t) {
        if (t.getMessage() == null) return false;
        StackTraceElement[] stack = t.getStackTrace();
        return framework(stack.length > 0 ? stack[0].getClassName() : t.getClass().getName());
    }

    private static boolean framework(String className) {
        for (String p : FRAMEWORK) if (className.startsWith(p)) return true;
        return false;
    }

    private static String message(Throwable t) {
        String m = t.getMessage();
        return m.length() > MAX_MESSAGE ? m.substring(0, MAX_MESSAGE) : m;
    }

    private static JSONArray frames(Throwable t, int max) {
        JSONArray frames = new JSONArray();
        StackTraceElement[] stack = t.getStackTrace();
        for (int i = 0; i < stack.length && i < max; i++) frames.put(stack[i].toString());
        return frames;
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
