package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.Activity;
import android.appwidget.AppWidgetHostView;
import android.content.Context;
import android.os.Bundle;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ListView;
import android.widget.RemoteViews;
import androidx.test.core.app.ApplicationProvider;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import lan.mordor.calendar.R;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/**
 * The Multi-day widget applied the way AppWidgetHostView.applyRemoteViews does it: views with the layout of the shown ones are
 * reapplied to the same view, others (and a rebuilt launcher) inflate a fresh one (feature scrolling-widget: it opens with half an
 * hour before now at the top, and an update never throws the list back to 00:00).
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, qualifiers = "w360dp-h640dp-xhdpi")
public class ScrollWidgetHostTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private static final LocalTime NOW = LocalTime.of(7, 20);
    private static final int W_DP = 300, H_DP = 380;
    private final Context ctx = ApplicationProvider.getApplicationContext();
    private Activity activity;
    private AppWidgetHostView host;

    @Before
    public void setUp() throws Exception {
        JSONArray days = new JSONArray();
        for (int i = 0; i < 16; i++) days.put(new JSONObject().put("date", LocalDate.of(2026, 10, 12).plusDays(i).toString()).put("events", new JSONArray()));
        JSONObject s = new JSONObject().put("v", 1).put("generatedAt", "x").put("language", "en").put("dark", false).put("weekStart", "2026-10-12").put("days", days)
                .put("tasklists", new JSONArray()).put("minEventMinutes", 0).put("weekSideBySide", 2).put("scrollStyle", "timeline").put("scrollDays", 3);
        WidgetStore store = new WidgetStore(ctx);
        store.clearAll();
        store.saveSnapshot(s.toString());
        activity = Robolectric.buildActivity(Activity.class).setup().get();
        host = new AppWidgetHostView(activity);
        FrameLayout parent = new FrameLayout(activity);
        activity.setContentView(parent);
        parent.addView(host, new FrameLayout.LayoutParams(px(W_DP), px(H_DP)));
    }

    private int px(float dp) {
        return Math.round(dp * ctx.getResources().getDisplayMetrics().density);
    }

    private static Bundle size() {
        Bundle b = new Bundle();
        b.putInt("appWidgetMinWidth", W_DP);
        b.putInt("appWidgetMaxWidth", W_DP);
        b.putInt("appWidgetMinHeight", H_DP);
        b.putInt("appWidgetMaxHeight", H_DP);
        return b;
    }

    /** The views last handed to the host, as the system keeps them. */
    private RemoteViews shown;

    /** The host's side of an update: reapply when the layout is the shown one (RemoteViews.canRecycleView), else inflate afresh. */
    private void apply(int widgetId, RemoteViews rv) {
        if (shown != null && shown.getLayoutId() == rv.getLayoutId() && host.getChildCount() > 0) {
            rv.reapply(activity, host.getChildAt(0));
        } else {
            host.removeAllViews();
            host.addView(rv.apply(activity, host));
        }
        shown = rv;
    }

    private void update() {
        assertTrue(ScrollWidgetProvider.push(ctx, this::apply, 7, size(), true, TODAY, NOW));
    }

    /** Lets the host lay out and the list's scroller run to its end. */
    private void settle() {
        for (int i = 0; i < 3; i++) {
            ViewGroup root = (ViewGroup) host.getParent();
            root.measure(View.MeasureSpec.makeMeasureSpec(px(W_DP), View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(px(H_DP), View.MeasureSpec.EXACTLY));
            root.layout(0, 0, px(W_DP), px(H_DP));
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(5));
        }
    }

    private ListView list() {
        return host.findViewById(R.id.list);
    }

    /** The list's scroll in dp: the measured heights of the rows above the first shown one, plus how far that one is cut off. */
    private double scrolledDp() {
        ListView list = list();
        int first = list.getFirstVisiblePosition();
        int scrolled = -list.getChildAt(0).getTop();
        for (int i = 0; i < first; i++) {
            View row = list.getAdapter().getView(i, null, list);
            row.measure(View.MeasureSpec.makeMeasureSpec(list.getWidth(), View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
            scrolled += row.getMeasuredHeight();
        }
        return scrolled / (double) ctx.getResources().getDisplayMetrics().density;
    }

    /** The dp of the minute that should be at the top: half an hour before now, below the band and the picture's top padding. */
    private double wantedDp() {
        ScrollWidgetRenderer.Model m = ScrollWidgetRenderer.load(ctx, TODAY);
        TimelineRows.Plan plan = TimelineRows.plan(m.data, TODAY, m.choice.days, m.str, m.choice.hours, WidgetRenderer.heightDp(ctx, size()), NOW);
        assertEquals("half an hour before now", 6 * 60 + 50, plan.startMin);
        return plan.bandDp + WeekCanvas.PAD + plan.startMin / 60f * plan.hourDp;
    }

    @Test
    public void aPlacedWidgetOpensWithHalfAnHourBeforeNowAtTheTop() {
        update();
        settle();
        assertEquals(wantedDp(), scrolledDp(), 1.0);
    }

    @Test
    public void anUpdateAfterTheUserScrolledShowsHalfAnHourBeforeNowAgainNotTheTop() {
        update();
        settle();
        list().scrollListBy(px(60));
        settle();
        update();
        settle();
        assertEquals(wantedDp(), scrolledDp(), 1.0);
    }

    @Test
    public void aRebuiltLauncherOpensTheKeptViewsAtTheSamePlace() {
        update();
        settle();
        update();
        settle();
        RemoteViews kept = shown;
        host.removeAllViews();
        host.addView(kept.apply(activity, host));
        settle();
        assertEquals(wantedDp(), scrolledDp(), 1.0);
    }
}
