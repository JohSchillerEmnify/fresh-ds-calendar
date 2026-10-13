package lan.mordor.calendar.widget;

import android.graphics.Color;
import org.json.JSONObject;

/** The colour roles of the widget, taken from the app's current theme (snapshot) or a built-in default. */
final class WidgetTheme {
    final int primary, onPrimary, primaryContainer, onPrimaryContainer, surface, surfaceContainer, onSurface, onSurfaceVariant, outlineVariant;

    private WidgetTheme(int[] c) {
        primary = c[0];
        onPrimary = c[1];
        primaryContainer = c[2];
        onPrimaryContainer = c[3];
        surface = c[4];
        surfaceContainer = c[5];
        onSurface = c[6];
        onSurfaceVariant = c[7];
        outlineVariant = c[8];
    }

    /** The theme of the app's default seed, light or dark, for a widget that has no snapshot yet. */
    static WidgetTheme defaults(boolean dark) {
        return new WidgetTheme(dark
                ? new int[] {0xFFB0C7F9, 0xFF122B54, 0xFF324973, 0xFFD6E3FF, 0xFF121318, 0xFF1E1F26, 0xFFE3E2E9, 0xFFC4C6D0, 0xFF44474F}
                : new int[] {0xFF495F8B, 0xFFF9F8FF, 0xFFB0C7F9, 0xFF29406A, 0xFFFAF9FE, 0xFFEDEDF6, 0xFF2F323A, 0xFF5C5F68, 0xFFAFB1BC});
    }

    /** Reads the {@code theme} object of a snapshot; roles that are missing or malformed keep the default's colour. */
    static WidgetTheme fromSnapshot(JSONObject snapshot) {
        boolean dark = snapshot.optBoolean("dark");
        JSONObject t = snapshot.optJSONObject("theme");
        WidgetTheme d = defaults(dark);
        if (t == null) return d;
        String[] keys = {"primary", "onPrimary", "primaryContainer", "onPrimaryContainer", "surface", "surfaceContainer", "onSurface", "onSurfaceVariant", "outlineVariant"};
        int[] base = {d.primary, d.onPrimary, d.primaryContainer, d.onPrimaryContainer, d.surface, d.surfaceContainer, d.onSurface, d.onSurfaceVariant, d.outlineVariant};
        for (int i = 0; i < keys.length; i++) base[i] = color(t.optString(keys[i]), base[i]);
        return new WidgetTheme(base);
    }

    /** Parses {@code #rrggbb}; returns {@code fallback} for anything else. */
    static int color(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (IllegalArgumentException | NullPointerException e) {
            return fallback;
        }
    }
}
