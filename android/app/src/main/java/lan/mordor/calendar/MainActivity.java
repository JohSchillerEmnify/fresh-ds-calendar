package lan.mordor.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import java.util.regex.Pattern;
import lan.mordor.calendar.notify.RemindersPlugin;
import lan.mordor.calendar.widget.ServerConfig;
import lan.mordor.calendar.widget.WidgetBridgePlugin;

/**
 * The Capacitor shell: loads the calendar server the person chose (or the bundled chooser while there is none), registers
 * the widget, reminder and server-choice plugins, opens widget deep links and turns the system back gesture into a back
 * step inside the web app.
 */
public class MainActivity extends BridgeActivity {
    /** Intent extra set by the widget's tap targets: the app path to open, e.g. {@code /day/2026-10-14} or {@code /clock/2026-10-14}. */
    public static final String EXTRA_PATH = "lan.mordor.calendar.PATH";
    private static final Pattern PATH = Pattern.compile("^/(day|week|clock)/\\d{4}-\\d{2}-\\d{2}$");
    private static volatile boolean foreground;

    /** Whether the app is on screen; a due reminder then shows as the web app's snackbar, not as a notification. */
    public static boolean isInForeground() {
        return foreground;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(RemindersPlugin.class);
        registerPlugin(ServerChoicePlugin.class);
        config = capConfig();
        super.onCreate(savedInstanceState);
        handDownloadsToTheSystem();
        goBackInTheWebView();
        openPathFrom(getIntent());
    }

    /**
     * Capacitor's {@code server.url} is static, but the server is chosen at run time, so the config is built here: with a
     * chosen server it is the {@code server.url}, which makes that origin the app's origin (the JavaScript bridge is
     * injected there and plugins work); without one there is no URL and the bundled chooser page ({@code android/www}) loads.
     */
    private CapConfig capConfig() {
        CapConfig.Builder builder = new CapConfig.Builder(this).setErrorPath("error.html");
        String base = ServerConfig.baseUrl(this);
        if (base != null) builder.setServerUrl(base);
        return builder.create();
    }

    /**
     * The Capacitor WebView has no download handler, so a navigation to a file (the Settings "Update the app" button loads
     * {@code /app.apk}) would be dropped. Downloads of the calendar's own host are handed to the system browser, which downloads
     * the file and shows its notification; any other host is ignored.
     */
    private void handDownloadsToTheSystem() {
        String base = ServerConfig.baseUrl(this);
        getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (base == null || url == null || !(url.equals(base) || url.startsWith(base + "/"))) return;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException ignored) {
                // no browser installed: nothing to hand the download to
            }
        });
    }

    /**
     * Without this the back gesture finishes the activity, whatever is open. The web app keeps a history entry for every
     * open overlay and every navigation (web/src/lib/overlayHistory.ts), so a WebView back step closes the topmost
     * overlay, else goes to the previous view; only with no history left does back leave the app (the default handling).
     */
    private void goBackInTheWebView() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge().getWebView();
                if (web.canGoBack()) {
                    web.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        foreground = true;
    }

    @Override
    public void onPause() {
        foreground = false;
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openPathFrom(intent);
    }

    /**
     * Navigates the WebView to the widget's path (only a day, week or clock path of the calendar itself is accepted), or, for the
     * sign-in deep link {@code lan.mordor.calendar://auth?code=...}, to the server's code exchange, which sets the session
     * cookie in this WebView.
     */
    private void openPathFrom(Intent intent) {
        String base = ServerConfig.baseUrl(this);
        Uri link = intent == null ? null : intent.getData();
        String exchange = link == null ? null : AppSignIn.exchangeUrl(base, link.toString(), PendingSignIn.peek(this));
        if (exchange != null) {
            // the verifier is used up with the link: a replayed link finds no sign-in pending
            PendingSignIn.clear(this);
            // consumed: a later re-delivery of this intent must not replay the single-use code
            intent.setData(null);
            WebView web = getBridge().getWebView();
            web.post(() -> web.loadUrl(exchange));
            return;
        }
        String path = intent == null ? null : intent.getStringExtra(EXTRA_PATH);
        // no server chosen yet: the chooser is showing, there is nothing to open
        if (base == null || path == null || !PATH.matcher(path).matches()) return;
        intent.removeExtra(EXTRA_PATH);
        WebView web = getBridge().getWebView();
        // posted so that it runs after the initial load of a cold start
        web.post(() -> web.loadUrl(base + path));
    }
}
