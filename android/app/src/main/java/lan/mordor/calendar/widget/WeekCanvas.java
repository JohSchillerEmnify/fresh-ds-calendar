package lan.mordor.calendar.widget;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Draws the week the way the app's week view looks (ARCHITECTURE "Android app and widget"): header, weekday row, all-day
 * band with multi-day bars, hour grid with colour blocks packed side by side, task lists, and a now line. RemoteViews cannot
 * place views freely, so the whole picture is one bitmap; all geometry below is in dp and scaled to pixels when drawn.
 */
final class WeekCanvas {
    /** Outer padding, title row, left hour-label gutter, weekday row, footer row (dp). The overlay layout must match these. */
    static final float PAD = 4, HEADER = 20, GUTTER = 22, DAYHEAD = 16, FOOTER = 10;
    /** Height of a band chip or bar and the smallest block in the grid (dp). */
    private static final float CHIP = 13, MIN_BLOCK = 11;
    /** Share of the free height the all-day band may take. */
    private static final float BAND_SHARE = 0.4f;
    private static final float INDENT = 2.5f;

    private final WidgetTheme th;
    private final float s;
    private final Canvas c;
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final TextPaint text = new TextPaint(Paint.ANTI_ALIAS_FLAG);

    private WeekCanvas(Canvas canvas, WidgetTheme theme, float scale) {
        c = canvas;
        th = theme;
        s = scale;
    }

    /**
     * Renders the week.
     *
     * @param data the week, or null when nothing is loaded yet
     * @param footer the footer text ("Updated 09:41"); empty for none
     * @param footerAccent whether the footer is a call to action (drawn in the primary colour)
     * @param minutesNow minutes since midnight, for the now line
     * @param widthPx bitmap width in pixels
     * @param heightPx bitmap height in pixels
     * @param scale pixels per dp
     */
    static Bitmap draw(WeekData data, WidgetTheme theme, WidgetStrings str, LocalDate monday, LocalDate today, int minutesNow, String footer,
            boolean footerAccent, int widthPx, int heightPx, float scale) {
        Bitmap bmp = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
        new WeekCanvas(new Canvas(bmp), theme, scale).paint(data, str, monday, 0, 7, str.weekRange(monday), today, minutesNow, footer, footerAccent,
                widthPx / scale, heightPx / scale);
        return bmp;
    }

    /**
     * Renders one day (the day widget): the same picture as the week with a single wide column, the date as the header and
     * no weekday row, so blocks have room for their time and open items.
     */
    static Bitmap drawDay(WeekData data, WidgetTheme theme, WidgetStrings str, LocalDate monday, LocalDate day, LocalDate today, int minutesNow,
            String footer, boolean footerAccent, int widthPx, int heightPx, float scale) {
        Bitmap bmp = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
        int offset = (int) java.time.temporal.ChronoUnit.DAYS.between(monday, day);
        new WeekCanvas(new Canvas(bmp), theme, scale).paint(data, str, monday, offset, 1, str.dayTitle(day), today, minutesNow, footer, footerAccent,
                widthPx / scale, heightPx / scale);
        return bmp;
    }

    /** Paints {@code n} days starting at {@code offset} days after {@code monday} (7 from 0: the week; 1: a day). */
    private void paint(WeekData data, WidgetStrings str, LocalDate monday, int offset, int n, String header, LocalDate today, int minutesNow,
            String footer, boolean footerAccent, float w, float h) {
        float x0 = PAD + GUTTER, colW = (w - PAD - x0) / n;
        float dayHead = n == 1 ? 0 : DAYHEAD;

        // header and weekday row (the day widget has the date in the header instead)
        label(header, PAD + 4, PAD, w - 2 * PAD - 26, HEADER, 11, th.onSurface, true, Layout.Alignment.ALIGN_NORMAL, true);
        float dayTop = PAD + HEADER;
        for (int i = 0; i < n && n > 1; i++) {
            LocalDate d = monday.plusDays(offset + i);
            boolean isToday = d.equals(today);
            String t = str.weekday(d) + " " + d.getDayOfMonth();
            if (isToday) round(new RectF(x0 + i * colW + 2, dayTop + 1, x0 + (i + 1) * colW - 2, dayTop + DAYHEAD - 1), 7, th.primary);
            label(t, x0 + i * colW, dayTop, colW, DAYHEAD, 8.5f, isToday ? th.onPrimary : th.onSurfaceVariant, isToday, Layout.Alignment.ALIGN_CENTER, true);
        }

        // all-day band: bars on top, the untimed items of each day below
        float bandTop = dayTop + dayHead, gridBottom = h - PAD - FOOTER;
        List<WeekData.Bar> bars = new ArrayList<>();
        if (data != null) for (WeekData.Bar b : data.bars) {
            if (b.endCol < offset || b.startCol > offset + n - 1) continue;
            int sc = Math.max(0, b.startCol - offset), ec = Math.min(n - 1, b.endCol - offset);
            bars.add(new WeekData.Bar(b.id, b.title, b.color, sc, ec, b.lane, b.continuedFromPrev || b.startCol < offset, b.continuesToNext || b.endCol > offset + n - 1));
        }
        List<WeekData.Day> days = data == null ? List.of() : data.days.subList(offset, offset + n);
        int lanes = 0, chips = 0;
        for (WeekData.Bar b : bars) lanes = Math.max(lanes, b.lane + 1);
        for (WeekData.Day d : days) chips = Math.max(chips, untimed(d).size());
        int cap = Math.max(1, (int) ((gridBottom - bandTop) * BAND_SHARE / (CHIP + 1)));
        int barRows = Math.min(lanes, cap), chipRows = Math.min(chips, cap - barRows);
        float bandH = (barRows + chipRows) * (CHIP + 1) + ((barRows + chipRows) > 0 ? 2 : 0);
        if (data != null) {
            for (WeekData.Bar b : bars) if (b.lane < barRows) drawBar(b, x0, colW, bandTop + b.lane * (CHIP + 1));
            for (int i = 0; i < n; i++) {
                List<WeekData.Item> top = untimed(days.get(i));
                int shown = top.size() > chipRows ? chipRows - 1 : top.size();
                for (int j = 0; j < Math.max(0, shown); j++) {
                    float y = bandTop + (barRows + j) * (CHIP + 1);
                    drawItem(new RectF(x0 + i * colW + 1, y, x0 + (i + 1) * colW - 1, y + CHIP), top.get(j), false, false, false);
                }
                if (top.size() > chipRows && chipRows > 0) {
                    float y = bandTop + (barRows + chipRows - 1) * (CHIP + 1);
                    label("+" + (top.size() - shown), x0 + i * colW + 3, y, colW - 4, CHIP, 8, th.onSurfaceVariant, false, Layout.Alignment.ALIGN_NORMAL, true);
                }
            }
        }
        float gridTop = bandTop + bandH;
        line(x0, gridTop, w - PAD, gridTop, th.outlineVariant, 1);

        // hour grid
        int[] range = data == null ? new int[] {WeekLayout.DEFAULT_START_HOUR, WeekLayout.DEFAULT_END_HOUR} : WeekLayout.hourRange(days);
        int first = range[0], last = range[1];
        float hh = (gridBottom - gridTop) / (last - first);
        int step = Math.max(1, (int) Math.ceil(9 / hh));
        for (int i = 0; i < n; i++) {
            if (monday.plusDays(offset + i).equals(today)) round(new RectF(x0 + i * colW, gridTop, x0 + (i + 1) * colW, gridBottom), 0, withAlpha(th.primary, 0.07f));
        }
        for (int hr = first; hr < last; hr++) {
            float y = gridTop + (hr - first) * hh;
            if (hr > first) line(x0, y, w - PAD, y, th.outlineVariant, 0.5f);
            if ((hr - first) % step == 0) label(String.format("%02d", hr), PAD, y - (hr == first ? 0 : 4.5f), GUTTER - 2, 9, 7, th.onSurfaceVariant, false, Layout.Alignment.ALIGN_OPPOSITE, false);
        }
        for (int i = 0; i <= n; i++) line(x0 + i * colW, gridTop, x0 + i * colW, gridBottom, th.outlineVariant, 0.5f);

        // blocks, clipped to the grid
        c.save();
        c.clipRect(x0 * s, gridTop * s, (w - PAD) * s, gridBottom * s);
        if (data != null) {
            for (int i = 0; i < n; i++) {
                boolean isToday = days.get(i).date.equals(today);
                List<WeekLayout.Placed> placed = WeekLayout.packColumns(days.get(i).items, Math.round(MIN_BLOCK / hh * 60));
                placed.sort((a, b) -> Integer.compare(a.level, b.level));
                for (WeekLayout.Placed p : placed) {
                    float cx = x0 + i * colW, bw = colW / p.cols;
                    float left = cx + p.col * bw + p.level * INDENT + 0.5f, width = p.span * bw - p.level * INDENT - 1;
                    float top = gridTop + (p.top / 60f - first) * hh + 0.5f, height = Math.max(p.height / 60f * hh - 1, 1); // p.height already carries the minimum and the clamp
                    boolean past = isToday && !p.item.taskList && p.item.endMin <= minutesNow;
                    drawItem(new RectF(left, top, left + width, top + height), p.item, true, past, false);
                }
            }
        }
        // now line on today
        for (int i = 0; i < n; i++) {
            float y = gridTop + (minutesNow / 60f - first) * hh;
            if (monday.plusDays(offset + i).equals(today) && y >= gridTop && y <= gridBottom) {
                line(x0 + i * colW, y, x0 + (i + 1) * colW, y, th.primary, 1.2f);
                fill.setColor(th.primary);
                c.drawCircle(x0 * s + i * colW * s, y * s, 2.2f * s, fill);
            }
        }
        c.restore();

        // footer
        if (!footer.isEmpty()) label(footer, PAD + 4, h - PAD - FOOTER, w - 2 * PAD, FOOTER, 7.5f, footerAccent ? th.primary : th.onSurfaceVariant, false, Layout.Alignment.ALIGN_NORMAL, true);
    }

    private static List<WeekData.Item> untimed(WeekData.Day d) {
        List<WeekData.Item> l = new ArrayList<>();
        for (WeekData.Item i : d.items) if (!i.timed()) l.add(i);
        return l;
    }

    /** Corner radius (dp) of an entry for the app's corner choice. */
    private float radius(float height) {
        float r = "square".equals(th.corners) ? 1.5f : "pill".equals(th.corners) ? 6f : 3.5f;
        return Math.min(r, height / 2);
    }

    private void drawBar(WeekData.Bar b, float x0, float colW, float y) {
        RectF r = new RectF(x0 + b.startCol * colW + 1, y, x0 + (b.endCol + 1) * colW - 1, y + CHIP);
        int color = WidgetTheme.color(b.color, th.primary);
        entry(r, color, b.continuedFromPrev, b.continuesToNext, false);
        label(b.title, r.left + 3, r.top, r.width() - 4, CHIP, 8.5f, textOn(color), false, Layout.Alignment.ALIGN_NORMAL, true);
    }

    /**
     * Draws one event or task list in {@code r} in the entry style of the app (solid, tinted or outline). A block (grid) shows
     * more lines when it is tall: the time under an event's title, the open names under a task list's.
     */
    private void drawItem(RectF r, WeekData.Item it, boolean block, boolean past, boolean unused) {
        int color = WidgetTheme.color(it.color, th.primary);
        int fg = textOn(color);
        if (past) c.saveLayerAlpha(r.left * s, r.top * s, r.right * s, r.bottom * s, 160);
        entry(r, color, false, false, block);
        float pad = 3, w = r.width() - pad - 1;
        if (it.taskList) {
            float tx = r.left + pad, cbSize = 5;
            checkbox(tx, r.top + 3.5f, cbSize, it.total == 0 ? 0 : (float) it.done / it.total, fg);
            tx += cbSize + 2;
            boolean count = it.total > 0 && r.width() >= 40;
            float cw = count ? 14 : 0;
            label(it.title.isEmpty() ? "·" : it.title, tx, r.top + 0.5f, r.right - tx - cw - 1, 10, 8.5f, fg, false, Layout.Alignment.ALIGN_NORMAL, true);
            if (count) label(it.done + "/" + it.total, r.right - cw - 1, r.top + 1, cw, 10, 7, fg, false, Layout.Alignment.ALIGN_OPPOSITE, true);
            float y = r.top + 11.5f;
            for (String name : it.openItems) {
                if (!block || y + 9 > r.bottom || r.width() < 30) break;
                stroke(new RectF(r.left + pad + 0.5f, y + 2.5f, r.left + pad + 4, y + 6), fg, 0.7f);
                label(name, r.left + pad + 6, y, r.right - r.left - pad - 7, 9, 7.5f, fg, false, Layout.Alignment.ALIGN_NORMAL, true);
                y += 9;
            }
        } else {
            int lines = (int) ((r.height() - 2) / 10);
            boolean time = block && lines >= 2 && r.width() >= 40 && it.startMin >= 0;
            int titleLines = Math.max(1, block ? lines - (time ? 1 : 0) : 1);
            // with a time line under it the title keeps to its own line(s) at the top, so the two never overlap
            float titleH = time ? Math.max(10, r.height() - 1 - 10) : r.height() - 1;
            if (time && titleLines == 1) titleH = 10;
            float used = label(it.title.isEmpty() ? "·" : it.title, r.left + pad, r.top + 0.5f, w, titleH, 8.5f, fg, false, Layout.Alignment.ALIGN_NORMAL, titleLines == 1);
            if (time) label(WeekData.hhmm(it.startMin) + "–" + WeekData.hhmm(it.endMin), r.left + pad, r.top + 0.5f + Math.max(used, 10), w, 9, 7, withAlpha(fg, 0.85f), false, Layout.Alignment.ALIGN_NORMAL, true);
        }
        if (past) c.restore();
    }

    /** The text colour on an entry: contrast colour for solid, the surface text colour otherwise. */
    private int textOn(int color) {
        return "solid".equals(th.entries) ? WeekLayout.onColor(color & 0xFFFFFF) : th.onSurface;
    }

    /** Fills the shape of an entry per the theme's entry style; flat sides where a bar continues into the next week. */
    private void entry(RectF r, int color, boolean flatLeft, boolean flatRight, boolean block) {
        float rad = radius(r.height()) * s, flat = 0;
        float[] radii = {flatLeft ? flat : rad, flatLeft ? flat : rad, flatRight ? flat : rad, flatRight ? flat : rad, flatRight ? flat : rad, flatRight ? flat : rad, flatLeft ? flat : rad, flatLeft ? flat : rad};
        RectF px = new RectF(r.left * s, r.top * s, r.right * s, r.bottom * s);
        Path p = new Path();
        p.addRoundRect(px, radii, Path.Direction.CW);
        fill.setStyle(Paint.Style.FILL);
        if ("outline".equals(th.entries)) {
            fill.setColor(th.surface);
            c.drawPath(p, fill);
            stroke(px, color, 1.2f, p);
        } else {
            fill.setColor("solid".equals(th.entries) ? color : blend(color, th.surface, 0.24f));
            c.drawPath(p, fill);
            if ("tinted".equals(th.entries)) {
                c.save();
                c.clipPath(p);
                fill.setColor(color);
                c.drawRect(px.left, px.top, px.left + 2 * s, px.bottom, fill);
                c.restore();
            }
        }
    }

    private void stroke(RectF px, int color, float widthDp, Path path) {
        fill.setStyle(Paint.Style.STROKE);
        fill.setStrokeWidth(widthDp * s);
        fill.setColor(color);
        c.drawPath(path, fill);
        fill.setStyle(Paint.Style.FILL);
    }

    private void stroke(RectF r, int color, float widthDp) {
        fill.setStyle(Paint.Style.STROKE);
        fill.setStrokeWidth(widthDp * s);
        fill.setColor(color);
        c.drawRect(r.left * s, r.top * s, r.right * s, r.bottom * s, fill);
        fill.setStyle(Paint.Style.FILL);
    }

    /** The task marker: a small box, filled from the bottom by the done share (the web's checkbox glyph). */
    private void checkbox(float x, float y, float size, float done, int color) {
        RectF r = new RectF(x, y, x + size, y + size);
        stroke(r, color, 0.9f);
        if (done > 0) {
            fill.setColor(color);
            c.drawRect(r.left * s, (r.bottom - size * Math.min(1, done)) * s, r.right * s, r.bottom * s, fill);
        }
    }

    private void round(RectF r, float radiusDp, int color) {
        fill.setStyle(Paint.Style.FILL);
        fill.setColor(color);
        c.drawRoundRect(r.left * s, r.top * s, r.right * s, r.bottom * s, radiusDp * s, radiusDp * s, fill);
    }

    private void line(float x1, float y1, float x2, float y2, int color, float widthDp) {
        fill.setColor(color);
        fill.setStrokeWidth(widthDp * s);
        c.drawLine(x1 * s, y1 * s, x2 * s, y2 * s, fill);
    }

    /**
     * Draws text inside a dp box, ellipsised, optionally vertically centred.
     *
     * @return the height (dp) the drawn text takes
     */
    private float label(String t, float x, float y, float w, float h, float sizeDp, int color, boolean bold, Layout.Alignment align, boolean oneLine) {
        if (w <= 2 || h <= 2) return 0;
        text.setTextSize(sizeDp * s);
        text.setColor(color);
        text.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        int maxLines = oneLine ? 1 : Math.max(1, (int) (h / (sizeDp * 1.2f)));
        StaticLayout l = StaticLayout.Builder.obtain(t, 0, t.length(), text, Math.max(1, Math.round(w * s)))
                .setAlignment(align).setMaxLines(maxLines).setEllipsize(TextUtils.TruncateAt.END).setIncludePad(false).build();
        float lh = l.getHeight() / s;
        c.save();
        c.clipRect(x * s, y * s, (x + w) * s, (y + h) * s);
        c.translate(x * s, (y + (oneLine ? Math.max(0, (h - lh) / 2) : 0)) * s);
        l.draw(c);
        c.restore();
        return lh;
    }

    private static int withAlpha(int color, float a) {
        return (Math.round(255 * a) << 24) | (color & 0xFFFFFF);
    }

    private static int blend(int fg, int bg, float a) {
        int r = Math.round(((fg >> 16) & 255) * a + ((bg >> 16) & 255) * (1 - a));
        int g = Math.round(((fg >> 8) & 255) * a + ((bg >> 8) & 255) * (1 - a));
        int b = Math.round((fg & 255) * a + (bg & 255) * (1 - a));
        return 0xFF000000 | r << 16 | g << 8 | b;
    }
}
