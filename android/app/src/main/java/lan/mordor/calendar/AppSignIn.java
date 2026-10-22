package lan.mordor.calendar;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;

/**
 * Google sign-in for the app (feature android-app, ADR 0013). Google refuses OAuth inside a
 * WebView, so the whole round trip runs in the system browser and the session comes back by deep link
 * {@code lan.mordor.calendar://auth?code=<one-time code>}. The sign-in is bound to this app (RFC 7636 S256): the app makes a
 * random verifier, sends only its SHA-256 (the challenge) through the browser and shows the verifier to the server when it
 * redeems the code, so a code caught by another app or sent in a link is useless. Pure logic, no Android classes (plain JUnit).
 */
public final class AppSignIn {
    /** Scheme and host of the deep link the server's sign-in page opens at the end of the round trip. */
    public static final String SCHEME = "lan.mordor.calendar";
    public static final String HOST = "auth";
    private static final String START_PATH = "/api/auth/google/start";
    private static final String EXCHANGE_PATH = "/api/auth/app-exchange";
    private static final Pattern VERIFIER = Pattern.compile("^[A-Za-z0-9_-]{43,128}$");
    private static final Pattern CODE = Pattern.compile("^[A-Za-z0-9_-]{16,128}$");

    private static final SecureRandom RANDOM = new SecureRandom();

    private AppSignIn() {}

    /** A fresh verifier: 32 random bytes, base64url without padding (43 characters). */
    public static String newVerifier() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** The challenge of a verifier: base64url without padding of its SHA-256. */
    public static String challenge(String verifier) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // every Java platform has SHA-256
        }
    }

    /**
     * Where the system browser must start when the WebView is about to open {@code url}: the same start URL with
     * {@code app=1} and the {@code challenge} of this sign-in's verifier, or null when {@code url} is not the sign-in
     * start of the chosen server {@code base}.
     */
    public static String browserUrl(String base, String url, String challenge) {
        if (base == null || url == null || challenge == null) return null;
        URI u;
        try {
            u = URI.create(url);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!(base + START_PATH).equals(base(u) + u.getRawPath())) return null;
        return base + START_PATH + "?app=1&challenge=" + challenge;
    }

    /**
     * The URL the WebView loads to redeem the code of a sign-in deep link, or null when {@code link} is not one
     * ({@code lan.mordor.calendar://auth?code=...} with a well-formed code) or when no sign-in of this app is pending
     * ({@code verifier} null): the exchange carries the verifier only this app holds.
     */
    public static String exchangeUrl(String base, String link, String verifier) {
        if (base == null || link == null || verifier == null || !VERIFIER.matcher(verifier).matches()) return null;
        URI u;
        try {
            u = URI.create(link);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!SCHEME.equals(u.getScheme()) || !HOST.equals(u.getHost()) || u.getRawQuery() == null) return null;
        for (String pair : u.getRawQuery().split("&")) {
            if (pair.startsWith("code=") && CODE.matcher(pair.substring(5)).matches()) {
                return base + EXCHANGE_PATH + "?code=" + pair.substring(5) + "&verifier=" + verifier;
            }
        }
        return null;
    }

    private static String base(URI u) {
        return u.getScheme() + "://" + u.getRawAuthority();
    }
}
