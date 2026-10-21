package lan.mordor.calendar.widget;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * One week (Monday to Sunday) as the widget draws it: per day the events and task lists (timed ones placed in the hour
 * grid, the rest in the all-day band) plus the multi-day bars across the week.
 *
 * <p>Built from two sources that must agree: the app's snapshot (written by the web app, see
 * {@code web/src/native/widgetSnapshot.ts}, a fallback with less detail) and the {@code GET /api/items} response the
 * widget fetches itself. The second path mirrors the web app's {@code itemSegments} and {@code computeBars}
 * ({@code web/src/lib/items.ts}, {@code spans.ts}).
 */
final class WeekData {
    /** A task list without an estimate lasts this long in the grid (web: TASKLIST_BLOCK_MINUTES). */
    static final int TASKLIST_BLOCK_MINUTES = 30;

    /** An event or task list on one day. {@code startMin} is -1 when it is not placed in the hour grid (all-day, untimed list). */
    static final class Item {
        final String id;
        final String title;
        final boolean taskList;
        final boolean allDay;
        final int startMin;
        final int endMin;
        final String color;
        final int done;
        final int total;
        /** Names of the open items of a task list (the web card shows open items only). */
        final List<String> openItems;

        Item(String id, String title, boolean taskList, boolean allDay, int startMin, int endMin, String color, int done, int total, List<String> openItems) {
            this.id = id;
            this.title = title;
            this.taskList = taskList;
            this.allDay = allDay;
            this.startMin = startMin;
            this.endMin = endMin;
            this.color = color;
            this.done = done;
            this.total = total;
            this.openItems = openItems;
        }

        /** Whether the item is placed in the hour grid. */
        boolean timed() {
            return !allDay && startMin >= 0;
        }

        static Item event(String id, String title, boolean allDay, int startMin, int endMin, String color) {
            return new Item(id, title, false, allDay, allDay ? -1 : startMin, allDay ? -1 : endMin, color, 0, 0, List.of());
        }

        static Item taskList(String id, String title, int startMin, int endMin, String color, int done, int total, List<String> openItems) {
            return new Item(id, title, true, false, startMin, endMin, color, done, total, openItems);
        }
    }

    /** One day column. */
    static final class Day {
        final LocalDate date;
        final List<Item> items = new ArrayList<>();

        Day(LocalDate date) {
            this.date = date;
        }
    }

    /** A multi-day event drawn as one bar across its days of the week (columns are 0-based, inclusive). */
    static final class Bar {
        final String id;
        final String title;
        final String color;
        final int startCol;
        final int endCol;
        final int lane;
        final boolean continuedFromPrev;
        final boolean continuesToNext;

        Bar(String id, String title, String color, int startCol, int endCol, int lane, boolean continuedFromPrev, boolean continuesToNext) {
            this.id = id;
            this.title = title;
            this.color = color;
            this.startCol = startCol;
            this.endCol = endCol;
            this.lane = lane;
            this.continuedFromPrev = continuedFromPrev;
            this.continuesToNext = continuesToNext;
        }
    }

    final LocalDate weekStart;
    final List<Day> days = new ArrayList<>();
    final List<Bar> bars = new ArrayList<>();
    /** When the data was produced (epoch milliseconds). */
    final long timeMillis;
    /** The owner's minimum event length in minutes (0 = none): shorter timed items are laid out as this long. */
    int minEventMinutes;

    private WeekData(LocalDate weekStart, long timeMillis) {
        this.weekStart = weekStart;
        this.timeMillis = timeMillis;
        for (int i = 0; i < 7; i++) days.add(new Day(weekStart.plusDays(i)));
    }

    /** Number of bar lanes. */
    int laneCount() {
        int n = 0;
        for (Bar b : bars) n = Math.max(n, b.lane + 1);
        return n;
    }

    /** Parses the app's snapshot (events per day with {@code HH:mm} times, the task lists of {@code today}); null for an unknown version. */
    static WeekData fromSnapshot(JSONObject s, LocalDate today, long timeMillis) throws JSONException {
        if (s.optInt("v") != 1) return null;
        WeekData w = new WeekData(LocalDate.parse(s.getString("weekStart")), timeMillis);
        w.minEventMinutes = s.optInt("minEventMinutes", 0);
        JSONArray days = s.getJSONArray("days");
        for (int i = 0; i < 7 && i < days.length(); i++) {
            JSONArray events = days.getJSONObject(i).getJSONArray("events");
            for (int j = 0; j < events.length(); j++) {
                JSONObject e = events.getJSONObject(j);
                boolean allDay = e.getBoolean("allDay");
                int start = e.isNull("start") ? -1 : minutes(e.getString("start"));
                int end = e.isNull("end") ? -1 : minutes(e.getString("end"));
                w.days.get(i).items.add(Item.event("s" + i + "-" + j, e.getString("title"), allDay || start < 0, start, end, e.getString("color")));
            }
        }
        JSONArray tasks = s.getJSONArray("tasklists");
        long idx = ChronoUnit.DAYS.between(w.weekStart, today);
        int at = idx >= 0 && idx < 7 ? (int) idx : 0;
        for (int i = 0; i < tasks.length(); i++) {
            JSONObject t = tasks.getJSONObject(i);
            w.days.get(at).items.add(Item.taskList("st" + i, t.getString("title"), -1, -1, t.getString("color"), t.getInt("done"), t.getInt("total"), List.of()));
        }
        w.sortDays();
        return w;
    }

    /**
     * Builds the week from an {@code /api/items} response.
     *
     * @param items the response's {@code items} array
     * @param today the current date (open task lists of the past days are carried over to it, like the web app)
     * @param weekStart the Monday of the requested week
     * @param timeMillis when the response was fetched
     */
    static WeekData fromItems(JSONArray items, LocalDate today, LocalDate weekStart, long timeMillis) throws JSONException {
        WeekData w = new WeekData(weekStart, timeMillis);
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.getJSONObject(i);
            if ("tasklist".equals(it.optString("kind"))) {
                addTaskList(w, it, today);
                continue;
            }
            LocalDate[] range = barRange(it);
            if (range != null) candidates.add(new Candidate(it, range[0], range[1]));
            else addEvent(w, it);
        }
        w.layBars(candidates);
        w.sortDays();
        return w;
    }

    private static final class Candidate {
        final JSONObject item;
        final LocalDate start;
        final LocalDate last;

        Candidate(JSONObject item, LocalDate start, LocalDate last) {
            this.item = item;
            this.start = start;
            this.last = last;
        }
    }

    /**
     * The covered dates {start, last} of an event that is a bar, or null: events spanning two or more calendar days, the
     * timed ones only when they last 24 h or more (shorter overnight events keep their per-day blocks). All-day {@code end} is exclusive.
     */
    static LocalDate[] barRange(JSONObject it) {
        String start = it.optString("start"), end = it.optString("end");
        if (start.length() < 10 || end.length() < 10) return null;
        LocalDate a = LocalDate.parse(start.substring(0, 10)), b = LocalDate.parse(end.substring(0, 10));
        LocalDate last = b;
        if (it.optBoolean("allDay")) {
            last = b.minusDays(1);
        } else {
            if (hours(start, end) < 24) return null;
            if (end.length() >= 16 && end.substring(11, 16).equals("00:00")) last = b.minusDays(1);
        }
        if (ChronoUnit.DAYS.between(a, last) < 1) return null;
        return new LocalDate[] {a, last};
    }

    /** Length in hours; offsets are honoured when present, otherwise the wall times are compared. */
    private static long hours(String start, String end) {
        try {
            return ChronoUnit.HOURS.between(OffsetDateTime.parse(start), OffsetDateTime.parse(end));
        } catch (RuntimeException e) {
            try {
                return ChronoUnit.HOURS.between(LocalDateTime.parse(start.substring(0, 19)), LocalDateTime.parse(end.substring(0, 19)));
            } catch (RuntimeException ignored) {
                return 0;
            }
        }
    }

    /** Greedy lane assignment like the web: earlier start first, then longer, then id; clipped to the week. */
    private void layBars(List<Candidate> candidates) {
        LocalDate first = weekStart, last = weekStart.plusDays(6);
        List<Candidate> cand = new ArrayList<>();
        for (Candidate c : candidates) if (!c.last.isBefore(first) && !c.start.isAfter(last)) cand.add(c);
        cand.sort(Comparator.comparing((Candidate c) -> c.start)
                .thenComparing((Candidate c) -> -ChronoUnit.DAYS.between(c.start, c.last))
                .thenComparing((Candidate c) -> c.item.optString("id")));
        List<Integer> laneEnd = new ArrayList<>();
        for (Candidate c : cand) {
            LocalDate s = c.start.isBefore(first) ? first : c.start, e = c.last.isAfter(last) ? last : c.last;
            int startCol = (int) ChronoUnit.DAYS.between(first, s), endCol = (int) ChronoUnit.DAYS.between(first, e);
            int lane = -1;
            for (int i = 0; i < laneEnd.size(); i++) {
                if (laneEnd.get(i) < startCol) {
                    lane = i;
                    break;
                }
            }
            if (lane < 0) {
                lane = laneEnd.size();
                laneEnd.add(endCol);
            } else {
                laneEnd.set(lane, endCol);
            }
            bars.add(new Bar(c.item.optString("id"), c.item.optString("title"), c.item.optString("color"), startCol, endCol, lane, c.start.isBefore(first), c.last.isAfter(last)));
        }
    }

    /** Open lists dated up to this many days before today are carried over to today (web: CARRY_OVER_DAYS). */
    static final int CARRY_OVER_DAYS = 30;

    private static void addTaskList(WeekData w, JSONObject it, LocalDate today) {
        if (it.isNull("date") || it.optString("date").length() < 10) return; // undated: in no calendar view
        LocalDate date = LocalDate.parse(it.optString("date").substring(0, 10));
        boolean carried = date.isBefore(today) && it.optInt("doneCount") < it.optInt("totalCount")
                && ChronoUnit.DAYS.between(date, today) <= CARRY_OVER_DAYS;
        if (carried) date = today;
        String time = carried || it.isNull("time") ? "" : it.optString("time");
        int start = -1, end = -1;
        if (time.length() >= 5) {
            start = minutes(time);
            int estimate = it.isNull("estimateMinutes") ? TASKLIST_BLOCK_MINUTES : it.optInt("estimateMinutes", TASKLIST_BLOCK_MINUTES);
            end = Math.min(24 * 60, start + estimate);
        }
        List<String> open = new ArrayList<>();
        JSONArray names = it.optJSONArray("items");
        for (int i = 0; names != null && i < names.length(); i++) {
            JSONObject n = names.optJSONObject(i);
            if (n != null && !n.optBoolean("done")) open.add(n.optString("title"));
        }
        put(w, date, Item.taskList(it.optString("id"), it.optString("title"), start, end, it.optString("color"),
                it.optInt("doneCount"), it.optInt("totalCount"), open));
    }

    /** Splits one single-day-or-short event into the days it covers: a timed event ending at 00:00 spares that day. */
    private static void addEvent(WeekData w, JSONObject it) {
        String start = it.optString("start"), end = it.optString("end"), id = it.optString("id"), title = it.optString("title"), color = it.optString("color");
        if (start.length() < 10 || end.length() < 10) return;
        LocalDate a = LocalDate.parse(start.substring(0, 10)), b = LocalDate.parse(end.substring(0, 10));
        if (it.optBoolean("allDay")) {
            long n = Math.max(1, ChronoUnit.DAYS.between(a, b));
            for (long i = 0; i < n; i++) put(w, a.plusDays(i), Item.event(id, title, true, -1, -1, color));
            return;
        }
        String st = start.substring(11, 16), et = end.substring(11, 16);
        boolean endsAtMidnight = et.equals("00:00") && !b.equals(a);
        LocalDate lastDay = endsAtMidnight ? b.minusDays(1) : b;
        long n = Math.max(1, ChronoUnit.DAYS.between(a, lastDay) + 1);
        for (long i = 0; i < n; i++) {
            int s = i == 0 ? minutes(st) : 0;
            int e = i == n - 1 ? (endsAtMidnight ? 24 * 60 : minutes(et)) : 24 * 60;
            put(w, a.plusDays(i), Item.event(id, title, false, s, e, color));
        }
    }

    /** {@code HH:mm} to minutes; {@code 24:00} is 1440. */
    static int minutes(String hhmm) {
        return Integer.parseInt(hhmm.substring(0, 2)) * 60 + Integer.parseInt(hhmm.substring(3, 5));
    }

    /** Minutes to {@code HH:mm}; 1440 and more read {@code 24:00}. */
    static String hhmm(int minutes) {
        if (minutes >= 24 * 60) return "24:00";
        return String.format("%02d:%02d", minutes / 60, minutes % 60);
    }

    private static void put(WeekData w, LocalDate date, Item e) {
        long idx = ChronoUnit.DAYS.between(w.weekStart, date);
        if (idx >= 0 && idx < 7) w.days.get((int) idx).items.add(e);
    }

    /** The web's order in a day: all-day events, untimed task lists, then timed by start; ties by title. */
    private void sortDays() {
        Comparator<Item> order = Comparator.comparingInt((Item i) -> i.allDay ? 0 : i.taskList && i.startMin < 0 ? 1 : 2)
                .thenComparingInt((Item i) -> Math.max(i.startMin, 0))
                .thenComparing((Item i) -> i.title.toLowerCase());
        for (Day d : days) d.items.sort(order);
    }
}
