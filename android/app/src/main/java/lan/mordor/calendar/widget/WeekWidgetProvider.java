package lan.mordor.calendar.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

/**
 * The weekly home-screen widget. It draws from {@link WidgetStore} at once and lets {@link RefreshWorker} fetch fresh
 * data: periodically (every 30 minutes while a widget exists) and on demand (widget added, refresh icon, the app
 * finished a sync, midnight or a time-zone change).
 */
public class WeekWidgetProvider extends AppWidgetProvider {
    private static final String PERIODIC = "calendar-widget-periodic";
    private static final String NOW = "calendar-widget-now";
    /** The app pushes a snapshot with every sync (every 30 s while open); the widget fetches at most this often because of it,
     * so a change made in the app shows on the widget within about a minute (the fetch is the widget's data, see pickData). */
    private static final long MIN_FETCH_GAP_MS = 30_000;
    /** Same, when the pushed snapshot did not change. */
    private static final long UNCHANGED_FETCH_GAP_MS = 5 * 60_000;

    @Override
    public void onEnabled(Context context) {
        schedulePeriodicFetch(context);
    }

    @Override
    public void onDisabled(Context context) {
        if (ClockWidgetProvider.ids(context).length == 0 && DayWidgetProvider.ids(context).length == 0) cancelPeriodicFetch(context);
    }

    /** The 30-minute fetch shared by the week and the clock widget (kept when it already runs). */
    static void schedulePeriodicFetch(Context context) {
        Constraints online = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(RefreshWorker.class, 30, TimeUnit.MINUTES).setConstraints(online).build());
    }

    static void cancelPeriodicFetch(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) WidgetRenderer.render(context, manager, id, true); // the system may have dropped the views
        enqueueFetch(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        WidgetRenderer.render(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            renderAll(context);
            enqueueFetch(context);
        }
    }

    /** Redraws every widget instance (week, clock, day) from the stored data. */
    static void renderAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, WeekWidgetProvider.class))) WidgetRenderer.render(context, manager, id);
        ClockWidgetProvider.renderAll(context);
        DayWidgetProvider.renderAll(context);
    }

    /** Whether at least one widget (week, clock or day) is on a home screen. */
    static boolean hasWidgets(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, WeekWidgetProvider.class)).length > 0
                || ClockWidgetProvider.ids(context).length > 0 || DayWidgetProvider.ids(context).length > 0;
    }

    /** Asks for a fetch as soon as there is a network; a fetch already waiting is kept. */
    static void enqueueFetch(Context context) {
        if (!hasWidgets(context)) return;
        WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, new OneTimeWorkRequest.Builder(RefreshWorker.class)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());
    }

    /**
     * Called when the app pushed a snapshot. A changed one redraws now and fetches unless the last fetch is very recent; an
     * unchanged one redraws nothing and fetches only when the last fetch is old (each fetch can redraw the footer time).
     */
    static void onSnapshot(Context context, boolean changed) {
        if (changed) renderAll(context);
        long gap = changed ? MIN_FETCH_GAP_MS : UNCHANGED_FETCH_GAP_MS;
        if (System.currentTimeMillis() - new WidgetStore(context).fetchedAtMillis() > gap) enqueueFetch(context);
    }

    /** The refresh icon's tap target. */
    static PendingIntent refreshIntent(Context context) {
        Intent i = new Intent(context, WidgetActionReceiver.class).setAction(WidgetActionReceiver.ACTION_REFRESH);
        return PendingIntent.getBroadcast(context, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
