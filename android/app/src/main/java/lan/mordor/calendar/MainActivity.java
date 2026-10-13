package lan.mordor.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.util.regex.Pattern;
import lan.mordor.calendar.widget.ServerConfig;
import lan.mordor.calendar.widget.WidgetBridgePlugin;

/** The Capacitor shell: loads the LAN calendar, registers the widget plugin and opens widget deep links. */
public class MainActivity extends BridgeActivity {
    /** Intent extra set by the widget's tap targets: the app path to open, e.g. {@code /day/2026-10-14}. */
    public static final String EXTRA_PATH = "lan.mordor.calendar.PATH";
    private static final Pattern PATH = Pattern.compile("^/(day|week)/\\d{4}-\\d{2}-\\d{2}$");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        handDownloadsToTheSystem();
        openPathFrom(getIntent());
    }

    /**
     * The Capacitor WebView has no download handler, so a navigation to a file (the Settings "Update the app" button loads
     * {@code /app.apk}) would be dropped. Downloads of the calendar's own host are handed to the system browser, which downloads
     * the file and shows its notification; any other host is ignored.
     */
    private void handDownloadsToTheSystem() {
        String base = ServerConfig.baseUrl(this);
        getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null || !(url.equals(base) || url.startsWith(base + "/"))) return;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException ignored) {
                // no browser installed: nothing to hand the download to
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openPathFrom(intent);
    }

    /** Navigates the WebView to the widget's path; only a day or week path of the calendar itself is accepted. */
    private void openPathFrom(Intent intent) {
        String path = intent == null ? null : intent.getStringExtra(EXTRA_PATH);
        if (path == null || !PATH.matcher(path).matches()) return;
        intent.removeExtra(EXTRA_PATH);
        WebView web = getBridge().getWebView();
        // posted so that it runs after the initial load of a cold start
        web.post(() -> web.loadUrl(ServerConfig.baseUrl(this) + path));
    }
}
