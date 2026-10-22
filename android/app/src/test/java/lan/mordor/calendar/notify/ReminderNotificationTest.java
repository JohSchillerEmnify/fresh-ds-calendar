package lan.mordor.calendar.notify;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.app.Notification;
import android.content.Context;
import androidx.core.app.NotificationCompat;
import androidx.test.core.app.ApplicationProvider;
import lan.mordor.calendar.R;
import org.json.JSONException;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * The phone notification of a reminder (feature android-app): each kind has its own status bar icon (only bedtime the
 * moon), and a reminder with a start counts down to it live, so it is right whenever it is read (owner 2026-10-23).
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class ReminderNotificationTest {
    private static final long START = 1_792_000_000_000L;
    private final Context ctx = ApplicationProvider.getApplicationContext();

    private Notification build(String id, String kind, long start) {
        return ReminderReceiver.build(ctx, new Reminders.Entry(id, START - 30 * 60_000L, "Dentist", "11:00 – 11:30", kind, start));
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
    }

    @Test
    public void aReminderStoredWithoutAKindTakesTheIconOfItsId() throws JSONException {
        // stored by an older web bundle: { at, title, body } only
        assertEquals(R.drawable.ic_stat_bedtime, icon(ReminderReceiver.build(ctx, Reminders.Entry.fromJson("bedtime", "{\"at\":1,\"title\":\"Bedtime in 30 minutes\",\"body\":\"\"}"))));
        assertEquals(R.drawable.ic_stat_summary, icon(ReminderReceiver.build(ctx, Reminders.Entry.fromJson("morning", "{\"at\":1,\"title\":\"Your day\",\"body\":\"\"}"))));
        Reminders.Entry old = Reminders.Entry.fromJson("reminder:x", "{\"at\":1,\"title\":\"Dentist starts in 30 min\",\"body\":\"11:00\"}");
        assertEquals(R.drawable.ic_stat_event, icon(ReminderReceiver.build(ctx, old)));
        assertFalse(ReminderReceiver.build(ctx, old).extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
    }

    @Test
    public void kindAndStartSurviveStorage() throws JSONException {
        Reminders.Entry e = new Reminders.Entry("reminder:b", 5, "Taxes", "11:00 – 11:30", "tasklist", START);
        Reminders.Entry back = Reminders.Entry.fromJson(e.id, e.toJson());
        assertEquals("tasklist", back.kind);
        assertEquals(START, back.start);
    }
}
