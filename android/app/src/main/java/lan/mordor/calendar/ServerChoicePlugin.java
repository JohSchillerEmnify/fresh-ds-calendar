package lan.mordor.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import lan.mordor.calendar.widget.ServerConfig;

/**
 * Capacitor plugin {@code ServerChoice} (the name stays: web apps already deployed call it): tells the web app the
 * installed app's version, sends the Google sign-in start to the system browser ({@link #shouldOverrideLoad}) and serves
 * the offline page's "Try again" link ({@code https://localhost/__server/retry}; that page has no JavaScript bridge). The
 * server is no longer chosen (owner 2026-10-23): {@link ServerConfig#BASE_URL}.
 */
@CapacitorPlugin(name = "ServerChoice")
public class ServerChoicePlugin extends Plugin {
    private static final String LOCAL_HOST = "localhost";
    private static final String PREFIX = "/__server/";

    /** {@code appVersion()}: {@code { versionCode }} of the installed app, which the web app compares with the published APK. */
    @PluginMethod
    public void appVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            call.resolve(new JSObject().put("versionCode", (int) info.getLongVersionCode()));
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("version unknown");
        }
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        // Google refuses OAuth in a WebView: the sign-in starts in the system browser instead (see AppSignIn)
        String verifier = AppSignIn.newVerifier();
        String browser = AppSignIn.browserUrl(ServerConfig.BASE_URL, url.toString(), AppSignIn.challenge(verifier));
        if (browser != null) {
            // kept until the deep link of this sign-in returns; only its SHA-256 goes through the browser
            PendingSignIn.save(getContext(), verifier);
            Uri start = Uri.parse(browser);
            try {
                // a Custom Tab (the standard OAuth surface) always follows the redirect chain, and the server's final
                // intent redirect brings the app back to the front, which closes it
                new CustomTabsIntent.Builder().build().launchUrl(getActivity(), start);
            } catch (ActivityNotFoundException e) {
                try {
                    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, start).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (ActivityNotFoundException ignored) {
                    // no browser installed: nothing can sign in
                }
            }
            return true;
        }
        if (!"https".equals(url.getScheme()) || !LOCAL_HOST.equals(url.getHost()) || url.getPath() == null || !url.getPath().startsWith(PREFIX)) {
            return null;
        }
        // the offline page's "Try again"
        if (url.getPath().substring(PREFIX.length()).equals("retry")) bridge.getWebView().loadUrl(ServerConfig.BASE_URL);
        return true;
    }
}
