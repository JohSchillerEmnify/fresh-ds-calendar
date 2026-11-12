package lan.mordor.calendar.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.util.DisplayMetrics;
import android.util.Log;
import android.widget.RemoteViews;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keeps a widget's pictures within the bitmap memory the system takes per update. The system's limit is 6 bytes per pixel of the
 * screen it measured when the phone started (AppWidgetServiceImpl.computeMaximumWidgetBitmapMemory) and an app cannot read it; after
 * a change of the screen resolution the app's screen can be larger, the update is refused with an IllegalArgumentException and
 * the app crashed. So a refusal names the limit, the picture is drawn again within it and the update is retried.
 */
final class BitmapBudget {
    private static final String TAG = "BitmapBudget";
    private static final String REFUSED = "exceeds maximum bitmap memory usage";
    private static final Pattern MAX = Pattern.compile("max: (\\d+)");
    private static final int ATTEMPTS = 4;
    /** The bytes the system takes, learned from a refusal; 0 while none was refused (in this process). */
    private static volatile long limitBytes;

    private BitmapBudget() {}

    /** Hands an update to the system; {@link AppWidgetManager#updateAppWidget} on a device. */
    interface Updater {
        void update(int widgetId, RemoteViews views);
    }

    /** The most pixels one widget's pictures may have together (4 bytes each): one screen, and 90 % of a learned limit. */
    static long pixels(Context context) {
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        long screen = (long) dm.widthPixels * dm.heightPixels;
        long limit = limitBytes;
        return limit > 0 ? Math.max(1, Math.min(screen, limit * 9 / 10 / 4)) : screen;
    }

    static boolean push(Context context, AppWidgetManager manager, int widgetId, Supplier<RemoteViews> build) {
        return push(context, manager::updateAppWidget, widgetId, build);
    }

    /** Builds and hands over the views, drawn smaller after a refusal for bitmap memory; false when even that was refused. */
    static boolean push(Context context, Updater out, int widgetId, Supplier<RemoteViews> build) {
        for (int i = 0; i < ATTEMPTS; i++) {
            try {
                out.update(widgetId, build.get());
                return true;
            } catch (IllegalArgumentException e) {
                String message = e.getMessage();
                if (message == null || !message.contains(REFUSED)) throw e;
                learn(message, pixels(context));
            }
        }
        Log.w(TAG, "the system refused the widget's picture " + ATTEMPTS + " times");
        return false;
    }

    /** Takes the limit from the refusal; refused again within it (or without a number), half of what was tried. */
    static void learn(String message, long pixelsTried) {
        Matcher m = MAX.matcher(message);
        long max = m.find() ? Long.parseLong(m.group(1)) : 0;
        limitBytes = max > 0 && (limitBytes == 0 || max < limitBytes) ? max : Math.max(4, pixelsTried * 4 / 2);
    }

    /** Forgets the learned limit (tests). */
    static void reset() {
        limitBytes = 0;
    }
}
