package lan.mordor.calendar.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.BackgroundColorSpan;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.graphics.Typeface;
import android.widget.RemoteViews;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lan.mordor.calendar.MainActivity;
import lan.mordor.calendar.R;
import org.json.JSONObject;

/** Builds the week widget's {@link RemoteViews} from the stored snapshot and the last fetched week. */
final class WidgetRenderer {
    private static final int[] ROWS = {R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4, R.id.row5, R.id.row6, R.id.row7, R.id.row8, R.id.row9};
    /** Below this column width (dp) the event rows show the title only, without the start time. */
    private static final int TIME_MIN_COLUMN_DP = 75;
    private static final int ROW_DP = 12;

    private WidgetRenderer() {}

    /** Renders and pushes one widget instance, sized by its current options. */
    static void render(Context context, AppWidgetManager manager, int widgetId) {
        manager.updateAppWidget(widgetId, build(context, manager.getAppWidgetOptions(widgetId), LocalDate.now()));
    }

    static RemoteViews build(Context context, Bundle options, LocalDate today) {
        WidgetStore store = new WidgetStore(context);
        JSONObject snapshot = store.snapshot();
        boolean systemDark = (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WidgetTheme theme = snapshot != null ? WidgetTheme.fromSnapshot(snapshot) : WidgetTheme.defaults(systemDark);
        WidgetStrings str = new WidgetStrings(snapshot != null ? snapshot.optString("language") : WidgetStrings.deviceLanguage());
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1);

        WeekData data = pickData(store, snapshot, today, monday);
        boolean nothingYet = snapshot == null && store.fetched() == null;

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_week);
        rv.setInt(R.id.bg, "setColorFilter", theme.surface);
        rv.setInt(R.id.refresh, "setColorFilter", theme.onSurfaceVariant);
        rv.setOnClickPendingIntent(R.id.refresh, WeekWidgetProvider.refreshIntent(context));

        if (nothingYet) {
            rv.setViewVisibility(R.id.content, android.view.View.GONE);
            rv.setViewVisibility(R.id.empty, android.view.View.VISIBLE);
            rv.setTextViewText(R.id.empty, str.openOnce());
            rv.setTextColor(R.id.empty, theme.onSurface);
            rv.setOnClickPendingIntent(R.id.root, openApp(context, "/week/" + monday));
            return rv;
        }

        // header opens the week
        rv.setTextViewText(R.id.title, str.weekRange(monday));
        rv.setTextColor(R.id.title, theme.onSurface);
        rv.setOnClickPendingIntent(R.id.title, openApp(context, "/week/" + monday));

        int widthDp = widthDp(context, options), heightDp = heightDp(context, options);
        boolean hasTasks = data != null && !data.tasks.isEmpty();
        int columnDp = Math.max(1, (widthDp - 12) / 7);
        int rowsFit = Math.max(1, Math.min(ROWS.length, (heightDp - 12 - 22 - 14 - 14 - (hasTasks ? 14 : 0)) / ROW_DP));

        rv.removeAllViews(R.id.columns);
        for (int i = 0; i < 7; i++) {
            WeekData.Day day = data != null ? data.days.get(i) : null;
            LocalDate date = monday.plusDays(i);
            rv.addView(R.id.columns, column(context, theme, str, date, day, date.equals(today), rowsFit, columnDp >= TIME_MIN_COLUMN_DP));
        }

        if (hasTasks) {
            rv.setViewVisibility(R.id.tasks, android.view.View.VISIBLE);
            rv.setTextViewText(R.id.tasks, tasksText(str, theme, data.tasks));
            rv.setTextColor(R.id.tasks, theme.onSurfaceVariant);
        } else {
            rv.setViewVisibility(R.id.tasks, android.view.View.GONE);
        }

        rv.setTextColor(R.id.footer, theme.onSurfaceVariant);
        if (WidgetStore.AUTH_SIGN_IN.equals(store.auth())) {
            rv.setTextViewText(R.id.footer, str.signInAgain());
            rv.setTextColor(R.id.footer, theme.primary);
            rv.setOnClickPendingIntent(R.id.footer, openApp(context, "/week/" + monday));
        } else {
            String time = data == null ? "" : DateTimeFormatter.ofPattern("HH:mm").format(LocalTime.ofInstant(Instant.ofEpochMilli(data.timeMillis), ZoneId.systemDefault()));
            rv.setTextViewText(R.id.footer, data == null ? "" : str.updated() + ": " + time);
        }
        return rv;
    }

    /** The newer of the app's snapshot and the fetched week, whichever is for the current week. */
    private static WeekData pickData(WidgetStore store, JSONObject snapshot, LocalDate today, LocalDate monday) {
        WeekData best = null;
        try {
            if (snapshot != null && monday.equals(WidgetStore.weekOf(snapshot))) best = WeekData.fromSnapshot(snapshot, store.snapshotAtMillis());
        } catch (Exception ignored) {
            // an unreadable snapshot is treated as absent
        }
        try {
            JSONObject fetched = store.fetched();
            if (fetched != null && monday.equals(WidgetStore.weekOf(fetched)) && (best == null || store.fetchedAtMillis() >= best.timeMillis)) {
                best = WeekData.fromItems(fetched.getJSONArray("items"), today, monday, store.fetchedAtMillis());
            }
        } catch (Exception ignored) {
            // unreadable fetch result: keep the snapshot
        }
        return best;
    }

    private static RemoteViews column(Context context, WidgetTheme theme, WidgetStrings str, LocalDate date, WeekData.Day day, boolean isToday, int rowsFit, boolean showTime) {
        RemoteViews c = new RemoteViews(context.getPackageName(), R.layout.widget_day_column);
        c.setTextViewText(R.id.head, str.weekday(date) + " " + date.getDayOfMonth());
        c.setTextColor(R.id.head, isToday ? theme.onPrimaryContainer : theme.onSurfaceVariant);
        if (isToday) {
            c.setViewVisibility(R.id.col_bg, android.view.View.VISIBLE);
            c.setInt(R.id.col_bg, "setColorFilter", theme.primaryContainer);
        }
        c.setOnClickPendingIntent(R.id.col, openApp(context, "/day/" + date));

        List<WeekData.Event> events = day != null ? day.events : List.of();
        boolean overflow = events.size() > rowsFit;
        int shown = overflow ? rowsFit - 1 : events.size();
        for (int i = 0; i < shown; i++) {
            WeekData.Event e = events.get(i);
            c.setViewVisibility(ROWS[i], android.view.View.VISIBLE);
            c.setTextViewText(ROWS[i], eventText(theme, e, showTime, str));
            c.setTextColor(ROWS[i], isToday ? theme.onPrimaryContainer : theme.onSurface);
        }
        if (overflow) {
            c.setViewVisibility(ROWS[shown], android.view.View.VISIBLE);
            c.setTextViewText(ROWS[shown], "+" + (events.size() - shown));
            c.setTextColor(ROWS[shown], isToday ? theme.onPrimaryContainer : theme.onSurfaceVariant);
        }
        return c;
    }

    /** A coloured bar (a space with the event colour as background), then the time (when there is room) and the title. */
    private static CharSequence eventText(WidgetTheme theme, WeekData.Event e, boolean showTime, WidgetStrings str) {
        SpannableStringBuilder b = new SpannableStringBuilder();
        bar(b, WidgetTheme.color(e.color, theme.primary));
        if (showTime && e.start != null) b.append(e.start).append(' ');
        b.append(e.title.isEmpty() ? str.untitled() : e.title);
        return b;
    }

    private static CharSequence tasksText(WidgetStrings str, WidgetTheme theme, List<WeekData.Task> tasks) {
        SpannableStringBuilder b = new SpannableStringBuilder();
        int start = b.length();
        b.append(str.tasks()).append("  ");
        b.setSpan(new StyleSpan(Typeface.BOLD), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        for (WeekData.Task t : tasks) {
            bar(b, WidgetTheme.color(t.color, theme.primary));
            b.append(t.title.isEmpty() ? str.untitled() : t.title).append(' ').append(String.valueOf(t.done)).append('/').append(String.valueOf(t.total)).append("   ");
        }
        return b;
    }

    private static void bar(SpannableStringBuilder b, int color) {
        int at = b.length();
        b.append(' ');
        b.setSpan(new BackgroundColorSpan(color), at, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        b.append(' ');
    }

    /** A tap target that opens the app at {@code path} (a day or the week). */
    static PendingIntent openApp(Context context, String path) {
        Intent i = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse("calendar-widget://open" + path)) // makes each target's PendingIntent distinct
                .putExtra(MainActivity.EXTRA_PATH, path)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static int widthDp(Context context, Bundle o) {
        boolean land = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        return o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
    }

    private static int heightDp(Context context, Bundle o) {
        boolean land = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        return o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
    }
}
