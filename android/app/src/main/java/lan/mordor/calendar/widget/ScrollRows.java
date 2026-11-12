package lan.mordor.calendar.widget;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/**
 * What the scrolling widgets show, as plain data: the person's choice (the Timeline's number of days and the hours in view)
 * from the app's snapshot, and the Agenda's rows (a day header, then its entries). The List widget shows the Agenda, the
 * Multi-day widget the Timeline; see {@link ScrollWidgetRenderer}.
 */
final class ScrollRows {
    /** Today and the 13 days after it. */
    static final int DAYS = 14;
    static final int DEFAULT_TIMELINE_DAYS = 3, MAX_TIMELINE_DAYS = 7, DEFAULT_HOURS = 16;
    private static final int[] HOURS = {8, 12, 16, 24};

    private ScrollRows() {}

    /** The person's choice for the Multi-day widget: its number of days and the hours in view. */
    static final class Choice {
        final int days;
        final int hours;

        Choice(int days, int hours) {
            this.days = days;
            this.hours = hours;
        }
    }

    /** The choice in the snapshot ({@code scrollDays}, {@code scrollHours}); a missing or unknown value means 3 days and 16 hours. */
    static Choice choice(JSONObject snapshot) {
        if (snapshot == null) return new Choice(DEFAULT_TIMELINE_DAYS, DEFAULT_HOURS);
        int days = snapshot.optInt("scrollDays", DEFAULT_TIMELINE_DAYS), hours = snapshot.optInt("scrollHours", DEFAULT_HOURS);
        boolean known = false;
        for (int h : HOURS) known |= h == hours;
        return new Choice(days >= 1 && days <= MAX_TIMELINE_DAYS ? days : DEFAULT_TIMELINE_DAYS, known ? hours : DEFAULT_HOURS);
    }

    /** One line of the Agenda: a day header or an entry. */
    static final class Row {
        final LocalDate date;
        final boolean header;
        final boolean today;
        /** The header's text or the entry's title. */
        final String title;
        /** {@code HH:mm}, "All day" or empty (no time, or a narrow widget). */
        final String time;
        /** A task list's {@code done/total}, else empty. */
        final String count;
        final String color;

        Row(LocalDate date, boolean header, boolean today, String title, String time, String count, String color) {
            this.date = date;
            this.header = header;
            this.today = today;
            this.title = title;
            this.time = time;
            this.count = count;
            this.color = color;
        }

        /** The app path a tap on the row opens: its day (the app has no link to a single event). */
        String path() {
            return "/day/" + date;
        }
    }

    /**
     * The Agenda: for each of the {@link #DAYS} days from {@code today} that has entries, a header and its entries (all-day first,
     * then by start). Days without entries have no header.
     *
     * @param narrow leave the times out (a narrow widget shows titles only)
     */
    static List<Row> agenda(WeekData data, LocalDate today, WidgetStrings str, boolean narrow) {
        List<Row> rows = new ArrayList<>();
        if (data == null) return rows;
        for (int i = 0; i < DAYS; i++) {
            LocalDate date = today.plusDays(i);
            WeekData.Day day = dayOf(data, date);
            if (day == null || day.items.isEmpty()) continue;
            rows.add(new Row(date, true, i == 0, str.agendaDay(date), "", "", ""));
            for (WeekData.Item it : day.items) {
                String time = narrow ? "" : it.allDay ? str.allDay() : it.startMin >= 0 ? WeekData.hhmm(it.startMin) : "";
                rows.add(new Row(date, false, i == 0, it.title.isEmpty() ? str.untitled() : it.title, time, it.taskList ? it.done + "/" + it.total : "", it.color));
            }
        }
        return rows;
    }

    /** The data's day for {@code date}, or null when it lies outside the data. */
    static WeekData.Day dayOf(WeekData data, LocalDate date) {
        long idx = ChronoUnit.DAYS.between(data.weekStart, date);
        return idx >= 0 && idx < data.days.size() ? data.days.get((int) idx) : null;
    }
}
