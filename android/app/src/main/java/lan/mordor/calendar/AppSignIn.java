package lan.mordor.calendar;

import java.net.URI;
import java.util.regex.Pattern;

/**
 * Google sign-in for the app (ARCHITECTURE "Android app and widget", "Google sign-in"). Google refuses OAuth inside a
 * WebView, so the whole round trip runs in the system browser and the session comes back by deep link
 * {@code lan.mordor.calendar://auth?code=<one-time code>}. Pure string logic, no Android classes (plain JUnit).
 */
public final class AppSignIn {
    /** Scheme and host of the deep link the server's sign-in page opens at the end of the round trip. */
    public static final String SCHEME = "lan.mordor.calendar";
    public static final String HOST = "auth";
    private static final String START_PATH = "/api/auth/google/start";
    private static final String EXCHANGE_PATH = "/api/auth/app-exchange";
    private static final Pattern CODE = Pattern.compile("^[A-Za-z0-9_-]{16,128}$");

    private AppSignIn() {}

    /**
     * Where the system browser must start when the WebView is about to open {@code url}: the same start URL with
     * {@code app=1}, or null when {@code url} is not the sign-in start of the chosen server {@code base}.
     */
    public static String browserUrl(String base, String url) {
        if (base == null || url == null) return null;
        URI u;
        try {
            u = URI.create(url);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!(base + START_PATH).equals(base(u) + u.getRawPath())) return null;
        return base + START_PATH + "?app=1";
    }

    /**
     * The URL the WebView loads to redeem the code of a sign-in deep link, or null when {@code link} is not one
     * ({@code lan.mordor.calendar://auth?code=...} with a well-formed code).
     */
    public static String exchangeUrl(String base, String link) {
        if (base == null || link == null) return null;
        URI u;
        try {
            u = URI.create(link);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!SCHEME.equals(u.getScheme()) || !HOST.equals(u.getHost()) || u.getRawQuery() == null) return null;
        for (String pair : u.getRawQuery().split("&")) {
            if (pair.startsWith("code=") && CODE.matcher(pair.substring(5)).matches()) {
                return base + EXCHANGE_PATH + "?code=" + pair.substring(5);
            }
        }
        return null;
    }

    private static String base(URI u) {
        return u.getScheme() + "://" + u.getRawAuthority();
    }
}
