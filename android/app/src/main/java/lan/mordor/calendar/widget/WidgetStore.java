package lan.mordor.calendar.widget;

import android.content.Context;
import android.content.SharedPreferences;
import java.time.LocalDate;
import org.json.JSONObject;

/**
 * The widget's persistent state in SharedPreferences: the app's snapshot, the last week fetched from the API and how
 * the last fetch went. The fetched week is kept as {@code {weekStart, items}} with the API's raw items.
 */
final class WidgetStore {
    /** Last fetch outcome: the session is gone and the person has to open the app. */
    static final String AUTH_SIGN_IN = "signin";
    static final String AUTH_OK = "ok";

    private static final String PREFS = "calendar_widget";
    private final SharedPreferences prefs;

    WidgetStore(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    void saveSnapshot(String json) {
        prefs.edit().putString("snapshot", json).putLong("snapshotAt", System.currentTimeMillis()).apply();
    }

    long snapshotAtMillis() {
        return prefs.getLong("snapshotAt", 0);
    }

    /** Drops the snapshot, the fetched week and the fetch state (the server changed). */
    void clearAll() {
        prefs.edit().clear().apply();
    }

    /** The snapshot as written by the app, or null. */
    JSONObject snapshot() {
        return parse(prefs.getString("snapshot", null));
    }

    /** Stores a fetched week and marks the fetch as successful. */
    void saveFetched(String weekJson, long atMillis) {
        prefs.edit().putString("fetched", weekJson).putLong("fetchedAt", atMillis).putString("auth", AUTH_OK).apply();
    }

    JSONObject fetched() {
        return parse(prefs.getString("fetched", null));
    }

    long fetchedAtMillis() {
        return prefs.getLong("fetchedAt", 0);
    }

    void setAuth(String auth) {
        prefs.edit().putString("auth", auth).apply();
    }

    String auth() {
        return prefs.getString("auth", AUTH_OK);
    }

    /** The week the fetched data is for, or null. */
    static LocalDate weekOf(JSONObject week) {
        try {
            return week == null ? null : LocalDate.parse(week.getString("weekStart"));
        } catch (Exception e) {
            return null;
        }
    }

    private static JSONObject parse(String json) {
        try {
            return json == null ? null : new JSONObject(json);
        } catch (Exception e) {
            return null;
        }
    }
}
