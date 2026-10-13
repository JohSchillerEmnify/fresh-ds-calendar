package lan.mordor.calendar.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.RemoteViews;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import lan.mordor.calendar.MainActivity;
import lan.mordor.calendar.R;
import org.json.JSONObject;

/** Builds the week widget's {@link RemoteViews}: one bitmap of the week (see {@link WeekCanvas}) plus transparent tap targets. */
final class WidgetRenderer {
    private static final int[] DAYS = {R.id.d0, R.id.d1, R.id.d2, R.id.d3, R.id.d4, R.id.d5, R.id.d6};

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
            rv.setViewVisibility(R.id.content, View.GONE);
            rv.setViewVisibility(R.id.canvas, View.GONE);
            rv.setViewVisibility(R.id.empty, View.VISIBLE);
            rv.setTextViewText(R.id.empty, str.openOnce());
            rv.setTextColor(R.id.empty, theme.onSurface);
            rv.setOnClickPendingIntent(R.id.root, openApp(context, "/week/" + monday));
            return rv;
        }

        // tap targets: the header opens the week, each day column its day
        rv.setOnClickPendingIntent(R.id.hdr, openApp(context, "/week/" + monday));
        for (int i = 0; i < 7; i++) rv.setOnClickPendingIntent(DAYS[i], openApp(context, "/day/" + monday.plusDays(i)));

        String footer;
        boolean signIn = WidgetStore.AUTH_SIGN_IN.equals(store.auth());
        if (signIn) {
            footer = str.signInAgain();
        } else {
            String time = data == null ? "" : DateTimeFormatter.ofPattern("HH:mm").format(LocalTime.ofInstant(Instant.ofEpochMilli(data.timeMillis), ZoneId.systemDefault()));
            footer = data == null ? "" : str.updated() + ": " + time;
        }

        // the bitmap is drawn at the widget's real size, never above one screen of pixels (the RemoteViews memory limit is 1.5 screens)
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        float widthDp = widthDp(context, options), heightDp = heightDp(context, options);
        float scale = WeekLayout.bitmapScale(widthDp, heightDp, dm.density, (long) dm.widthPixels * dm.heightPixels);
        LocalTime now = LocalTime.now();
        Bitmap bmp = WeekCanvas.draw(data, theme, str, monday, today, now.getHour() * 60 + now.getMinute(), footer, signIn,
                Math.max(1, Math.round(widthDp * scale)), Math.max(1, Math.round(heightDp * scale)), scale);
        rv.setImageViewBitmap(R.id.canvas, bmp);
        return rv;
    }

    /**
     * The week to draw: the fetched week whenever there is one for the current week, else the app's snapshot. The fetch is
     * authoritative: the snapshot is stamped when the app writes it (after every sync), but its week can come from a cache
     * up to 10 minutes old, so "newer" by stamp let a stale snapshot hide a fresh fetch (owner bug 2026-10-14: widgets
     * reverting to an earlier state). The app still triggers a fetch when it writes a snapshot (see onSnapshot).
     */
    static WeekData pickData(WidgetStore store, JSONObject snapshot, LocalDate today, LocalDate monday) {
        try {
            JSONObject fetched = store.fetched();
            if (fetched != null && monday.equals(WidgetStore.weekOf(fetched))) {
                return WeekData.fromItems(fetched.getJSONArray("items"), today, monday, store.fetchedAtMillis());
            }
        } catch (Exception ignored) {
            // unreadable fetch result: fall back to the snapshot
        }
        try {
            if (snapshot != null && monday.equals(WidgetStore.weekOf(snapshot))) return WeekData.fromSnapshot(snapshot, today, store.snapshotAtMillis());
        } catch (Exception ignored) {
            // an unreadable snapshot is treated as absent
        }
        return null;
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

    static int widthDp(Context context, Bundle o) {
        boolean land = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        return o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
    }

    static int heightDp(Context context, Bundle o) {
        boolean land = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        return o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
    }
}
