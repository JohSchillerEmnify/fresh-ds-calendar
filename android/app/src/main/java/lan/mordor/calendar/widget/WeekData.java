package lan.mordor.calendar.widget;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * One week (Monday to Sunday) as the widget shows it: events per day and today's task lists.
 *
 * <p>Built from two sources that must agree: the app's snapshot (written by the web app, see
 * {@code web/src/native/widgetSnapshot.ts}) and the {@code GET /api/items} response the widget fetches itself. The
 * second path mirrors the web app's {@code itemSegments} splitting of events into days.
 */
final class WeekData {
    /** An event on one day; {@code start}/{@code end} are {@code HH:mm} wall times, null for all-day and continuation days. */
    static final class Event {
        final String title;
        final boolean allDay;
        final String start;
        final String end;
        final String color;

        Event(String title, boolean allDay, String start, String end, String color) {
            this.title = title;
            this.allDay = allDay;
            this.start = start;
            this.end = end;
            this.color = color;
        }
    }

    /** One day column. */
    static final class Day {
        final LocalDate date;
        final List<Event> events = new ArrayList<>();

        Day(LocalDate date) {
            this.date = date;
        }
    }

    /** A task list dated today with its progress. */
    static final class Task {
        final String title;
        final int done;
        final int total;
        final String color;

        Task(String title, int done, int total, String color) {
            this.title = title;
            this.done = done;
            this.total = total;
            this.color = color;
        }
    }

    final LocalDate weekStart;
    final List<Day> days = new ArrayList<>();
    final List<Task> tasks = new ArrayList<>();
    /** When the data was produced (epoch milliseconds). */
    final long timeMillis;

    private WeekData(LocalDate weekStart, long timeMillis) {
        this.weekStart = weekStart;
        this.timeMillis = timeMillis;
        for (int i = 0; i < 7; i++) days.add(new Day(weekStart.plusDays(i)));
    }

    /** Parses the app's snapshot; returns null for an unknown format version. */
    static WeekData fromSnapshot(JSONObject s, long timeMillis) throws JSONException {
        if (s.optInt("v") != 1) return null;
        WeekData w = new WeekData(LocalDate.parse(s.getString("weekStart")), timeMillis);
        JSONArray days = s.getJSONArray("days");
        for (int i = 0; i < 7 && i < days.length(); i++) {
            JSONArray events = days.getJSONObject(i).getJSONArray("events");
            for (int j = 0; j < events.length(); j++) {
                JSONObject e = events.getJSONObject(j);
                w.days.get(i).events.add(new Event(e.getString("title"), e.getBoolean("allDay"),
                        e.isNull("start") ? null : e.getString("start"), e.isNull("end") ? null : e.getString("end"), e.getString("color")));
            }
        }
        JSONArray tasks = s.getJSONArray("tasklists");
        for (int i = 0; i < tasks.length(); i++) {
            JSONObject t = tasks.getJSONObject(i);
            w.tasks.add(new Task(t.getString("title"), t.getInt("done"), t.getInt("total"), t.getString("color")));
        }
        return w;
    }

    /**
     * Builds the week from an {@code /api/items} response.
     *
     * @param items the response's {@code items} array
     * @param today the device's date, for the task lists shown as "today"
     * @param weekStart the Monday of the requested week
     * @param timeMillis when the response was fetched
     */
    static WeekData fromItems(JSONArray items, LocalDate today, LocalDate weekStart, long timeMillis) throws JSONException {
        WeekData w = new WeekData(weekStart, timeMillis);
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.getJSONObject(i);
            if ("tasklist".equals(it.optString("kind"))) {
                if (today.toString().equals(it.optString("date", null))) {
                    w.tasks.add(new Task(it.optString("title"), it.optInt("doneCount"), it.optInt("totalCount"), it.optString("color")));
                }
            } else {
                addEvent(w, it);
            }
        }
        Comparator<Event> order = Comparator.comparing((Event e) -> !e.allDay)
                .thenComparing((Event e) -> e.start == null ? "" : e.start)
                .thenComparing((Event e) -> e.title);
        for (Day d : w.days) d.events.sort(order);
        return w;
    }

    /** Splits one event into the days it covers: all-day {@code end} is exclusive, a timed event ending at 00:00 spares that day. */
    private static void addEvent(WeekData w, JSONObject it) {
        String start = it.optString("start"), end = it.optString("end"), title = it.optString("title"), color = it.optString("color");
        if (start.length() < 10 || end.length() < 10) return;
        LocalDate a = LocalDate.parse(start.substring(0, 10)), b = LocalDate.parse(end.substring(0, 10));
        if (it.optBoolean("allDay")) {
            long n = Math.max(1, ChronoUnit.DAYS.between(a, b));
            for (long i = 0; i < n; i++) put(w, a.plusDays(i), new Event(title, true, null, null, color));
            return;
        }
        String st = start.substring(11, 16), et = end.substring(11, 16);
        boolean endsAtMidnight = et.equals("00:00") && !b.equals(a);
        LocalDate lastDay = endsAtMidnight ? b.minusDays(1) : b;
        long n = Math.max(1, ChronoUnit.DAYS.between(a, lastDay) + 1);
        for (long i = 0; i < n; i++) {
            if (i > 0) {
                put(w, a.plusDays(i), new Event(title, true, null, null, color));
            } else {
                String e = n == 1 ? et : "24:00";
                if (n == 1 && endsAtMidnight) e = "24:00";
                put(w, a, new Event(title, false, st, e, color));
            }
        }
    }

    private static void put(WeekData w, LocalDate date, Event e) {
        long idx = ChronoUnit.DAYS.between(w.weekStart, date);
        if (idx >= 0 && idx < 7) w.days.get((int) idx).events.add(e);
    }
}
