package lan.mordor.calendar.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import lan.mordor.calendar.R;
import org.json.JSONObject;

/**
 * The clock home-screen widget: today on the app's 24-hour dial (see {@link ClockCanvas}). It shares the week widget's
 * data (the fetched week or the app's snapshot) and refresh jobs. The time in the middle is a live {@code TextClock};
 * the dial is redrawn every 5 minutes by an inexact, non-waking alarm, so it moves on while the phone is in use and
 * costs nothing while the screen is off. A tap opens the app's clock view for today.
 */
public class ClockWidgetProvider extends AppWidgetProvider {
    private static final long TICK_MS = 5 * 60_000L;

    @Override
    public void onEnabled(Context context) {
        WeekWidgetProvider.schedulePeriodicFetch(context);
        scheduleTicks(context, true);
    }

    @Override
    public void onDisabled(Context context) {
        scheduleTicks(context, false);
        if (!WeekWidgetProvider.hasWidgets(context)) WeekWidgetProvider.cancelPeriodicFetch(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
        scheduleTicks(context, true);
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
        if (Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            renderAll(context);
        }
    }

    static int[] ids(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, ClockWidgetProvider.class));
    }

    /** Redraws every clock widget from the stored data. */
    static void renderAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context)) render(context, manager, id);
    }

    static void render(Context context, AppWidgetManager manager, int widgetId) {
        manager.updateAppWidget(widgetId, build(context, manager.getAppWidgetOptions(widgetId), LocalDate.now(), LocalTime.now()));
    }

    static RemoteViews build(Context context, Bundle options, LocalDate today, LocalTime now) {
        WidgetStore store = new WidgetStore(context);
        JSONObject snapshot = store.snapshot();
        boolean systemDark = (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WidgetTheme theme = snapshot != null ? WidgetTheme.fromSnapshot(snapshot) : WidgetTheme.defaults(systemDark);
        WidgetStrings str = new WidgetStrings(snapshot != null ? snapshot.optString("language") : WidgetStrings.deviceLanguage());
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1);
        WeekData data = WidgetRenderer.pickData(store, snapshot, today, monday);
        List<WeekData.Item> items = data == null ? List.of() : data.days.get(today.getDayOfWeek().getValue() - 1).items;

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_clock);
        rv.setInt(R.id.bg, "setColorFilter", theme.surface);
        rv.setOnClickPendingIntent(R.id.root, WidgetRenderer.openApp(context, "/clock/" + today));

        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        int sideDp = Math.max(60, Math.min(dim(context, options, true), dim(context, options, false)) - 8);
        int sidePx = Math.min(Math.round(sideDp * dm.density), Math.min(dm.widthPixels, dm.heightPixels));
        Bitmap bmp = ClockCanvas.draw(items, theme, str, now.getHour() * 60 + now.getMinute(), sidePx, dm.density);
        rv.setImageViewBitmap(R.id.canvas, bmp);
        rv.setTextColor(R.id.time, theme.onSurface);
        // the time fills the middle the hand leaves free (ClockCanvas.HAND_FROM of the plate)
        rv.setTextViewTextSize(R.id.time, TypedValue.COMPLEX_UNIT_DIP, Math.max(12, sideDp * 0.11f));
        rv.setViewVisibility(R.id.time, View.VISIBLE);
        return rv;
    }

    private static int dim(Context context, Bundle o, boolean width) {
        boolean land = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        if (width) return o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 160);
        return o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 160);
    }

    /** Starts (or stops) the 5-minute redraw; inexact and not waking the phone. */
    static void scheduleTicks(Context context, boolean on) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(context, WidgetActionReceiver.class).setAction(WidgetActionReceiver.ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(context, 1, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.cancel(pi);
        if (on && ids(context).length > 0) am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + TICK_MS, TICK_MS, pi);
    }
}
