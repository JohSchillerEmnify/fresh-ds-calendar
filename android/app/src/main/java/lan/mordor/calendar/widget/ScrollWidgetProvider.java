package lan.mordor.calendar.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;
import lan.mordor.calendar.R;

/**
 * The List home-screen widget: today and the coming days as an Agenda that scrolls. Its subclass {@link MultiDayWidgetProvider} shows
 * the Timeline instead. Both share the week widget's data, theme, language and refresh jobs; see {@link ScrollWidgetRenderer}.
 */
public class ScrollWidgetProvider extends AppWidgetProvider {
    /** The content key last pushed per widget instance (this process only); an unchanged widget is not pushed again, so a scroll is not reset. */
    private static final Map<Integer, String> LAST = new HashMap<>();

    /** True for the Multi-day widget: the Timeline instead of the Agenda. */
    boolean timeline() {
        return false;
    }

    @Override
    public void onEnabled(Context context) {
        WeekWidgetProvider.schedulePeriodicFetch(context);
        ClockWidgetProvider.scheduleTicks(context);
    }

    @Override
    public void onDisabled(Context context) {
        ClockWidgetProvider.scheduleTicks(context);
        if (!WeekWidgetProvider.hasWidgets(context)) WeekWidgetProvider.cancelPeriodicFetch(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id, true, timeline());
        ClockWidgetProvider.scheduleTicks(context);
        WeekWidgetProvider.enqueueFetch(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id, false, timeline());
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        synchronized (LAST) {
            for (int id : ids) LAST.remove(id);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) renderAll(context, false);
    }

    private static int[] ids(Context context, Class<?> provider) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, provider));
    }

    /** Every placed List and Multi-day widget. */
    static int[] ids(Context context) {
        int[] list = ids(context, ScrollWidgetProvider.class), multi = ids(context, MultiDayWidgetProvider.class);
        int[] all = java.util.Arrays.copyOf(list, list.length + multi.length);
        System.arraycopy(multi, 0, all, list.length, multi.length);
        return all;
    }

    static boolean hasMultiDay(Context context) {
        return ids(context, MultiDayWidgetProvider.class).length > 0;
    }

    static void renderAll(Context context, boolean force) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context, ScrollWidgetProvider.class)) render(context, manager, id, force, false);
        renderMultiDay(context, force, LocalDate.now(), LocalTime.now());
    }

    /** The periodic tick: only the Multi-day widgets, whose now line and opening row follow the time of day. */
    static void renderMultiDay(Context context, boolean force, LocalDate today, LocalTime now) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context, MultiDayWidgetProvider.class)) render(context, manager, id, force, true, today, now);
    }

    /** Pushes one instance unless nothing it shows changed (data, sign-in state, size, theme mode, today, for the Timeline the quarter hour); {@code force} when the system may have lost the views. */
    static void render(Context context, AppWidgetManager manager, int widgetId, boolean force, boolean timeline) {
        render(context, manager, widgetId, force, timeline, LocalDate.now(), LocalTime.now());
    }

    /** The Timeline also changes with the time: its key holds the quarter hour of now minus 30 minutes, where its list opens. */
    static boolean render(Context context, AppWidgetManager manager, int widgetId, boolean force, boolean timeline, LocalDate today, LocalTime now) {
        Bundle options = manager.getAppWidgetOptions(widgetId);
        WidgetStore store = new WidgetStore(context);
        Configuration config = context.getResources().getConfiguration();
        String key = ChangeKey.of(ChangeKey.withoutStamp(store.rawSnapshot()), store.rawFetched(), store.auth(), today, WidgetRenderer.widthDp(context, options),
                WidgetRenderer.heightDp(context, options), config.uiMode, config.orientation, timeline, timeline ? now.minusMinutes(30).toSecondOfDay() / 900 : 0);
        synchronized (LAST) {
            if (!force && key.equals(LAST.get(widgetId))) return false;
            LAST.put(widgetId, key);
        }
        if (!push(context, manager::updateAppWidget, widgetId, options, timeline, today, now)) {
            synchronized (LAST) {
                LAST.remove(widgetId); // not shown: the next render tries again
            }
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) manager.notifyAppWidgetViewDataChanged(widgetId, R.id.list);
        return true;
    }

    /** Hands one instance to the system, always in the same layout: the launcher reuses the shown list, which scrolls on from where it is. */
    static boolean push(Context context, BitmapBudget.Updater out, int widgetId, Bundle options, boolean timeline, LocalDate today, LocalTime now) {
        return BitmapBudget.push(context, out, widgetId, () -> ScrollWidgetRenderer.build(context, widgetId, options, today, now, timeline));
    }
}
