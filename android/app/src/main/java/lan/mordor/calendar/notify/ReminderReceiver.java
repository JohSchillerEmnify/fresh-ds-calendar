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
            Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_STARTED).putExtra(Reminders.EXTRA_ID, id);
            try {
                i.putExtra(EXTRA_ENTRY, e.toJson());
            } catch (JSONException ex) {
                return;
            }
            PendingIntent pi = PendingIntent.getBroadcast(ctx, startedCode(id), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Reminders.setAlarm(ctx, e.start, pi);
        }
    }

    /** The request code of the start alarm of a reminder (apart from the reminder's own alarm). */
    static int startedCode(String id) {
        return (id + "#started").hashCode();
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
            // the alarm is due at the start: never a countdown any more, even if it rings a moment early
            show(ctx, e, Math.max(System.currentTimeMillis(), e.start));
        } catch (JSONException ex) {
            // an unreadable entry leaves the countdown as it is
        }
    }

    /** Posts the notification as of now; false when notifications are not allowed. */
    private static boolean show(Context ctx, Reminders.Entry e) {
        return show(ctx, e, System.currentTimeMillis());
    }

    /** Posts the notification as of {@code now}; false when notifications are not allowed. */
    private static boolean show(Context ctx, Reminders.Entry e, long now) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        createChannel(ctx);
        NotificationManagerCompat.from(ctx).notify(e.id.hashCode(), build(ctx, e, now));
        return true;
    }

    /**
     * The notification of a reminder at {@code now}: the status bar icon of its kind (only bedtime has the moon); before
     * its start a countdown to it in the header that the system keeps current (a fixed "in 30 min" would be wrong when read
     * later), from the start on only its text; it goes away at its end. Updates of it make no second sound.
     */
    static Notification build(Context ctx, Reminders.Entry e, long now) {
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, e.id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(icon(e.kind))
            .setContentTitle(e.title)
            .setContentText(e.body.isEmpty() ? null : e.body)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tap)
            .setOnlyAlertOnce(true)
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
