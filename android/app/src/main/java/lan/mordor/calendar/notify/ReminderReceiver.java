package lan.mordor.calendar.notify;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import lan.mordor.calendar.MainActivity;
import lan.mordor.calendar.R;
import org.json.JSONException;

/**
 * Shows a due reminder as a notification, and sets the stored alarms again after a reboot or an app update. While the
 * app is in the foreground the notification is skipped: the web app shows the same reminder as a snackbar then.
 * A reminder with a start counts down to it; at the start an alarm puts the same notification up again with only its
 * text (no countdown, silently), and the system removes it at the end (owner 2026-10-23).
 */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION_FIRE = "lan.mordor.calendar.REMINDER_FIRE";
    static final String ACTION_STARTED = "lan.mordor.calendar.REMINDER_STARTED";
    /** The shown reminder as JSON, carried by the {@link #ACTION_STARTED} alarm (it is no longer stored then). */
    static final String EXTRA_ENTRY = "lan.mordor.calendar.REMINDER_ENTRY";
    static final String CHANNEL = "reminders";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Reminders.rescheduleAll(ctx);
            return;
        }
        String id = intent.getStringExtra(Reminders.EXTRA_ID);
        if (id == null) return;
        if (ACTION_STARTED.equals(action)) {
            started(ctx, id, intent.getStringExtra(EXTRA_ENTRY));
            return;
        }
        if (!ACTION_FIRE.equals(action)) return;
        Reminders.Entry e = Reminders.get(ctx, id);
        Reminders.remove(ctx, id);
        if (e == null || MainActivity.isInForeground()) return;
        if (!show(ctx, e)) return;
        // at the start the countdown gives way to the plain text, until the end
        long now = System.currentTimeMillis();
        if (e.start > now && e.end > e.start) {
            try {
                Reminders.setAlarm(ctx, e.start, startedAlarm(ctx, id, e.toJson()));
            } catch (JSONException ex) {
                // without the entry the countdown simply stays until the end
            }
        }
    }

    /**
     * The start alarm of a reminder (apart from its own alarm: another request code). A {@code null} entry gives the same
     * PendingIntent for cancelling it (extras do not count when PendingIntents are matched).
     */
    static PendingIntent startedAlarm(Context ctx, String id, String entryJson) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_STARTED).putExtra(Reminders.EXTRA_ID, id);
        if (entryJson != null) i.putExtra(EXTRA_ENTRY, entryJson);
        return PendingIntent.getBroadcast(ctx, (id + "#started").hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** The start has come: a notification still shown is put up again without the countdown; a dismissed one stays gone. */
    private static void started(Context ctx, String id, String json) {
        if (json == null) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        boolean shown = false;
        for (StatusBarNotification sbn : nm.getActiveNotifications()) if (sbn.getId() == id.hashCode()) shown = true;
        if (!shown) return;
        try {
            Reminders.Entry e = Reminders.Entry.fromJson(id, json);
            long now = System.currentTimeMillis();
            // a start alarm that comes after the end (the phone was off): the item is over, so is its notification
            if (e.end > 0 && now >= e.end) {
                NotificationManagerCompat.from(ctx).cancel(id.hashCode());
                return;
            }
            // the alarm is due at the start: never a countdown any more, even if it rings a moment early; no second sound
            show(ctx, e, Math.max(now, e.start), true);
        } catch (JSONException ex) {
            // an unreadable entry leaves the countdown as it is
        }
    }

    /** Posts the notification as of now; false when notifications are not allowed. */
    private static boolean show(Context ctx, Reminders.Entry e) {
        return show(ctx, e, System.currentTimeMillis(), false);
    }

    /** Posts the notification as of {@code now} ({@code quiet}: an update without sound); false when notifications are not allowed. */
    private static boolean show(Context ctx, Reminders.Entry e, long now, boolean quiet) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        createChannel(ctx);
        NotificationManagerCompat.from(ctx).notify(e.id.hashCode(), build(ctx, e, now, quiet));
        return true;
    }

    /**
     * The notification of a reminder at {@code now}: the status bar icon of its kind (only bedtime has the moon); before
     * its start a countdown to it in the header that the system keeps current (a fixed "in 30 min" would be wrong when read
     * later), from the start on only its text; it goes away at its end. A {@code quiet} one (the re-post at the start)
     * makes no second sound; every new reminder alerts, also one that replaces yesterday's of the same id.
     */
    static Notification build(Context ctx, Reminders.Entry e, long now, boolean quiet) {
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, e.id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(icon(e.kind))
            .setContentTitle(e.title)
            .setContentText(e.body.isEmpty() ? null : e.body)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tap)
            .setOnlyAlertOnce(quiet)
            .setAutoCancel(true);
        if (e.start > now) {
            n.setWhen(e.start).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true);
        } else {
            n.setShowWhen(false);
        }
        if (e.end > now) n.setTimeoutAfter(e.end - now);
        return n.build();
    }

    /** The status bar icon of a kind: calendar page, checklist, sunrise, moon. */
    private static int icon(String kind) {
        switch (kind) {
            case "tasklist": return R.drawable.ic_stat_tasklist;
            case "summary": return R.drawable.ic_stat_summary;
            case "bedtime": return R.drawable.ic_stat_bedtime;
            default: return R.drawable.ic_stat_event;
        }
    }

    /** The one channel "Reminders" (Android 8+); its name follows the system language. */
    static void createChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, ctx.getString(R.string.reminder_channel), NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription(ctx.getString(R.string.reminder_channel_description));
        ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
}
