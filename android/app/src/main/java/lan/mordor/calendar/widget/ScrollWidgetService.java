package lan.mordor.calendar.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Feeds the scrolling widget's list on Android 11 and older (newer systems get the rows with the widget, see {@link ScrollWidgetRenderer#build}). */
public class ScrollWidgetService extends RemoteViewsService {
    /** Set when the list is the Multi-day widget's Timeline rather than the List widget's Agenda. */
    static final String EXTRA_TIMELINE = "timeline";

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID), intent.getBooleanExtra(EXTRA_TIMELINE, false));
    }

    /** Builds the rows when the launcher asks for fresh data and hands them out by position. */
    static final class Factory implements RemoteViewsFactory {
        private final Context context;
        private final int widgetId;
        private final boolean timeline;
        /** The day the rows are for; null means today (a test fixes it). */
        private final LocalDate fixedToday;
        private List<RemoteViews> items = List.of();

        Factory(Context context, int widgetId, boolean timeline) {
            this(context, widgetId, timeline, null);
        }

        Factory(Context context, int widgetId, boolean timeline, LocalDate fixedToday) {
            this.context = context;
            this.widgetId = widgetId;
            this.timeline = timeline;
            this.fixedToday = fixedToday;
        }

        @Override
        public void onCreate() {
            // the rows are built in onDataSetChanged, off the main thread
        }

        @Override
        public void onDataSetChanged() {
            LocalDate today = fixedToday != null ? fixedToday : LocalDate.now();
            items = ScrollWidgetRenderer.items(context, ScrollWidgetRenderer.load(context, today), AppWidgetManager.getInstance(context).getAppWidgetOptions(widgetId), today, LocalTime.now(), timeline);
        }

        @Override
        public void onDestroy() {
            items = List.of();
        }

        @Override
        public int getCount() {
            return items.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            return position < items.size() ? items.get(position) : null;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 3;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
