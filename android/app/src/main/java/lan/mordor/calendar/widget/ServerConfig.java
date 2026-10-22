package lan.mordor.calendar.widget;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Arrays;
import java.util.List;

/**
 * The calendar server the person chose on the first start (feature android-app): the
 * one place that knows the two servers on offer and which one is stored. The app loads it, the widget calls its API.
 */
public final class ServerConfig {
    /** The public instance, reached from anywhere over HTTPS. */
    public static final String FRESH = "https://cal.example.org";
    /** The home-network instance (plain HTTP, allowed for this host only by the network security config). */
    public static final String MORDOR = "http://cal.mordor.lan";
    /** The servers on offer, recommended first. A stored or requested URL must be one of these. */
    public static final List<String> OFFERED = Arrays.asList(FRESH, MORDOR);

    private static final String PREFS = "calendar_server";
    private static final String KEY = "baseUrl";

    private ServerConfig() {}

    /** The chosen server's base URL without a trailing slash, or null while nothing is chosen (first start). */
    public static String baseUrl(Context context) {
        String url = prefs(context).getString(KEY, null);
        return url != null && OFFERED.contains(url) ? url : null;
    }

    /** Whether {@code url} is one of the two servers on offer. */
    public static boolean isOffered(String url) {
        return url != null && OFFERED.contains(url);
    }

    /**
     * Stores the choice. The widget's cached week and snapshot belong to the previous server, so they are dropped and the
     * widgets are redrawn and refreshed from the new one.
     *
     * @param url one of {@link #OFFERED}
     * @throws IllegalArgumentException for any other URL
     */
    public static void choose(Context context, String url) {
        if (!isOffered(url)) throw new IllegalArgumentException("not an offered server: " + url);
        if (url.equals(baseUrl(context))) return;
        prefs(context).edit().putString(KEY, url).apply();
        WeekWidgetProvider.onServerChanged(context);
    }

    /** Forgets the choice (the app shows the chooser again) and drops the widget's data of the old server. */
    public static void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
        WeekWidgetProvider.onServerChanged(context);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
