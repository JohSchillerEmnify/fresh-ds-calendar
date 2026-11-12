package lan.mordor.calendar.crash;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Turns the exits Android keeps for the app (ActivityManager.getHistoricalProcessExitReasons, API 30+) into crash records:
 * REASON_CRASH, REASON_CRASH_NATIVE, REASON_ANR and REASON_INITIALIZATION_FAILURE. A record holds the reason name, the time
 * and, for an ANR, the Java stack frames of the main thread from the trace the system took. Nothing else of the trace (it
 * lists other apps' and the system's data) and no description text is kept.
 */
public final class ExitReasonReader {
    /** What is needed of an {@code ApplicationExitInfo}; the real one is a final class, so the plugin adapts it. */
    public interface Exit {
        int reason();
        long timestamp();
        /** The ANR trace as text, or null. */
        String trace();
    }

    static final int CRASH = 4;
    static final int CRASH_NATIVE = 5;
    static final int ANR = 6;
    static final int INITIALIZATION_FAILURE = 7;
    /** A Java crash that the recorder saw is the same death as the exit's REASON_CRASH within this window. */
    static final long SAME_CRASH_MS = 60_000;
    static final int MAX_FRAMES = 40;

    private ExitReasonReader() {}

    static String nameOf(int reason) {
        switch (reason) {
            case CRASH: return "CRASH";
            case CRASH_NATIVE: return "CRASH_NATIVE";
            case ANR: return "ANR";
            case INITIALIZATION_FAILURE: return "INITIALIZATION_FAILURE";
            default: return null;
        }
    }

    /** Records for the exits newer than {@code afterMs}, oldest first; a CRASH the Java recorder already holds is left out. */
    public static JSONArray read(List<? extends Exit> exits, long afterMs, JSONArray javaRecords) throws JSONException {
        JSONArray out = new JSONArray();
        for (int i = exits.size() - 1; i >= 0; i--) {
            Exit e = exits.get(i);
            String name = nameOf(e.reason());
            if (name == null || e.timestamp() <= afterMs) continue;
            if (e.reason() == CRASH && recorded(javaRecords, e.timestamp())) continue;
            JSONArray frames = new JSONArray();
            if (e.reason() == ANR) for (String f : mainFrames(e.trace())) frames.put(f);
            out.put(new JSONObject().put("source", "exit").put("exception", name).put("frames", frames).put("time", e.timestamp()));
        }
        return out;
    }

    /** The newest exit time in the list (0 when empty): the next start asks only for later ones. */
    public static long newest(List<? extends Exit> exits) {
        long newest = 0;
        for (Exit e : exits) newest = Math.max(newest, e.timestamp());
        return newest;
    }

    private static boolean recorded(JSONArray javaRecords, long ts) {
        for (int i = 0; i < javaRecords.length(); i++) {
            if (Math.abs(javaRecords.optJSONObject(i).optLong("time") - ts) <= SAME_CRASH_MS) return true;
        }
        return false;
    }

    /** The {@code at ...} lines of the section that starts with {@code "main"}, up to the next thread. */
    static String[] mainFrames(String trace) {
        if (trace == null) return new String[0];
        java.util.ArrayList<String> frames = new java.util.ArrayList<>();
        boolean inMain = false;
        for (String line : trace.split("\n")) {
            String s = line.trim();
            if (s.startsWith("\"")) inMain = s.startsWith("\"main\"");
            else if (inMain && s.startsWith("at ") && frames.size() < MAX_FRAMES) frames.add(s.substring(3));
        }
        return frames.toArray(new String[0]);
    }
}
