package lan.mordor.calendar.widget;

import android.graphics.Bitmap;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * The Multi-day widget's Timeline: the next days as columns with the whole day's hours running top to bottom. {@link #plan} says
 * which days it holds, how tall an hour is (so that the chosen hours fit the widget's height), where the list is cut and which
 * row it scrolls to; {@link #slices} draws it (by {@link WeekCanvas#drawColumns}) and cuts it into the rows the widget's list
 * scrolls through (at most two, see {@link #plan}).
 */
final class TimelineRows {
    /** The height in dp the day names and the widget's padding take away from the list. */
    static final float HEAD_DP = 38;

    /** The list's top padding in dp: the day names take two lines of text, which grow with the text size. */
    static float headDp(float textScale) {
        return HEAD_DP + Math.max(0, 24 * textScale - 28);
    }
    /** The Timeline opens with this many minutes before now at the top. */
    static final int LEAD_MINUTES = 30;
    private static final int DAY_MINUTES = 24 * 60;
    private static final float MIN_HOUR_DP = 8;

    private TimelineRows() {}

    /** One day column. */
    static final class Column {
        final LocalDate date;
        /** {@code Wed 14 Oct}, for assistive tools. */
        final String longName;
        /** Weekday and day on two lines, for the header over the columns. */
        final String name;
        final boolean today;
        final List<WeekData.Item> items;

        Column(LocalDate date, String longName, String name, boolean today, List<WeekData.Item> items) {
            this.date = date;
            this.longName = longName;
            this.name = name;
            this.today = today;
            this.items = items;
        }
    }

    /** The columns, the height of an hour and the list's cuts. */
    static final class Plan {
        final List<Column> columns;
        /** The whole day is drawn. */
        final int firstHour = 0, lastHour = 24;
        final float hourDp;
        /** The all-day band's height in dp (0 without untimed entries); it is part of the first row. */
        final float bandDp;
        /** Offset of the first column in the data's days. */
        final int offset;
        /** The minutes of the day where the picture is cut into rows, ascending, from 0 to 1440: the end of the opening view, if before 24:00. */
        final int[] marks;
        /** The minute that is at the top once the list has scrolled; -1 when the list opens at its start. */
        final int startMin;
        /** The row to scroll to (0, the first), so that {@code startMin} is at the top; -1 for none. */
        final int scrollRow;

        Plan(List<Column> columns, float hourDp, float bandDp, int offset, int[] marks, int startMin, int scrollRow) {
            this.columns = columns;
            this.hourDp = hourDp;
            this.bandDp = bandDp;
            this.offset = offset;
            this.marks = marks;
            this.startMin = startMin;
            this.scrollRow = scrollRow;
        }

        /** The height of the whole picture in dp. */
        float totalDp() {
            return 2 * WeekCanvas.PAD + bandDp + (lastHour - firstHour) * hourDp;
        }

        /** Rows in the list. */
        int rowCount() {
            return marks.length - 1;
        }
    }

    /**
     * The {@code days} columns from {@code today}. An hour is as tall as the list below the day names divided by {@code hours}, so that
     * many hours fit; the list opens {@link #LEAD_MINUTES} before {@code now} at the top, but at the latest {@code hours} before 24:00.
     *
     * @param heightDp the widget's height
     * @param textScale the text size as a factor (1 = 100 %)
     */
    static Plan plan(WeekData data, LocalDate today, int days, WidgetStrings str, int hours, float heightDp, LocalTime now, float textScale) {
        int offset = (int) ChronoUnit.DAYS.between(data.weekStart, today);
        List<Column> columns = new ArrayList<>();
        List<WeekData.Day> shown = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate date = today.plusDays(i);
            WeekData.Day day = ScrollRows.dayOf(data, date);
            if (day == null) day = new WeekData.Day(date);
            shown.add(day);
            columns.add(new Column(date, str.agendaDay(date), str.columnName(date), i == 0, day.items));
        }
        float hourDp = Math.max(MIN_HOUR_DP, (heightDp - headDp(textScale)) / hours);
        float bandDp = WeekCanvas.columnsBandHeight(shown, new int[] {0, 24}, hourDp, textScale);
        // the top minute is half an hour before now, but the list never scrolls past 24:00: late in the day it shows the day's last hours
        int padMinutes = Math.round(WeekCanvas.PAD / hourDp * 60); // the picture ends 4 dp below 24:00
        int start = hours >= 24 ? 0 : Math.max(0, Math.min(now.getHour() * 60 + now.getMinute() - LEAD_MINUTES, DAY_MINUTES + padMinutes - hours * 60));
        int end = start + hours * 60;
        // The list opens at its first row, which ends where the opening view ends, so it reaches below the list: scrolling to a row that is
        // partly visible takes one step that puts the row's bottom at the list's bottom (AbsListView.PositionScroller.scrollToVisible),
        // which is the wanted minute at the top. A farther row is reached in several steps that overshoot (and add the fading edge).
        int[] marks = start > 0 && end < DAY_MINUTES ? new int[] {0, end, DAY_MINUTES} : new int[] {0, DAY_MINUTES};
        return new Plan(columns, hourDp, bandDp, offset, marks, start > 0 ? start : -1, start > 0 ? 0 : -1);
    }

    /** The picture cut into list rows, top to bottom; {@code scale} is pixels per dp, {@code widthPx} the picture's width. */
    static List<Bitmap> slices(WeekData data, Plan plan, WidgetTheme theme, WidgetStrings str, LocalDate today, int minutesNow, int widthPx, float scale, float textScale) {
        Bitmap all = WeekCanvas.drawColumns(data, theme, str, plan.offset, plan.columns.size(), today, minutesNow, widthPx, new int[] {plan.firstHour, plan.lastHour}, plan.hourDp, scale, textScale);
        List<Bitmap> rows = new ArrayList<>();
        float gridTop = WeekCanvas.PAD + plan.bandDp;
        int top = 0;
        for (int i = 1; i < plan.marks.length; i++) {
            boolean last = i == plan.marks.length - 1;
            int end = last ? all.getHeight() : Math.round((gridTop + plan.marks[i] / 60f * plan.hourDp) * scale);
            int to = Math.min(all.getHeight(), Math.max(top + 1, end));
            rows.add(Bitmap.createBitmap(all, 0, top, all.getWidth(), to - top));
            top = to;
        }
        all.recycle();
        return rows;
    }
}
