package lan.mordor.calendar.widget;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.TextUtils;
import java.util.ArrayList;
import java.util.List;

/**
 * Draws today as the app's 24-hour clock (ARCHITECTURE "Android app and widget", clock widget): the day ring with the
 * elapsed part, the plate with hour ticks, events and task lists as arcs on lanes, the focus wedge from the hand to the end
 * of the running event or the start of the next one, and the hand. The digital time in the middle is a live
 * {@code TextClock} over the bitmap (the system ticks it every minute); the bitmap itself is redrawn every few minutes.
 * Geometry follows the web dial ({@code ClockView.vue}): radii are fractions of the half size {@code H = 210} units.
 */
final class ClockCanvas {
    private static final float H = 210f;
    /** Where the hand starts: it leaves the middle free for the time. */
    static final float HAND_FROM = 0.36f;

    private ClockCanvas() {}

    static Bitmap draw(List<WeekData.Item> items, WidgetTheme th, WidgetStrings str, int nowMin, int sizePx, float density) {
        Bitmap bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        float cx = sizePx / 2f, cy = sizePx / 2f, k = (sizePx / 2f) / H;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        // day ring and the elapsed part
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(8 * k);
        p.setColor(th.surfaceContainer);
        c.drawCircle(cx, cy, 205 * k, p);
        p.setColor(th.primary);
        p.setStrokeCap(Paint.Cap.ROUND);
        if (nowMin > 0) c.drawArc(oval(cx, cy, 205 * k), -90, ClockLayout.angle(nowMin), false, p);

        // plate
        p.setStyle(Paint.Style.FILL);
        p.setColor(blend(th.surfaceContainer, th.surface, 0.5f));
        c.drawCircle(cx, cy, 178 * k, p);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(Math.max(1, k));
        p.setColor(th.outlineVariant);
        c.drawCircle(cx, cy, 178 * k, p);

        // focus wedge
        ClockLayout.Wedge w = ClockLayout.wedge(items, nowMin);
        if (w != null && w.to > w.from) {
            p.setStyle(Paint.Style.FILL);
            p.setColor(withAlpha(WidgetTheme.color(w.color, th.primary), 0.18f));
            c.drawArc(oval(cx, cy, 166 * k), -90 + ClockLayout.angle(w.from), ClockLayout.angle(w.to - w.from), true, p);
        }

        // hour ticks and the 00/06/12/18 labels
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeCap(Paint.Cap.BUTT);
        for (int h = 0; h < 24; h++) {
            boolean major = h % 6 == 0;
            p.setStrokeWidth((major ? 2 : 1) * Math.max(1, k));
            p.setColor(major ? th.onSurfaceVariant : th.outlineVariant);
            line(c, cx, cy, h * 60, 178 * k, (major ? 166 : 172) * k, p);
        }
        TextPaint tp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        tp.setTextAlign(Paint.Align.CENTER);
        tp.setColor(th.onSurfaceVariant);
        tp.setTextSize(Math.max(7 * density, 15 * k));
        for (int h = 0; h < 24; h += 6) {
            float a = (float) Math.toRadians(ClockLayout.angle(h * 60));
            float r = 191 * k;
            c.drawText(String.format("%02d", h), cx + r * (float) Math.sin(a), cy - r * (float) Math.cos(a) - (tp.ascent() + tp.descent()) / 2, tp);
        }

        // arcs
        for (ClockLayout.Arc arc : ClockLayout.arcs(items)) {
            WeekData.Item i = arc.item;
            float r = (172 - 14 - arc.lane * 17) * k;
            if (r < 70 * k) continue; // too many overlaps for a widget: the app shows them
            p.setStyle(Paint.Style.STROKE);
            p.setColor(withAlpha(WidgetTheme.color(i.color, th.primary), i.taskList && i.total > 0 && i.done >= i.total ? 0.45f : 0.95f));
            p.setStrokeWidth((i.taskList ? 7 : 14) * k);
            p.setStrokeCap(i.taskList ? Paint.Cap.BUTT : Paint.Cap.ROUND);
            p.setPathEffect(i.taskList ? new DashPathEffect(new float[] {5 * k, 4 * k}, 0) : null);
            float sweep = Math.max(0.5f, ClockLayout.angle(Math.min(i.endMin, 1440) - i.startMin));
            c.drawArc(oval(cx, cy, r), -90 + ClockLayout.angle(i.startMin), sweep, false, p);
            p.setPathEffect(null);
        }

        // hand: from the edge of the middle to the plate
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeWidth(3 * k + 1);
        p.setColor(th.primary);
        line(c, cx, cy, nowMin, HAND_FROM * 178 * k, 166 * k, p);
        p.setStyle(Paint.Style.FILL);
        float a = (float) Math.toRadians(ClockLayout.angle(nowMin));
        c.drawCircle(cx + 166 * k * (float) Math.sin(a), cy - 166 * k * (float) Math.cos(a), 5 * k + 1, p);

        // middle: all-day above, the now line and the untimed lists below the (live) time
        float maxW = 230 * k;
        List<String> allDay = new ArrayList<>(), untimed = new ArrayList<>();
        String allDayColor = null;
        for (WeekData.Item i : items) {
            if (!i.taskList && i.allDay) { allDay.add(ClockLayout.title(i, str)); if (allDayColor == null) allDayColor = i.color; }
            else if (i.taskList && !i.timed()) untimed.add(ClockLayout.title(i, str));
        }
        tp.setTextSize(Math.max(8 * density, 15 * k));
        tp.setTypeface(Typeface.DEFAULT_BOLD);
        if (!allDay.isEmpty()) {
            tp.setColor(WidgetTheme.color(allDayColor, th.onSurface));
            String t = allDay.size() > 1 ? allDay.get(0) + " +" + (allDay.size() - 1) : allDay.get(0);
            c.drawText(TextUtils.ellipsize(t, tp, maxW, TextUtils.TruncateAt.END).toString(), cx, cy - 46 * k, tp);
        }
        tp.setColor(th.onSurface);
        c.drawText(TextUtils.ellipsize(ClockLayout.nowLine(items, nowMin, str), tp, maxW, TextUtils.TruncateAt.END).toString(), cx, cy + 56 * k, tp);
        if (!untimed.isEmpty()) {
            tp.setTypeface(Typeface.DEFAULT);
            tp.setColor(th.onSurfaceVariant);
            c.drawText(TextUtils.ellipsize(TextUtils.join(", ", untimed), tp, maxW * 0.9f, TextUtils.TruncateAt.END).toString(), cx, cy + 78 * k, tp);
        }
        return bmp;
    }

    private static RectF oval(float cx, float cy, float r) {
        return new RectF(cx - r, cy - r, cx + r, cy + r);
    }

    private static void line(Canvas c, float cx, float cy, float minutes, float r0, float r1, Paint p) {
        float a = (float) Math.toRadians(ClockLayout.angle(minutes));
        float s = (float) Math.sin(a), co = (float) Math.cos(a);
        c.drawLine(cx + r0 * s, cy - r0 * co, cx + r1 * s, cy - r1 * co, p);
    }

    private static int withAlpha(int color, float alpha) {
        return Color.argb(Math.round(alpha * 255), Color.red(color), Color.green(color), Color.blue(color));
    }

    private static int blend(int a, int b, float t) {
        return Color.rgb(Math.round(Color.red(a) * t + Color.red(b) * (1 - t)), Math.round(Color.green(a) * t + Color.green(b) * (1 - t)),
                Math.round(Color.blue(a) * t + Color.blue(b) * (1 - t)));
    }
}
