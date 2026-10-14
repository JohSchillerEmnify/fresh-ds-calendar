package lan.mordor.calendar;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

/** Which navigations leave for the system browser and which deep links are accepted. */
public class AppSignInTest {
    private static final String BASE = "https://cal.example.org";

    @Test
    public void theSignInStartOfTheChosenServerOpensInTheBrowserWithAppFlag() {
        assertEquals(BASE + "/api/auth/google/start?app=1", AppSignIn.browserUrl(BASE, BASE + "/api/auth/google/start"));
        assertEquals(BASE + "/api/auth/google/start?app=1", AppSignIn.browserUrl(BASE, BASE + "/api/auth/google/start?x=1"));
    }

    @Test
    public void everythingElseStaysInTheWebView() {
        assertNull(AppSignIn.browserUrl(BASE, BASE + "/week/2026-10-12"));
        assertNull(AppSignIn.browserUrl(BASE, BASE + "/api/auth/google/callback?code=a&state=b"));
        assertNull(AppSignIn.browserUrl(BASE, "https://evil.example/api/auth/google/start"));
        assertNull(AppSignIn.browserUrl(BASE, "http://cal.example.org/api/auth/google/start"));
        assertNull(AppSignIn.browserUrl(null, BASE + "/api/auth/google/start"));
    }

    @Test
    public void aWellFormedDeepLinkBecomesTheExchangeUrl() {
        assertEquals(BASE + "/api/auth/app-exchange?code=abcDEF0123456789_-xyz",
            AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz"));
    }

    @Test
    public void otherLinksAndMalformedCodesAreIgnored() {
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://other?code=abcDEF0123456789_-xyz"));
        assertNull(AppSignIn.exchangeUrl(BASE, "https://auth?code=abcDEF0123456789_-xyz"));
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=short"));
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz%26x=/../"));
        assertNull(AppSignIn.exchangeUrl(BASE, "lan.mordor.calendar://auth"));
        assertNull(AppSignIn.exchangeUrl(null, "lan.mordor.calendar://auth?code=abcDEF0123456789_-xyz"));
    }
}
