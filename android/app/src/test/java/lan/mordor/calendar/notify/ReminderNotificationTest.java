package lan.mordor.calendar.notify;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.test.core.app.ApplicationProvider;
import lan.mordor.calendar.R;
import org.json.JSONException;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;

/**
 * The phone notification of a reminder (feature android-app): each kind has its own status bar icon (only bedtime the
 * moon), and a reminder with a start counts down to it live, so it is right whenever it is read (owner 2026-10-23).
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class ReminderNotificationTest {
    private static final long START = 1_792_000_000_000L;
    private final Context ctx = ApplicationProvider.getApplicationContext();

    private static final long END = START + 30 * 60_000L;
    private static final long BEFORE = START - 20 * 60_000L;

    private Notification build(String id, String kind, long start) {
        return ReminderReceiver.build(ctx, new Reminders.Entry(id, START - 30 * 60_000L, "Dentist", "11:00 – 11:30", kind, start, start > 0 ? END : 0), BEFORE);
    }

    private Notification build(Reminders.Entry e) {
        return ReminderReceiver.build(ctx, e, BEFORE);
    }

    private static int icon(Notification n) {
        return n.getSmallIcon().getResId();
    }

    @Test
    public void eachKindHasItsOwnStatusBarIcon() {
        assertEquals(R.drawable.ic_stat_event, icon(build("reminder:a", "event", START)));
        assertEquals(R.drawable.ic_stat_tasklist, icon(build("reminder:b", "tasklist", START)));
        assertEquals(R.drawable.ic_stat_summary, icon(build("morning", "summary", 0)));
        assertEquals(R.drawable.ic_stat_bedtime, icon(build("bedtime", "bedtime", START)));
    }

    @Test
    public void aReminderWithAStartCountsDownToIt() {
        Notification n = build("reminder:a", "event", START);
        assertEquals(START, n.when);
        // and goes away at the end
        assertEquals(END - BEFORE, n.getTimeoutAfter());
        assertTrue(n.extras.getBoolean(NotificationCompat.EXTRA_SHOW_WHEN));
        assertTrue(n.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        assertTrue(n.extras.getBoolean(Notification.EXTRA_CHRONOMETER_COUNT_DOWN));
        assertEquals("Dentist", n.extras.getString(Notification.EXTRA_TITLE));
        assertEquals("11:00 – 11:30", String.valueOf(n.extras.getCharSequence(Notification.EXTRA_TEXT)));
    }

    @Test
    public void aReminderWithoutAStartHasNoCountdown() {
        Notification n = build("morning", "summary", 0);
        assertFalse(n.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        assertEquals(0, n.getTimeoutAfter());
    }

    @Test
    public void fromTheStartOnItShowsOnlyItsTextUntilTheEnd() {
        Reminders.Entry e = new Reminders.Entry("reminder:a", START - 30 * 60_000L, "Dentist", "11:00 – 11:30", "event", START, END);
        Notification n = ReminderReceiver.build(ctx, e, START + 60_000L);
        assertFalse(n.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        assertFalse(n.extras.getBoolean(NotificationCompat.EXTRA_SHOW_WHEN));
        assertEquals("11:00 – 11:30", String.valueOf(n.extras.getCharSequence(Notification.EXTRA_TEXT)));
        assertEquals(END - START - 60_000L, n.getTimeoutAfter());
    }

    @Test
    public void aReminderStoredWithoutAKindTakesTheIconOfItsId() throws JSONException {
        // stored by an older web bundle: { at, title, body } only
        assertEquals(R.drawable.ic_stat_bedtime, icon(build(Reminders.Entry.fromJson("bedtime", "{\"at\":1,\"title\":\"Bedtime in 30 minutes\",\"body\":\"\"}"))));
        assertEquals(R.drawable.ic_stat_summary, icon(build(Reminders.Entry.fromJson("morning", "{\"at\":1,\"title\":\"Your day\",\"body\":\"\"}"))));
        Reminders.Entry old = Reminders.Entry.fromJson("reminder:x", "{\"at\":1,\"title\":\"Dentist starts in 30 min\",\"body\":\"11:00\"}");
        assertEquals(R.drawable.ic_stat_event, icon(build(old)));
        assertFalse(build(old).extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
    }

    @Test
    public void kindAndStartSurviveStorage() throws JSONException {
        Reminders.Entry e = new Reminders.Entry("reminder:b", 5, "Taxes", "11:00 – 11:30", "tasklist", START, END);
        Reminders.Entry back = Reminders.Entry.fromJson(e.id, e.toJson());
        assertEquals("tasklist", back.kind);
        assertEquals(START, back.start);
        assertEquals(END, back.end);
    }

    @Test
    public void whenDueItCountsDownAndAtTheStartComesBackWithoutTheCountdown() throws JSONException {
        shadowOf((Application) ctx).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        long now = System.currentTimeMillis();
        long start = now + 30 * 60_000L;
        Reminders.schedule(ctx, new Reminders.Entry("reminder:c", now, "Dentist", "11:00 – 11:30", "event", start, start + 30 * 60_000L));
        new ReminderReceiver().onReceive(ctx, new Intent(ReminderReceiver.ACTION_FIRE).putExtra(Reminders.EXTRA_ID, "reminder:c"));
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        assertTrue(shadowOf(nm).getNotification("reminder:c".hashCode()).extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        // an alarm at the start (the reminder's own alarm, already fired, is still listed by the shadow)
        Intent startedIntent = null;
        for (ShadowAlarmManager.ScheduledAlarm alarm : shadowOf(ctx.getSystemService(AlarmManager.class)).getScheduledAlarms()) {
            if (alarm.getTriggerAtMs() == start) startedIntent = shadowOf(alarm.operation).getSavedIntent();
        }
        assertNotNull(startedIntent);
        assertEquals(ReminderReceiver.ACTION_STARTED, startedIntent.getAction());
        new ReminderReceiver().onReceive(ctx, startedIntent);
        assertFalse(shadowOf(nm).getNotification("reminder:c".hashCode()).extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        // dismissed before the start: it stays gone
        nm.cancelAll();
        new ReminderReceiver().onReceive(ctx, startedIntent);
        assertNull(shadowOf(nm).getNotification("reminder:c".hashCode()));
    }
}
