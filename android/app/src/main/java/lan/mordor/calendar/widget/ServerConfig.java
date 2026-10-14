package lan.mordor.calendar.widget;

import android.content.Context;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** The calendar server's base URL: the one {@code capacitor.config.ts} loads into the WebView (single source of truth). */
public final class ServerConfig {
    private ServerConfig() {}

    /** The base URL without a trailing slash, e.g. {@code http://cal.mordor.lan}. */
    public static String baseUrl(Context context) {
        try (InputStream in = context.getAssets().open("capacitor.config.json")) {
            String url = new JSONObject(new String(in.readAllBytes(), StandardCharsets.UTF_8)).getJSONObject("server").getString("url");
            return url.replaceAll("/+$", "");
        } catch (Exception e) {
            throw new IllegalStateException("capacitor.config.json has no server.url", e);
        }
    }
}
