package lan.mordor.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import lan.mordor.calendar.widget.ServerConfig;

/**
 * Capacitor plugin {@code ServerChoice}: lets the web app show which server it runs on and go back to the chooser. The
 * bundled pages (chooser, offline page) have no JavaScript bridge, so they reach the same actions as links to
 * {@code https://localhost/__server/<action>}, which this plugin intercepts in {@link #shouldOverrideLoad}, where it also
 * sends the Google sign-in start to the system browser.
 */
@CapacitorPlugin(name = "ServerChoice")
public class ServerChoicePlugin extends Plugin {
    private static final String LOCAL_HOST = "localhost";
    private static final String PREFIX = "/__server/";

    /** {@code get()}: {@code { url, host }} of the server in use; empty while nothing is chosen. */
    @PluginMethod
    public void get(PluginCall call) {
        String base = ServerConfig.baseUrl(getContext());
        JSObject res = new JSObject();
        if (base != null) res.put("url", base).put("host", Uri.parse(base).getHost());
        call.resolve(res);
    }

    /** {@code choose()}: forgets the choice and returns to the chooser (the activity restarts). */
    @PluginMethod
    public void choose(PluginCall call) {
        ServerConfig.clear(getContext());
        call.resolve(new JSObject());
        restart();
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        // Google refuses OAuth in a WebView: the sign-in starts in the system browser instead (see AppSignIn)
        String browser = AppSignIn.browserUrl(ServerConfig.baseUrl(getContext()), url.toString());
        if (browser != null) {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(browser)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException ignored) {
                // no browser installed: nothing can sign in
            }
            return true;
        }
        if (!"https".equals(url.getScheme()) || !LOCAL_HOST.equals(url.getHost()) || url.getPath() == null || !url.getPath().startsWith(PREFIX)) {
            return null;
        }
        String action = url.getPath().substring(PREFIX.length());
        if (action.equals("fresh")) {
            ServerConfig.choose(getContext(), ServerConfig.FRESH);
            restart();
        } else if (action.equals("mordor")) {
            ServerConfig.choose(getContext(), ServerConfig.MORDOR);
            restart();
        } else if (action.equals("choose")) {
            ServerConfig.clear(getContext());
            restart();
        } else if (action.equals("retry")) {
            String base = ServerConfig.baseUrl(getContext());
            if (base != null) bridge.getWebView().loadUrl(base);
        }
        return true;
    }

    /** Recreates the activity so the bridge is built again, for the chosen server or the chooser. */
    private void restart() {
        getActivity().runOnUiThread(() -> getActivity().recreate());
    }
}
