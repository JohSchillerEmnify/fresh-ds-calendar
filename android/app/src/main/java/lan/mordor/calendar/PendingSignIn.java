package lan.mordor.calendar;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Keeps the verifier of the running Google sign-in (see {@link AppSignIn}) between the start of the sign-in in the system
 * browser and the deep link that brings the app back. It lives in the app's private preferences (not in backups, see the
 * manifest) and is cleared as soon as the link is used.
 */
final class PendingSignIn {
    private static final String PREFS = "pending-sign-in";
    private static final String KEY = "verifier";

    private PendingSignIn() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Remembers the verifier of a sign-in that is about to start, replacing an older unfinished one. */
    static void save(Context context, String verifier) {
        prefs(context).edit().putString(KEY, verifier).apply();
    }

    /** The verifier of the pending sign-in, or null when none was started. */
    static String peek(Context context) {
        return prefs(context).getString(KEY, null);
    }

    /** Forgets the verifier: its sign-in is done. */
    static void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
    }
}
