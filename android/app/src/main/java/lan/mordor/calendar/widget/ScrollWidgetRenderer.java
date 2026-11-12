package lan.mordor.calendar.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import lan.mordor.calendar.MainActivity;
import lan.mordor.calendar.R;
import org.json.JSONObject;

/**
 * Builds the scrolling widgets: a list that is either the Agenda of the List widget (a day header, then one row per entry) or the
 * Timeline of the Multi-day widget (the rows of {@link TimelineRows}, with the day names above the list). The data is
 * the app's device copy ({@link WidgetStore}); a fetched copy that reaches far enough is preferred, like in the other widgets.
 */
final class ScrollWidgetRenderer {
    /** Narrower than this many dp the Agenda shows titles only. */
    static final int NARROW_DP = 180;
    private static final int[] DAY_NAMES = {R.id.d0, R.id.d1, R.id.d2, R.id.d3, R.id.d4, R.id.d5, R.id.d6};

    private ScrollWidgetRenderer() {}

    /** What the widget draws from. */
    static final class Model {
        final WidgetTheme theme;
        final WidgetStrings str;
        final WeekData data;
        final ScrollRows.Choice choice;
        final boolean nothingYet;
        final boolean signIn;

        Model(WidgetTheme theme, WidgetStrings str, WeekData data, ScrollRows.Choice choice, boolean nothingYet, boolean signIn) {
            this.theme = theme;
            this.str = str;
            this.data = data;
            this.choice = choice;
            this.nothingYet = nothingYet;
            this.signIn = signIn;
        }
    }

    static Model load(Context context, LocalDate today) {
        WidgetStore store = new WidgetStore(context);
        JSONObject snapshot = store.snapshot();
        boolean systemDark = (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WidgetTheme theme = snapshot != null ? WidgetTheme.fromSnapshot(snapshot) : WidgetTheme.defaults(systemDark);
        WidgetStrings str = new WidgetStrings(snapshot != null ? snapshot.optString("language") : WidgetStrings.deviceLanguage());
        return new Model(theme, str, pick(store, snapshot, today), ScrollRows.choice(snapshot), snapshot == null && store.fetched() == null,
                WidgetStore.AUTH_SIGN_IN.equals(store.auth()));
    }

    /**
     * The days from today on: the fetched copy when it starts no later than today and reaches today + 13, else the app's snapshot
     * (which reaches as far), else null. The data always holds the 14 days from today, empty where the source has none.
     */
    static WeekData pick(WidgetStore store, JSONObject snapshot, LocalDate today) {
        try {
            JSONObject fetched = store.fetched();
            LocalDate from = WidgetStore.weekOf(fetched);
            if (from != null && !from.isAfter(today) && fetched.has("to") && !LocalDate.parse(fetched.getString("to")).isBefore(today.plusDays(ScrollRows.DAYS - 1))) {
                WeekData w = WeekData.fromItems(fetched.getJSONArray("items"), today, from, store.fetchedAtMillis(), fetched.optBoolean("taskCategories", true), spanFrom(from, today));
                WidgetRenderer.applyPrefs(w, fetched, snapshot);
                return w;
            }
        } catch (Exception ignored) {
            // unreadable fetch result: fall back to the snapshot
        }
        try {
            LocalDate from = WidgetStore.weekOf(snapshot);
            if (from != null && !from.isAfter(today)) return WeekData.fromSnapshot(snapshot, today, store.snapshotAtMillis(), spanFrom(from, today));
        } catch (Exception ignored) {
            // an unreadable snapshot is treated as absent
        }
        return null;
    }

    private static int spanFrom(LocalDate from, LocalDate today) {
        return (int) ChronoUnit.DAYS.between(from, today) + ScrollRows.DAYS;
    }

    static RemoteViews build(Context context, int widgetId, Bundle options, LocalDate today, LocalTime now, boolean timeline) {
        return build(context, widgetId, options, today, now, timeline, false);
    }

    /**
     * The widget with its list: the rows themselves on Android 12 and newer, the {@link ScrollWidgetService} on older ones. {@code alt}
     * picks the copy of the layout, so that a launcher builds the views afresh instead of reapplying them (see ScrollWidgetProvider#push).
     */
    static RemoteViews build(Context context, int widgetId, Bundle options, LocalDate today, LocalTime now, boolean timeline, boolean alt) {
        Model m = load(context, today);
        RemoteViews rv = new RemoteViews(context.getPackageName(), alt ? R.layout.widget_scroll_alt : R.layout.widget_scroll);
        rv.setInt(R.id.bg, "setColorFilter", m.theme.surface);
        rv.setInt(R.id.refresh, "setColorFilter", m.theme.onSurfaceVariant);
        rv.setOnClickPendingIntent(R.id.refresh, WeekWidgetProvider.refreshIntent(context));
        rv.setTextColor(R.id.empty, m.theme.onSurface);
        if (m.nothingYet) return message(rv, m.str.openOnce(), WidgetRenderer.openApp(context, "/day/" + today));
        if (m.signIn && m.data == null) return message(rv, m.str.signInAgain(), WidgetRenderer.openApp(context, "/day/" + today));

        List<RemoteViews> items = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? items(context, m, options, today, now, timeline) : null;
        if (timeline) {
            rv.setViewVisibility(R.id.head, View.VISIBLE);
            for (int i = 0; i < DAY_NAMES.length; i++) {
                boolean shown = i < m.choice.days;
                rv.setViewVisibility(DAY_NAMES[i], shown ? View.VISIBLE : View.GONE);
                if (!shown) continue;
                LocalDate d = today.plusDays(i);
                rv.setTextViewText(DAY_NAMES[i], m.str.columnName(d));
                rv.setContentDescription(DAY_NAMES[i], m.str.agendaDay(d));
                rv.setTextColor(DAY_NAMES[i], i == 0 ? m.theme.onPrimary : m.theme.onSurfaceVariant);
                rv.setColorStateList(DAY_NAMES[i], "setBackgroundTintList", ColorStateList.valueOf(i == 0 ? m.theme.primary : 0));
                rv.setOnClickPendingIntent(DAY_NAMES[i], WidgetRenderer.openApp(context, "/day/" + d));
            }
        } else {
            rv.setViewVisibility(R.id.head, View.GONE);
            if (ScrollRows.agenda(m.data, today, m.str, false).isEmpty()) return message(rv, m.str.nothingPlanned(), WidgetRenderer.openApp(context, "/day/" + today));
        }
        rv.setPendingIntentTemplate(R.id.list, template(context));
        int row = timeline && m.data != null ? plan(context, m, options, today, now).scrollRow : -1;
        if (items != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // a freshly built list has no rows yet and ignores a scroll; an adapter whose data then changes defers it to its first layout
            if (row >= 0) rv.setRemoteAdapter(R.id.list, new RemoteViews.RemoteCollectionItems.Builder().setViewTypeCount(3).build());
            RemoteViews.RemoteCollectionItems.Builder b = new RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(false).setViewTypeCount(3);
            for (int i = 0; i < items.size(); i++) b.addItem(i, items.get(i));
            rv.setRemoteAdapter(R.id.list, b.build());
        } else {
            Intent svc = new Intent(context, ScrollWidgetService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId).putExtra(ScrollWidgetService.EXTRA_TIMELINE, timeline);
            svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
            rv.setRemoteAdapter(R.id.list, svc);
        }
        if (row >= 0) rv.setScrollPosition(R.id.list, row);
        return rv;
    }

    private static RemoteViews message(RemoteViews rv, String text, PendingIntent open) {
        rv.setViewVisibility(R.id.list, View.GONE);
        rv.setViewVisibility(R.id.head, View.GONE);
        rv.setViewVisibility(R.id.empty, View.VISIBLE);
        rv.setTextViewText(R.id.empty, text);
        rv.setOnClickPendingIntent(R.id.root, open);
        return rv;
    }

    private static TimelineRows.Plan plan(Context context, Model m, Bundle options, LocalDate today, LocalTime now) {
        return TimelineRows.plan(m.data, today, m.choice.days, m.str, m.choice.hours, WidgetRenderer.heightDp(context, options), now);
    }

    /** The list's rows, top to bottom: Agenda rows, or the Timeline's picture slices. */
    static List<RemoteViews> items(Context context, Model m, Bundle options, LocalDate today, LocalTime now, boolean timeline) {
        List<RemoteViews> items = new ArrayList<>();
        if (m.data == null) return items;
        String pkg = context.getPackageName();
        if (timeline) {
            DisplayMetrics dm = context.getResources().getDisplayMetrics();
            TimelineRows.Plan plan = plan(context, m, options, today, now);
            float widthDp = WidgetRenderer.widthDp(context, options);
            float scale = WeekLayout.bitmapScale(widthDp, plan.totalDp(), dm.density, BitmapBudget.pixels(context));
            for (Bitmap slice : TimelineRows.slices(m.data, plan, m.theme, m.str, today, now.getHour() * 60 + now.getMinute(), Math.max(1, Math.round(widthDp * scale)), scale)) {
                RemoteViews row = new RemoteViews(pkg, R.layout.scroll_timeline_row);
                row.setImageViewBitmap(R.id.slice, slice);
                row.setOnClickFillInIntent(R.id.slice, fillIn("/day/" + today));
                items.add(row);
            }
            return items;
        }
        boolean narrow = WidgetRenderer.widthDp(context, options) < NARROW_DP;
        for (ScrollRows.Row r : ScrollRows.agenda(m.data, today, m.str, narrow)) items.add(r.header ? header(pkg, m, r) : entry(pkg, m, r));
        return items;
    }

    private static RemoteViews header(String pkg, Model m, ScrollRows.Row r) {
        RemoteViews rv = new RemoteViews(pkg, R.layout.scroll_day_header);
        rv.setTextViewText(R.id.title, r.title);
        rv.setTextColor(R.id.title, r.today ? m.theme.primary : m.theme.onSurfaceVariant);
        rv.setOnClickFillInIntent(R.id.title, fillIn(r.path()));
        return rv;
    }

    private static RemoteViews entry(String pkg, Model m, ScrollRows.Row r) {
        RemoteViews rv = new RemoteViews(pkg, R.layout.scroll_entry);
        rv.setInt(R.id.dot, "setColorFilter", WidgetTheme.color(r.color, m.theme.primary));
        rv.setTextViewText(R.id.title, r.title);
        rv.setTextColor(R.id.title, m.theme.onSurface);
        rv.setTextViewText(R.id.time, r.time);
        rv.setTextColor(R.id.time, m.theme.onSurfaceVariant);
        rv.setViewVisibility(R.id.time, r.time.isEmpty() ? View.GONE : View.VISIBLE);
        rv.setTextViewText(R.id.count, r.count);
        rv.setTextColor(R.id.count, m.theme.onSurfaceVariant);
        rv.setViewVisibility(R.id.count, r.count.isEmpty() ? View.GONE : View.VISIBLE);
        rv.setOnClickFillInIntent(R.id.row, fillIn(r.path()));
        return rv;
    }

    /** The template every row's fill-in completes: it opens the app, each row adds its path. */
    private static PendingIntent template(Context context) {
        Intent i = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 1, i, PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static Intent fillIn(String path) {
        return new Intent().putExtra(MainActivity.EXTRA_PATH, path);
    }
}
