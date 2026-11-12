package lan.mordor.calendar.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.RemoteViews;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import lan.mordor.calendar.R;
import org.json.JSONObject;

/**
 * The day home-screen widget (owner, 2026-10-14): today as the app's day view, drawn by {@link WeekCanvas#drawDay} (one wide
 * column: all-day band, hour grid fitted to the day, blocks with their time and a task list's open items, now line). It
 * shares the week widget's data, theme, language and refresh jobs; a tap opens the app's day view for today, the icon
 * refreshes.
 */
public class DayWidgetProvider extends AppWidgetProvider {
    @Override
    public void onEnabled(Context context) {
        WeekWidgetProvider.schedulePeriodicFetch(context);
    }

    @Override
    public void onDisabled(Context context) {
        if (!WeekWidgetProvider.hasWidgets(context)) WeekWidgetProvider.cancelPeriodicFetch(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
        WeekWidgetProvider.enqueueFetch(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            renderAll(context);
        }
    }

    static int[] ids(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, DayWidgetProvider.class));
    }

    static void renderAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context)) render(context, manager, id);
    }

    static void render(Context context, AppWidgetManager manager, int widgetId) {
        Bundle options = manager.getAppWidgetOptions(widgetId);
        BitmapBudget.push(context, manager, widgetId, () -> build(context, options, LocalDate.now(), LocalTime.now()));
    }

    static RemoteViews build(Context context, Bundle options, LocalDate today, LocalTime now) {
        WidgetStore store = new WidgetStore(context);
        JSONObject snapshot = store.snapshot();
        boolean systemDark = (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WidgetTheme theme = snapshot != null ? WidgetTheme.fromSnapshot(snapshot) : WidgetTheme.defaults(systemDark);
        WidgetStrings str = new WidgetStrings(snapshot != null ? snapshot.optString("language") : WidgetStrings.deviceLanguage());
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1);
        WeekData data = WidgetRenderer.pickData(store, snapshot, today, monday);

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_day);
        rv.setInt(R.id.bg, "setColorFilter", theme.surface);
        rv.setInt(R.id.refresh, "setColorFilter", theme.onSurfaceVariant);
        rv.setOnClickPendingIntent(R.id.refresh, WeekWidgetProvider.refreshIntent(context));
        rv.setOnClickPendingIntent(R.id.root, WidgetRenderer.openApp(context, "/day/" + today));

        if (snapshot == null && store.fetched() == null) {
            rv.setViewVisibility(R.id.canvas, View.GONE);
            rv.setViewVisibility(R.id.empty, View.VISIBLE);
            rv.setTextViewText(R.id.empty, str.openOnce());
            rv.setTextColor(R.id.empty, theme.onSurface);
            return rv;
        }
        boolean signIn = WidgetStore.AUTH_SIGN_IN.equals(store.auth());
        String footer = signIn ? str.signInAgain() : data == null ? ""
                : str.updated() + ": " + DateTimeFormatter.ofPattern("HH:mm").format(Instant.ofEpochMilli(data.timeMillis).atZone(ZoneId.systemDefault()).toLocalTime());

        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        float widthDp = WidgetRenderer.widthDp(context, options), heightDp = WidgetRenderer.heightDp(context, options);
        float scale = WeekLayout.bitmapScale(widthDp, heightDp, dm.density, BitmapBudget.pixels(context));
        Bitmap bmp = WeekCanvas.drawDay(data, theme, str, monday, today, today, now.getHour() * 60 + now.getMinute(), footer, signIn,
                Math.max(1, Math.round(widthDp * scale)), Math.max(1, Math.round(heightDp * scale)), scale);
        rv.setImageViewBitmap(R.id.canvas, bmp);
        return rv;
    }
}
