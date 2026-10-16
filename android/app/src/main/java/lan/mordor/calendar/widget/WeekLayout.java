package lan.mordor.calendar.widget;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * The pure maths of the week bitmap, free of Android classes so JUnit can test it: the column packing of overlapping
 * blocks (a port of {@code packColumns} in {@code web/src/lib/items.ts}), the visible hour range and the bitmap scale.
 */
final class WeekLayout {
    /** Overlapping blocks whose starts are at least this far apart cascade (web: OVERLAP_STACK_MIN_START_GAP_MIN). */
    static final int STACK_MIN_START_GAP_MIN = 15;
    /** Deepest cascade level (web: MAX_STACK_DEPTH). */
    static final int MAX_STACK_DEPTH = 3;
    /** Hours shown when the week has nothing in the grid. */
    static final int DEFAULT_START_HOUR = 8, DEFAULT_END_HOUR = 18;
    /** The grid never shows fewer hours than this. */
    static final int MIN_SPAN_HOURS = 6;

    private WeekLayout() {}

    /** A timed item with its place inside its overlap cluster. */
    static final class Placed {
        final WeekData.Item item;
        /** 0-based column in the start group and the group's column count. */
        int col;
        int cols = 1;
        /** Columns the block may occupy: it widens into free columns to its right. */
        int span = 1;
        /** Cascade level: 0 is drawn first, level n is indented and drawn on top. */
        final int level;
        /** Top and drawn height in minutes: at least the minimum, unless clamped by the next block below it. */
        final int top;
        int height;

        Placed(WeekData.Item item, int col, int level, int top, int height) {
            this.item = item;
            this.col = col;
            this.level = level;
            this.top = top;
            this.height = height;
        }
    }

    private static final class Group {
        final int start;
        int end;
        final int level;
        /** Start distance from the group's first start from which a later overlapping block cascades. */
        final int stackGap;
        final List<Placed> items = new ArrayList<>();
        final List<Integer> colEnds = new ArrayList<>();

        Group(int start, int end, int level, int stackGap) {
            this.start = start;
            this.end = end;
            this.level = level;
            this.stackGap = stackGap;
        }
    }

    /**
     * Packs the timed items of one day. Items in a connected overlap cluster are grouped by start time: starts within
     * {@link #STACK_MIN_START_GAP_MIN} of the group's first share equal columns; a later overlapping group cascades one level
     * deeper (up to {@link #MAX_STACK_DEPTH}, then it joins the last group's columns). Touching items do not overlap.
     * What overlaps is decided from the real start and end only; {@code minMinutes} sizes the drawn box, which is clamped to end
     * where the next block below it (not overlapping it in time, sharing its horizontal room) starts. A block that lasts less
     * than {@code minMinutes} is cascaded over only by a block starting at least {@code minMinutes} later.
     *
     * @param items the day's items; untimed ones are ignored
     * @param minMinutes the minimum drawn duration of a block, in minutes
     */
    static List<Placed> packColumns(List<WeekData.Item> items, int minMinutes) {
        List<WeekData.Item> timed = new ArrayList<>();
        for (WeekData.Item i : items) if (i.timed()) timed.add(i);
        timed.sort(Comparator.comparingInt((WeekData.Item i) -> i.startMin).thenComparingInt(i -> -i.endMin));
        List<Placed> out = new ArrayList<>();
        List<Group> groups = new ArrayList<>();
        int clusterEnd = -1;
        for (WeekData.Item s : timed) {
            if (!groups.isEmpty() && s.startMin >= clusterEnd) {
                flush(groups, out);
                clusterEnd = -1;
            }
            int end = realEnd(s);
            Group g = groups.isEmpty() ? null : groups.get(groups.size() - 1);
            if (g == null || s.startMin - g.start >= g.stackGap) {
                int deepest = -1;
                for (Group x : groups) if (x.end > s.startMin) deepest = Math.max(deepest, x.level);
                int level = 1 + deepest;
                if (g == null || level <= MAX_STACK_DEPTH) {
                    int stackGap = s.endMin - s.startMin < minMinutes ? Math.max(STACK_MIN_START_GAP_MIN, minMinutes) : STACK_MIN_START_GAP_MIN;
                    g = new Group(s.startMin, end, level, stackGap);
                    groups.add(g);
                }
            }
            int col = -1;
            for (int i = 0; i < g.colEnds.size(); i++) {
                if (g.colEnds.get(i) <= s.startMin) {
                    col = i;
                    break;
                }
            }
            if (col < 0) {
                col = g.colEnds.size();
                g.colEnds.add(end);
            } else {
                g.colEnds.set(col, end);
            }
            g.end = Math.max(g.end, end);
            g.items.add(new Placed(s, col, g.level, s.startMin, Math.max(s.endMin - s.startMin, minMinutes)));
            clusterEnd = Math.max(clusterEnd, end);
        }
        flush(groups, out);
        // Clamp each drawn box to the next block below it that shares its horizontal room, so the minimum never paints over it.
        for (Placed p : out) {
            int pEnd = realEnd(p.item);
            int next = Integer.MAX_VALUE;
            for (Placed q : out) {
                if (q != p && q.top >= pEnd && (double) q.col / q.cols < (double) (p.col + p.span) / p.cols
                        && (double) p.col / p.cols < (double) (q.col + q.span) / q.cols) {
                    next = Math.min(next, q.top);
                }
            }
            if (next != Integer.MAX_VALUE) p.height = Math.min(p.height, next - p.top);
        }
        return out;
    }

    /** The real end of an item; a zero-length one still occupies one minute so two of them never paint on top of each other. */
    private static int realEnd(WeekData.Item i) {
        return Math.max(i.endMin, i.startMin + 1);
    }

    private static void flush(List<Group> groups, List<Placed> out) {
        for (Group g : groups) {
            for (Placed p : g.items) p.cols = g.colEnds.size();
            for (Placed p : g.items) {
                int span = 1;
                for (int c = p.col + 1; c < p.cols; c++) {
                    boolean blocked = false;
                    for (Placed q : g.items) {
                        if (q.col == c && q.top < realEnd(p.item) && p.top < realEnd(q.item)) {
                            blocked = true;
                            break;
                        }
                    }
                    if (blocked) break;
                    span++;
                }
                p.span = span;
            }
            out.addAll(g.items);
        }
        groups.clear();
    }

    /**
     * The hours the grid shows, {first, last} (last exclusive): from the earliest start to the latest end of the week's
     * timed items, widened to at least {@link #MIN_SPAN_HOURS}, within 0 to 24. A week without timed items shows 08 to 18.
     */
    static int[] hourRange(List<WeekData.Day> days) {
        int min = Integer.MAX_VALUE, max = Integer.MIN_VALUE;
        for (WeekData.Day d : days) {
            for (WeekData.Item i : d.items) {
                if (!i.timed()) continue;
                min = Math.min(min, i.startMin);
                max = Math.max(max, Math.max(i.endMin, i.startMin + 1));
            }
        }
        if (min == Integer.MAX_VALUE) return new int[] {DEFAULT_START_HOUR, DEFAULT_END_HOUR};
        int first = Math.max(0, min / 60), last = Math.min(24, (max + 59) / 60);
        // grow the range symmetrically (later side first) until it spans the minimum
        while (last - first < MIN_SPAN_HOURS) {
            if (last < 24) last++;
            if (last - first < MIN_SPAN_HOURS && first > 0) first--;
        }
        return new int[] {first, last};
    }

    /**
     * The pixels per dp the bitmap is drawn at: the display density, lowered when the bitmap would exceed the pixel budget.
     * RemoteViews bitmaps are capped by the screen size, so the budget is one screen's worth of pixels.
     *
     * @param widthDp bitmap width in dp
     * @param heightDp bitmap height in dp
     * @param density display density (pixels per dp)
     * @param screenPixels width times height of the display in pixels
     */
    static float bitmapScale(float widthDp, float heightDp, float density, long screenPixels) {
        double wanted = (double) widthDp * density * heightDp * density;
        if (wanted <= screenPixels) return density;
        return (float) (density * Math.sqrt(screenPixels / wanted));
    }

    /** Black or white, whichever contrasts more with the {@code 0xRRGGBB} colour (a port of {@code onColor} in {@code web/src/api/colors.ts}). */
    static int onColor(int rgb) {
        double l = luminance(rgb);
        double withBlack = (l + 0.05) / 0.05, withWhite = 1.05 / (l + 0.05);
        return withBlack >= withWhite ? 0xFF000000 : 0xFFFFFFFF;
    }

    private static double luminance(int rgb) {
        return 0.2126 * linear((rgb >> 16) & 255) + 0.7152 * linear((rgb >> 8) & 255) + 0.0722 * linear(rgb & 255);
    }

    private static double linear(int c) {
        double s = c / 255.0;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
}
