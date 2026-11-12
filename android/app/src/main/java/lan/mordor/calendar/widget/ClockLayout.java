package lan.mordor.calendar.widget;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Pure rules of the clock widget, the same as the web clock's ({@code web/src/features/labs/clock/clock.ts},
 * {@code geometry.ts}): which entries are arcs, their lanes, the focus wedge and the line in the middle.
 */
final class ClockLayout {
    private ClockLayout() {}

    /** An arc: an entry of today with its lane (0 = outermost). */
    static final class Arc {
        final WeekData.Item item;
        final int lane;

        Arc(WeekData.Item item, int lane) {
            this.item = item;
            this.lane = lane;
        }
    }

    /** Timed events and timed task lists as arcs; an entry goes on the first lane where it overlaps nothing earlier. */
    static List<Arc> arcs(List<WeekData.Item> items) {
        List<WeekData.Item> timed = new ArrayList<>();
        for (WeekData.Item i : items) if (i.timed()) timed.add(i);
        timed.sort(Comparator.comparingInt((WeekData.Item i) -> i.startMin).thenComparing((WeekData.Item i) -> -i.endMin));
        List<Integer> laneEnds = new ArrayList<>();
        List<Arc> out = new ArrayList<>();
        for (WeekData.Item i : timed) {
            int lane = -1;
            for (int l = 0; l < laneEnds.size(); l++) if (laneEnds.get(l) <= i.startMin) { lane = l; break; }
            if (lane < 0) { lane = laneEnds.size(); laneEnds.add(0); }
            laneEnds.set(lane, i.endMin);
            out.add(new Arc(i, lane));
        }
        return out;
    }

    /** The focus wedge: from now to the end of the running event, else to the start of the next one; null when none. */
    static final class Wedge {
        final int from, to;
        final String color;
        final boolean running;

        Wedge(int from, int to, String color, boolean running) {
            this.from = from;
            this.to = to;
            this.color = color;
            this.running = running;
        }
    }

    static Wedge wedge(List<WeekData.Item> items, int nowMin) {
        WeekData.Item cur = null, next = null;
        for (WeekData.Item i : items) {
            if (i.taskList || !i.timed()) continue;
            if (i.startMin <= nowMin && nowMin < i.endMin && (cur == null || i.endMin < cur.endMin)) cur = i;
            if (i.startMin > nowMin && (next == null || i.startMin < next.startMin)) next = i;
        }
        if (cur != null) return new Wedge(nowMin, cur.endMin, cur.color, true);
        if (next != null) return new Wedge(nowMin, next.startMin, next.color, false);
        return null;
    }

    /** "Dentist · 40 min left", "Next: Gym in 2 h" or "Nothing else today" (the web app's Approaching card). */
    static String nowLine(List<WeekData.Item> items, int nowMin, WidgetStrings str) {
        WeekData.Item cur = null, next = null;
        for (WeekData.Item i : items) {
            if (i.taskList || !i.timed()) continue;
            if (i.startMin <= nowMin && nowMin < i.endMin && (cur == null || i.endMin < cur.endMin)) cur = i;
            if (i.startMin > nowMin && (next == null || i.startMin < next.startMin)) next = i;
        }
        if (cur != null) return str.left(title(cur, str), str.duration(cur.endMin - nowMin));
        if (next != null) return str.next(title(next, str), str.duration(next.startMin - nowMin));
        return str.nothingElse();
    }

    static String title(WeekData.Item i, WidgetStrings str) {
        String t = i.label() == null || i.label().trim().isEmpty() ? str.untitled() : i.label().trim();
        return i.taskList ? t + " " + i.done + "/" + i.total : t;
    }

    /** Angle in degrees (0 = top, clockwise) of a minute of the day on the 24-hour dial. */
    static float angle(float minutes) {
        return minutes / 1440f * 360f;
    }
}
