package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import java.time.LocalDate;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * Owner bug 2026-10-14: widgets "revert back to the previous state". The app writes a snapshot after every sync (every
 * 30 s while open), stamped with the current time but with week data cached for up to 10 minutes, so a stale snapshot
 * outranked a fresh fetch. The fetched week is the widget's data whenever there is one for the current week.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class PickDataTest {
    private static final LocalDate MONDAY = LocalDate.parse("2026-10-12"), TODAY = LocalDate.parse("2026-10-14");

    @Test
    public void aFreshFetchIsNotOverriddenByALaterStaleSnapshot() throws Exception {
        Context ctx = ApplicationProvider.getApplicationContext();
        WidgetStore store = new WidgetStore(ctx);
        String moved = "{\"kind\":\"event\",\"id\":\"d\",\"title\":\"Dentist\",\"start\":\"2026-10-14T11:00:00+02:00\",\"end\":\"2026-10-14T12:00:00+02:00\",\"allDay\":false,\"color\":\"#d50000\"}";
        store.saveFetched(new JSONObject().put("weekStart", MONDAY.toString()).put("items", new JSONArray("[" + moved + "]")).toString(), 1_000);
        // the app's snapshot, written later, still has the event at its old time (cached week)
        JSONObject ev = new JSONObject().put("title", "Dentist").put("allDay", false).put("start", "10:00").put("end", "11:00").put("color", "#d50000");
        JSONArray days = new JSONArray();
        for (int i = 0; i < 7; i++) days.put(new JSONObject().put("date", MONDAY.plusDays(i).toString()).put("events", i == 2 ? new JSONArray().put(ev) : new JSONArray()));
        JSONObject snap = new JSONObject().put("v", 1).put("generatedAt", "2026-10-14T10:00:00Z").put("language", "en").put("dark", false)
                .put("theme", new JSONObject()).put("weekStart", MONDAY.toString()).put("days", days).put("tasklists", new JSONArray());
        store.saveSnapshot(snap.toString()); // stamped now, i.e. after the fetch
        WeekData data = WidgetRenderer.pickData(store, store.snapshot(), TODAY, MONDAY);
        assertEquals(11 * 60, data.days.get(2).items.get(0).startMin);
    }

    @Test
    public void theMinimumEventLengthComesFromTheFetchElseFromTheSnapshot() throws Exception {
        Context ctx = ApplicationProvider.getApplicationContext();
        WidgetStore store = new WidgetStore(ctx);
        JSONArray days = new JSONArray();
        for (int i = 0; i < 7; i++) days.put(new JSONObject().put("date", MONDAY.plusDays(i).toString()).put("events", new JSONArray()));
        JSONObject snap = new JSONObject().put("v", 1).put("generatedAt", "2026-10-14T10:00:00Z").put("language", "en").put("dark", false)
                .put("theme", new JSONObject()).put("weekStart", MONDAY.toString()).put("days", days).put("tasklists", new JSONArray()).put("minEventMinutes", 15);
        store.saveSnapshot(snap.toString());
        assertEquals(15, WidgetRenderer.pickData(store, store.snapshot(), TODAY, MONDAY).minEventMinutes);
        // a fetch that read the prefs wins; one that could not read them keeps the snapshot's value
        store.saveFetched(new JSONObject().put("weekStart", MONDAY.toString()).put("items", new JSONArray()).put("minEventMinutes", 30).toString(), 1_000);
        assertEquals(30, WidgetRenderer.pickData(store, store.snapshot(), TODAY, MONDAY).minEventMinutes);
        store.saveFetched(new JSONObject().put("weekStart", MONDAY.toString()).put("items", new JSONArray()).toString(), 2_000);
        assertEquals(15, WidgetRenderer.pickData(store, store.snapshot(), TODAY, MONDAY).minEventMinutes);
    }

    @Test
    public void taskListsTakeTheirCalendarColourWhileTaskCategoriesAreOff() throws Exception {
        Context ctx = ApplicationProvider.getApplicationContext();
        WidgetStore store = new WidgetStore(ctx);
        String list = "{\"kind\":\"tasklist\",\"id\":\"l\",\"title\":\"Laundry\",\"date\":\"2026-10-14\",\"time\":\"18:00\",\"estimateMinutes\":60,"
                + "\"doneCount\":0,\"totalCount\":1,\"color\":\"#0b8043\",\"calendarColor\":\"#1a73e8\",\"items\":[]}";
        JSONObject fetched = new JSONObject().put("weekStart", MONDAY.toString()).put("items", new JSONArray("[" + list + "]"));
        // the prefs could not be read: the server's default (categories on) applies
        store.saveFetched(fetched.toString(), 1_000);
        assertEquals("#0b8043", WidgetRenderer.pickData(store, null, TODAY, MONDAY).days.get(2).items.get(0).color);
        store.saveFetched(fetched.put("taskCategories", false).toString(), 2_000);
        assertEquals("#1a73e8", WidgetRenderer.pickData(store, null, TODAY, MONDAY).days.get(2).items.get(0).color);
        store.saveFetched(fetched.put("taskCategories", true).toString(), 3_000);
        assertEquals("#0b8043", WidgetRenderer.pickData(store, null, TODAY, MONDAY).days.get(2).items.get(0).color);
    }
}
