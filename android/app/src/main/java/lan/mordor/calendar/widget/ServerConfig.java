package lan.mordor.calendar.widget;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * The calendar server of the app and the widget (feature android-app). Configuration, not a choice: always the public
 * instance (owner 2026-10-23, ADR 0022; the first-start chooser between it and the home-network server is gone). The app
 * loads it, the widget calls its API.
 */
public final class ServerConfig {
    /** The public instance, reached from anywhere over HTTPS. */
    public static final String BASE_URL = "https://cal.example.org";
    /** Where the app with the chooser kept the choice. */
    static final String LEGACY_PREFS = "calendar_server";

    private ServerConfig() {}

    /**
     * Once after the update from an app that let the person choose: forgets that choice and the widget's data, which may
     * be the home-network server's week and snapshot, so the widget shows this server's week after the next fetch.
     *
     * @return whether there was a choice to forget
     */
    static boolean forgetLegacyChoice(Context context) {
        SharedPreferences legacy = context.getApplicationContext().getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE);
        if (legacy.getAll().isEmpty()) return false;
        new WidgetStore(context).clearAll();
        legacy.edit().clear().apply();
        return true;
    }
}
