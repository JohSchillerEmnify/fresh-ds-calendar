package lan.mordor.calendar.widget;

import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import androidx.test.core.app.ApplicationProvider;
import lan.mordor.calendar.R;
import java.io.File;
import java.io.FileOutputStream;
import java.time.LocalDate;
import java.time.LocalTime;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/** Draws the whole scrolling widget (both styles, light and dark) into {@code build/widget-pictures/} for a look without a device. */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, qualifiers = "w360dp-h640dp-xhdpi")
public class ScrollWidgetPictureTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private final Context ctx = ApplicationProvider.getApplicationContext();

    private static void add(JSONArray days, int day, String title, boolean allDay, String start, String end, String color) throws Exception {
        days.getJSONObject(day).getJSONArray("events").put(new JSONObject().put("title", title).put("allDay", allDay)
                .put("start", start).put("end", end).put("color", color));
    }

    private String snapshot(boolean dark, String style, int n) throws Exception {
        JSONArray days = new JSONArray();
        for (int i = 0; i < 16; i++) days.put(new JSONObject().put("date", LocalDate.of(2026, 10, 12).plusDays(i).toString()).put("events", new JSONArray()));
        add(days, 2, "Holiday in Lisbon", true, null, null, "#8e24aa");
        add(days, 2, "Standup", false, "09:30", "09:45", "#039be5");
        add(days, 2, "Dentist", false, "10:00", "11:00", "#d50000");
        add(days, 2, "Lunch with Sam", false, "12:30", "13:30", "#33b679");
        add(days, 2, "Deep work", false, "14:00", "16:30", "#3f51b5");
        add(days, 3, "Yoga", false, "07:00", "08:00", "#f4511e");
        add(days, 3, "Planning", false, "10:00", "12:00", "#039be5");
        add(days, 4, "Team offsite", true, null, null, "#0b8043");
        add(days, 4, "Movie night", false, "20:00", "22:00", "#3f51b5");
        add(days, 8, "Flight to Berlin", false, "06:15", "08:00", "#d50000");
        JSONArray tasks = new JSONArray().put(new JSONObject().put("title", "Groceries").put("done", 1).put("total", 3).put("color", "#0b8043"));
        return new JSONObject().put("v", 1).put("generatedAt", "x").put("language", "en").put("dark", dark).put("weekStart", "2026-10-12").put("days", days)
                .put("tasklists", tasks).put("minEventMinutes", 0).put("weekSideBySide", 2).put("scrollStyle", style).put("scrollDays", n).toString();
    }

    private void shoot(boolean dark, String style, int n, int widthDp, int heightDp, String name) throws Exception {
        new WidgetStore(ctx).clearAll();
        new WidgetStore(ctx).saveSnapshot(snapshot(dark, style, n));
        Bundle o = new Bundle();
        o.putInt("appWidgetMinWidth", widthDp);
        o.putInt("appWidgetMaxWidth", widthDp);
        o.putInt("appWidgetMinHeight", heightDp);
        o.putInt("appWidgetMaxHeight", heightDp);
        RemoteViews rv = ScrollWidgetRenderer.build(ctx, 1, o, TODAY, LocalTime.of(10, 20));
        float d = ctx.getResources().getDisplayMetrics().density;
        int w = Math.round(widthDp * d), h = Math.round(heightDp * d);
        FrameLayout parent = new FrameLayout(ctx);
        View v = rv.apply(ctx, parent);
        // a ListView fills only inside a launcher: stack the rows by hand, in the list's place
        View list = v.findViewById(R.id.list);
        if (list != null && list.getVisibility() == View.VISIBLE) {
            ViewGroup box = (ViewGroup) list.getParent();
            android.widget.LinearLayout rows = new android.widget.LinearLayout(ctx);
            rows.setOrientation(android.widget.LinearLayout.VERTICAL);
            for (RemoteViews row : ScrollWidgetRenderer.items(ctx, ScrollWidgetRenderer.load(ctx, TODAY), o, TODAY, LocalTime.of(10, 20))) rows.addView(row.apply(ctx, rows));
            box.addView(rows, box.indexOfChild(list), new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            box.removeView(list);
        }
        parent.addView(v, new ViewGroup.LayoutParams(w, h));
        parent.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        parent.layout(0, 0, w, h);
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        parent.draw(new Canvas(bmp));
        File dir = new File("build/widget-pictures");
        dir.mkdirs();
        try (FileOutputStream out = new FileOutputStream(new File(dir, name))) {
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
        }
        assertTrue(new File(dir, name).length() > 0);
    }

    @Test
    public void drawsTheWidget() throws Exception {
        shoot(false, "agenda", 3, 300, 380, "scroll-agenda-light.png");
        shoot(true, "agenda", 3, 300, 380, "scroll-agenda-dark.png");
        shoot(false, "agenda", 3, 130, 300, "scroll-agenda-narrow.png");
        shoot(false, "timeline", 3, 300, 380, "scroll-timeline-light.png");
        shoot(true, "timeline", 3, 300, 380, "scroll-timeline-dark.png");
        shoot(false, "timeline", 7, 300, 380, "scroll-timeline-7.png");
        shoot(false, "timeline", 1, 200, 300, "scroll-timeline-1.png");
    }
}
