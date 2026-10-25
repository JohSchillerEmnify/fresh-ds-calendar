package lan.mordor.calendar.widget;

import android.content.Context;
import android.webkit.CookieManager;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.json.JSONObject;

/**
 * Fetches the current week from the calendar's own API, with the session of the app: the WebView's cookie jar is
 * app-wide, so the widget reads the {@code cal_session} cookie from {@link CookieManager} and sends it back. No key,
 * no new server auth. While the server's sign-in is off there is no cookie and none is needed.
 */
final class WeekFetcher {
    private WeekFetcher() {}

    /** Outcome of one fetch. */
    enum Status { OK, SIGN_IN, ERROR }

    /**
     * Fetches {@code GET /api/items} for the week of {@code today}, with the minimum event length and the "Task categories"
     * switch from {@code GET /api/prefs},
     * and stores the result. {@code excludeHidden=1} makes the
     * server leave out the calendars the person switched off in the app (that state lives on the server, not here).
     *
     * @return OK (stored), SIGN_IN (HTTP 401: session expired or never created; stored as auth state) or ERROR
     *     (offline, server down: the previous data stays)
     */
    static Status fetchAndStore(Context context, WidgetStore store, LocalDate today) {
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1);
        String base = ServerConfig.BASE_URL;
        // the first fetch after the update from the app with the server chooser drops that server's week and snapshot
        ServerConfig.forgetLegacyChoice(context);
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(base + "/api/items?from=" + monday + "&to=" + monday.plusDays(7) + "&excludeHidden=1").openConnection();
            c.setConnectTimeout(10_000);
            c.setReadTimeout(15_000);
            c.setRequestProperty("Accept", "application/json");
            String cookie = cookies(base);
            if (cookie != null && !cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);
            int code = c.getResponseCode();
            if (code == 401) {
                store.setAuth(WidgetStore.AUTH_SIGN_IN);
                return Status.SIGN_IN;
            }
            if (code != 200) return Status.ERROR;
            // the server slides the session cookie forward on use; hand the new expiry to the WebView's jar
            keepCookies(base, c.getHeaderFields().get("Set-Cookie"));
            JSONObject res = new JSONObject(read(c.getInputStream()));
            JSONObject week = new JSONObject().put("weekStart", monday.toString()).put("items", res.getJSONArray("items"));
            JSONObject prefs = prefs(base, cookie);
            if (prefs != null) week.put("minEventMinutes", prefs.optInt("minEventMinutes", 0)).put("weekSideBySide", prefs.optInt("weekSideBySide", 2)).put("taskCategories", prefs.optBoolean("taskCategories", true));
            store.saveFetched(week.toString(), System.currentTimeMillis());
            return Status.OK;
        } catch (Exception e) {
            return Status.ERROR;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** The person's {@code GET /api/prefs}, or null when they cannot be read (the snapshot's values then stand). */
    private static JSONObject prefs(String base, String cookie) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(base + "/api/prefs").openConnection();
            c.setConnectTimeout(10_000);
            c.setReadTimeout(15_000);
            c.setRequestProperty("Accept", "application/json");
            if (cookie != null && !cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);
            if (c.getResponseCode() != 200) return null;
            return new JSONObject(read(c.getInputStream()));
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String cookies(String base) {
        try {
            return CookieManager.getInstance().getCookie(base);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static void keepCookies(String base, List<String> setCookie) {
        if (setCookie == null) return;
        try {
            CookieManager jar = CookieManager.getInstance();
            for (String line : setCookie) jar.setCookie(base, line);
            jar.flush();
        } catch (RuntimeException e) {
            // no WebView available: the session simply keeps its old expiry
        }
    }

    private static String read(InputStream in) throws java.io.IOException {
        try (in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            in.transferTo(out);
            return out.toString(StandardCharsets.UTF_8);
        }
    }
}
