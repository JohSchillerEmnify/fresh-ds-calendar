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
        return ReminderReceiver.build(ctx, new Reminders.Entry(id, START - 30 * 60_000L, "Dentist", "11:00 – 11:30", kind, start, start > 0 ? END : 0), BEFORE, false);
    }

    private Notification build(Reminders.Entry e) {
        return ReminderReceiver.build(ctx, e, BEFORE, false);
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
        Notification n = ReminderReceiver.build(ctx, e, START + 60_000L, true);
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
        Notification after = shadowOf(nm).getNotification("reminder:c".hashCode());
        assertFalse(after.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        // the re-post at the start makes no second sound
        assertTrue((after.flags & Notification.FLAG_ONLY_ALERT_ONCE) != 0);
        // dismissed before the start: it stays gone
        nm.cancelAll();
        new ReminderReceiver().onReceive(ctx, startedIntent);
        assertNull(shadowOf(nm).getNotification("reminder:c".hashCode()));
    }

    /** Fires a stored reminder the way its alarm does. */
    private void fire(String id) {
        new ReminderReceiver().onReceive(ctx, new Intent(ReminderReceiver.ACTION_FIRE).putExtra(Reminders.EXTRA_ID, id));
    }

    /** The intent of the start alarm of a reminder, as scheduled. */
    private Intent startAlarmAt(long start) {
        for (ShadowAlarmManager.ScheduledAlarm alarm : shadowOf(ctx.getSystemService(AlarmManager.class)).getScheduledAlarms()) {
            if (alarm.getTriggerAtMs() == start) return shadowOf(alarm.operation).getSavedIntent();
        }
        return null;
    }

    @Test
    public void everyNewReminderAlertsAlsoTheNextMorningOverview() throws JSONException {
        shadowOf((Application) ctx).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        long now = System.currentTimeMillis();
        for (String title : new String[] { "Your day", "Your next day" }) {
            Reminders.schedule(ctx, new Reminders.Entry("morning", now, title, "1 appointment", "summary", 0, 0));
            fire("morning");
            Notification n = shadowOf(nm).getNotification("morning".hashCode());
            assertEquals(title, n.extras.getString(Notification.EXTRA_TITLE));
            assertEquals(0, n.flags & Notification.FLAG_ONLY_ALERT_ONCE);
        }
    }

    @Test
    public void cancellingAShownReminderRemovesItsNotificationAndItsStartAlarm() throws JSONException {
        shadowOf((Application) ctx).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        long now = System.currentTimeMillis();
        long start = now + 30 * 60_000L;
        Reminders.schedule(ctx, new Reminders.Entry("reminder:d", now, "Dentist", "11:00 – 11:30", "event", start, start + 30 * 60_000L));
        fire("reminder:d");
        assertNotNull(startAlarmAt(start));
        Reminders.cancel(ctx, "reminder:d");
        assertNull(shadowOf(nm).getNotification("reminder:d".hashCode()));
        assertNull(startAlarmAt(start));
    }

    @Test
    public void aStartAlarmAfterTheEndRemovesTheNotification() throws JSONException {
        shadowOf((Application) ctx).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        long now = System.currentTimeMillis();
        Reminders.schedule(ctx, new Reminders.Entry("reminder:e", now, "Dentist", "11:00 – 11:30", "event", now + 60_000L, now + 120_000L));
        fire("reminder:e");
        assertNotNull(shadowOf(nm).getNotification("reminder:e".hashCode()));
        // the phone was off from before the start until after the end
        Reminders.Entry over = new Reminders.Entry("reminder:e", now - 7_200_000L, "Dentist", "11:00 – 11:30", "event", now - 3_600_000L, now - 1_800_000L);
        new ReminderReceiver().onReceive(ctx, new Intent(ReminderReceiver.ACTION_STARTED).putExtra(Reminders.EXTRA_ID, "reminder:e").putExtra(ReminderReceiver.EXTRA_ENTRY, over.toJson()));
        assertNull(shadowOf(nm).getNotification("reminder:e".hashCode()));
    }

    @Test
    public void theBedtimeReminderCountsDownToBedtimeThenStaysUntilWakeUp() throws JSONException {
        shadowOf((Application) ctx).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        long now = System.currentTimeMillis();
        long bedtime = now + 30 * 60_000L;
        long wake = bedtime + 8 * 3_600_000L;
        Reminders.schedule(ctx, new Reminders.Entry("bedtime", now, "Bedtime at 23:00", "", "bedtime", bedtime, wake));
        fire("bedtime");
        Notification before = shadowOf(nm).getNotification("bedtime".hashCode());
        assertEquals(R.drawable.ic_stat_bedtime, icon(before));
        assertTrue(before.extras.getBoolean(Notification.EXTRA_CHRONOMETER_COUNT_DOWN));
        assertEquals(bedtime, before.when);
        Intent started = startAlarmAt(bedtime);
        assertNotNull(started);
        new ReminderReceiver().onReceive(ctx, started);
        Notification after = shadowOf(nm).getNotification("bedtime".hashCode());
        assertFalse(after.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        assertEquals("Bedtime at 23:00", after.extras.getString(Notification.EXTRA_TITLE));
        // removed by the system at wake-up (the re-post is built as of bedtime)
        assertEquals(wake - bedtime, after.getTimeoutAfter());
    }
}
