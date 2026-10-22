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
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import lan.mordor.calendar.MainActivity;
import lan.mordor.calendar.R;

/**
 * Shows a due reminder as a notification, and sets the stored alarms again after a reboot or an app update. While the
 * app is in the foreground the notification is skipped: the web app shows the same reminder as a snackbar then.
 */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION_FIRE = "lan.mordor.calendar.REMINDER_FIRE";
    static final String CHANNEL = "reminders";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Reminders.rescheduleAll(ctx);
            return;
        }
        if (!ACTION_FIRE.equals(action)) return;
        String id = intent.getStringExtra(Reminders.EXTRA_ID);
        if (id == null) return;
        Reminders.Entry e = Reminders.get(ctx, id);
        Reminders.remove(ctx, id);
        if (e == null || MainActivity.isInForeground()) return;
        show(ctx, e);
    }

    private static void show(Context ctx, Reminders.Entry e) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        createChannel(ctx);
        NotificationManagerCompat.from(ctx).notify(e.id.hashCode(), build(ctx, e));
    }

    /**
     * The notification of a reminder: the status bar icon of its kind (only bedtime has the moon) and, when it has a start,
     * a countdown to it in the header that the system keeps current — a fixed "in 30 min" would be wrong when read later.
     */
    static Notification build(Context ctx, Reminders.Entry e) {
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, e.id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(icon(e.kind))
            .setContentTitle(e.title)
            .setContentText(e.body.isEmpty() ? null : e.body)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tap)
            .setAutoCancel(true);
        if (e.start > 0) {
            n.setWhen(e.start).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true);
        }
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
