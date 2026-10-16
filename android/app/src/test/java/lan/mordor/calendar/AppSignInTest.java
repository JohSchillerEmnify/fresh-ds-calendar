package lan.mordor.calendar;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Which navigations leave for the system browser and which deep links are accepted. */
public class AppSignInTest {
    private static final String BASE = "https://cal.example.org";
    private static final String VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    /** RFC 7636 appendix B: the S256 challenge of that verifier. */
    private static final String CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    @Test
    public void aVerifierIs32RandomBytesInBase64urlAndEveryOneIsNew() {
        String v = AppSignIn.newVerifier();
        assertTrue(v.matches("^[A-Za-z0-9_-]{43}$"));
        assertNotEquals(v, AppSignIn.newVerifier());
    }

    @Test
    public void theChallengeIsTheS256OfTheVerifier() {
        assertEquals(CHALLENGE, AppSignIn.challenge(VERIFIER));
    }

    @Test
    public void theSignInStartOfTheChosenServerOpensInTheBrowserWithAppFlag() {
        assertEquals(BASE + "/api/auth/google/start?app=1&challenge=" + CHALLENGE, AppSignIn.browserUrl(BASE, BASE + "/api/auth/google/start", CHALLENGE));
        assertEquals(BASE + "/api/auth/google/start?app=1&challenge=" + CHALLENGE, AppSignIn.browserUrl(BASE, BASE + "/api/auth/google/start?x=1", CHALLENGE));
    }

    @Test
    public void everythingElseStaysInTheWebView() {
        assertNull(AppSignIn.browserUrl(BASE, BASE + "/week/2026-10-12", CHALLENGE));
        assertNull(AppSignIn.browserUrl(BASE, BASE + "/api/auth/google/callback?code=a&state=b", CHALLENGE));
        assertNull(AppSignIn.browserUrl(BASE, "https://evil.example/api/auth/google/start", CHALLENGE));
        assertNull(AppSignIn.browserUrl(BASE, "http://cal.example.org/api/auth/google/start", CHALLENGE));
        assertNull(AppSignIn.browserUrl(BASE, BASE + "/api/auth/google/start", null));
        assertNull(AppSignIn.browserUrl(null, BASE + "/api/auth/google/start", CHALLENGE));
    }

    @Test
    public void aWellFormedDeepLinkBecomesTheExchangeUrlWithTheVerifier() {
        assertEquals(BASE + "/api/auth/app-exchange?code=abcDEF0123456789_-xyz&verifier=" + VERIFIER,
            AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz", VERIFIER));
    }

    @Test
    public void aDeepLinkWithoutAPendingSignInIsIgnored() {
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz", null));
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz", "short"));
    }

    @Test
    public void otherLinksAndMalformedCodesAreIgnored() {
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://other?code=abcDEF0123456789_-xyz", VERIFIER));
        assertNull(AppSignIn.exchangeUrl(BASE, "https://auth?code=abcDEF0123456789_-xyz", VERIFIER));
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=short", VERIFIER));
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz%26x=/../", VERIFIER));
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth", VERIFIER));
        assertNull(AppSignIn.exchangeUrl(null, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz", VERIFIER));
    }
}
