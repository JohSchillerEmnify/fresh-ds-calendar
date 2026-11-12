package lan.mordor.calendar.widget;

import android.graphics.Bitmap;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * The scrolling widget's Timeline: the next days as columns with the hours running top to bottom. {@link #plan} says which
 * days and hours it holds and how tall that is; {@link #slices} draws it (by {@link WeekCanvas#drawColumns}) and cuts it into the
 * rows the widget's list scrolls through: the all-day band first, then one row per hour.
 */
final class TimelineRows {
    /** The height of one hour in dp: more than a short widget shows, so the list scrolls. */
    static final float HOUR_DP = 40;

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

    /** The columns and the hours they hold. */
    static final class Plan {
        final List<Column> columns;
        final int firstHour, lastHour;
        /** The all-day band's height in dp (0 without untimed entries). */
        final float bandDp;
        /** Offset of the first column in the data's days. */
        final int offset;

        Plan(List<Column> columns, int firstHour, int lastHour, float bandDp, int offset) {
            this.columns = columns;
            this.firstHour = firstHour;
            this.lastHour = lastHour;
            this.bandDp = bandDp;
            this.offset = offset;
        }

        /** The height of the whole picture in dp. */
        float totalDp() {
            return 2 * WeekCanvas.PAD + bandDp + (lastHour - firstHour) * HOUR_DP;
        }
    }

    /** The {@code days} columns from {@code today} and the hours the earliest start to the latest end of them needs (at least six). */
    static Plan plan(WeekData data, LocalDate today, int days, WidgetStrings str) {
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
        int[] range = WeekLayout.hourRange(shown);
        return new Plan(columns, range[0], range[1], WeekCanvas.columnsBandHeight(shown, range, HOUR_DP), offset);
    }

    /** The picture cut into list rows, top to bottom; {@code scale} is pixels per dp, {@code widthPx} the picture's width. */
    static List<Bitmap> slices(WeekData data, Plan plan, WidgetTheme theme, WidgetStrings str, LocalDate today, int minutesNow, int widthPx, float scale) {
        Bitmap all = WeekCanvas.drawColumns(data, theme, str, plan.offset, plan.columns.size(), today, minutesNow, widthPx, new int[] {plan.firstHour, plan.lastHour}, HOUR_DP, scale);
        List<Bitmap> rows = new ArrayList<>();
        int top = 0, bandEnd = Math.round((WeekCanvas.PAD + plan.bandDp) * scale);
        if (plan.bandDp > 0) top = cut(all, rows, 0, bandEnd);
        float y = WeekCanvas.PAD + plan.bandDp;
        for (int h = plan.firstHour; h < plan.lastHour; h++, y += HOUR_DP) {
            boolean lastRow = h == plan.lastHour - 1;
            top = cut(all, rows, top, lastRow ? all.getHeight() : Math.round((y + HOUR_DP) * scale));
        }
        all.recycle();
        return rows;
    }

    private static int cut(Bitmap all, List<Bitmap> rows, int from, int to) {
        int end = Math.min(all.getHeight(), Math.max(from + 1, to));
        rows.add(Bitmap.createBitmap(all, 0, from, all.getWidth(), end - from));
        return end;
    }
}
