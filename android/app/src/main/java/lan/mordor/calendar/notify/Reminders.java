package lan.mordor.calendar.notify;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Pending reminders of the web app (feature android-app, feature reminders): stored in SharedPreferences
 * ({@code calendar_reminders}, one JSON entry per id) so they survive a reboot, and set as alarms that fire
 * {@link ReminderReceiver}. One pending reminder per id; scheduling an id again replaces it.
 */
public final class Reminders {
    private static final String PREFS = "calendar_reminders";
    static final String EXTRA_ID = "lan.mordor.calendar.REMINDER_ID";

    private Reminders() {}

    /** One reminder: when it is due (epoch ms) and its notification text. */
    public static final class Entry {
        public final String id;
        public final long at;
        public final String title;
        public final String body;

        Entry(String id, long at, String title, String body) {
            this.id = id;
            this.at = at;
            this.title = title;
            this.body = body;
        }

        String toJson() throws JSONException {
            return new JSONObject().put("at", at).put("title", title).put("body", body).toString();
        }

        static Entry fromJson(String id, String json) throws JSONException {
            JSONObject o = new JSONObject(json);
            return new Entry(id, o.getLong("at"), o.getString("title"), o.optString("body", ""));
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Stores the reminder and sets its alarm (replacing an earlier one with the same id). */
    public static void schedule(Context ctx, Entry e) throws JSONException {
        prefs(ctx).edit().putString(e.id, e.toJson()).apply();
        setAlarm(ctx, e);
    }

    /** Removes the reminder and its alarm. */
    public static void cancel(Context ctx, String id) {
        prefs(ctx).edit().remove(id).apply();
        alarms(ctx).cancel(pendingIntent(ctx, id));
    }

    /** The ids of every stored reminder (the web app cancels the ones its current plan no longer holds). */
    public static List<String> ids(Context ctx) {
        return new ArrayList<>(prefs(ctx).getAll().keySet());
    }

    /** The stored reminder with this id, or null. */
    static Entry get(Context ctx, String id) {
        String json = prefs(ctx).getString(id, null);
        if (json == null) return null;
        try {
            return Entry.fromJson(id, json);
        } catch (JSONException ex) {
            return null;
        }
    }

    /** Forgets a reminder that has fired (its alarm is gone already). */
    static void remove(Context ctx, String id) {
        prefs(ctx).edit().remove(id).apply();
    }

    /** Sets the alarms of all stored reminders again (after a reboot or an app update, which clear alarms). */
    static void rescheduleAll(Context ctx) {
        for (String id : prefs(ctx).getAll().keySet()) {
            Entry e = get(ctx, id);
            if (e != null) setAlarm(ctx, e);
        }
    }

    private static AlarmManager alarms(Context ctx) {
        return (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
    }

    private static PendingIntent pendingIntent(Context ctx, String id) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ReminderReceiver.ACTION_FIRE).putExtra(EXTRA_ID, id);
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Exact while idle when the app may (USE_EXACT_ALARM from Android 13, SCHEDULE_EXACT_ALARM before, both declared:
     * a calendar's reminders are what they are for), else inexact (Doze may delay it by some minutes). A time in the past
     * fires at once, so a reminder missed while the phone was off still shows after the reboot.
     */
    private static void setAlarm(Context ctx, Entry e) {
        AlarmManager am = alarms(ctx);
        PendingIntent pi = pendingIntent(ctx, e.id);
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, e.at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, e.at, pi);
    }
}
