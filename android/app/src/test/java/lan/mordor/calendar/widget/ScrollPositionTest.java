package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.robolectric.Shadows.shadowOf;

import android.content.Context;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.ListView;
import androidx.test.core.app.ApplicationProvider;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * Runs the framework's own ListView with the Multi-day rows and the row the plan scrolls to, and checks the minute that ends up at the
 * top (feature scrolling-widget: the widget opens with half an hour before now at the top).
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, qualifiers = "w360dp-h640dp-xhdpi")
public class ScrollPositionTest {
    private static final LocalDate TODAY = LocalDate.parse("2026-10-14");
    private final Context ctx = ApplicationProvider.getApplicationContext();

    /** The offset in dp of the grid at the top of a list with the plan's rows after {@code smoothScrollToPosition(plan.scrollRow)}. */
    private double dpAtTop(TimelineRows.Plan plan, float listDp) {
        float d = ctx.getResources().getDisplayMetrics().density;
        int n = plan.rowCount();
        int[] heights = new int[n];
        float gridTop = WeekCanvas.PAD + plan.bandDp;
        int top = 0;
        for (int i = 0; i < n; i++) {
            int end = i == n - 1 ? Math.round(plan.totalDp() * d) : Math.round((gridTop + plan.marks[i + 1] / 60f * plan.hourDp) * d);
            heights[i] = end - top;
            top = end;
        }
        ListView list = new ListView(ctx);
        list.setDivider(null); // like the widget layout
        list.setAdapter(new BaseAdapter() {
            public int getCount() { return n; }
            public Object getItem(int p) { return p; }
            public long getItemId(int p) { return p; }
            public View getView(int p, View v, ViewGroup parent) {
                View row = new View(ctx);
                row.setLayoutParams(new ListView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, heights[p]));
                return row;
            }
        });
        // attached to a window: the scroller's animation frames only run then
        android.app.Activity activity = org.robolectric.Robolectric.buildActivity(android.app.Activity.class).setup().get();
        FrameLayout parent = new FrameLayout(activity);
        activity.setContentView(parent, new ViewGroup.LayoutParams(Math.round(300 * d), Math.round(listDp * d)));
        int w = Math.round(300 * d), h = Math.round(listDp * d);
        parent.addView(list, new FrameLayout.LayoutParams(w, h));
        parent.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        parent.layout(0, 0, w, h);
        shadowOf(Looper.getMainLooper()).idle();
        list.smoothScrollToPosition(plan.scrollRow);
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(10));
        int first = list.getFirstVisiblePosition();
        int scrolled = -list.getChildAt(0).getTop();
        for (int i = 0; i < first; i++) scrolled += heights[i];
        return scrolled / d - (plan.bandDp + WeekCanvas.PAD);
    }

    private TimelineRows.Plan plan(int hours, LocalTime now) throws Exception {
        WeekData data = WeekData.fromItems(new JSONArray("[]"), TODAY, LocalDate.parse("2026-10-12"), 0, true, 16);
        return TimelineRows.plan(data, TODAY, 3, new WidgetStrings("en"), hours, 380, now, 1f);
    }

    @Test
    public void theListOpensWithTheWantedMinuteAtTheTop() throws Exception {
        float listDp = 380 - TimelineRows.HEAD_DP;
        for (int hours : new int[] {8, 12, 16}) {
            for (int hour = 0; hour < 24; hour++) {
                TimelineRows.Plan plan = plan(hours, LocalTime.of(hour, 40));
                if (plan.scrollRow < 0) continue;
                assertEquals(hours + " h at " + hour + ":40", plan.startMin / 60f * plan.hourDp, dpAtTop(plan, listDp), 0.6);
            }
        }
    }
}
