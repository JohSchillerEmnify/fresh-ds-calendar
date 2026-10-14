package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** The server choice: nothing stored at first, only the two offered servers are accepted, and a change drops the widget's data. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class ServerConfigTest {
    private final Context ctx = ApplicationProvider.getApplicationContext();

    @Test
    public void nothingChosenAtFirst() {
        assertNull(ServerConfig.baseUrl(ctx));
    }

    @Test
    public void storesAnOfferedServer() {
        ServerConfig.choose(ctx, ServerConfig.FRESH);
        assertEquals("https://cal.example.org", ServerConfig.baseUrl(ctx));
        ServerConfig.choose(ctx, ServerConfig.MORDOR);
        assertEquals("http://cal.mordor.lan", ServerConfig.baseUrl(ctx));
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsAnyOtherServer() {
        ServerConfig.choose(ctx, "https://evil.example");
    }

    @Test
    public void onlyTheTwoServersAreOffered() {
        assertTrue(ServerConfig.isOffered("https://cal.example.org"));
        assertFalse(ServerConfig.isOffered("http://cal.example.org"));
        assertFalse(ServerConfig.isOffered(null));
    }

    @Test
    public void changingOrClearingDropsTheWidgetData() {
        ServerConfig.choose(ctx, ServerConfig.MORDOR);
        WidgetStore store = new WidgetStore(ctx);
        store.saveSnapshot("{\"v\":1}");
        store.saveFetched("{\"weekStart\":\"2026-10-12\",\"items\":[]}", 1L);
        ServerConfig.choose(ctx, ServerConfig.FRESH);
        assertNull(new WidgetStore(ctx).snapshot());
        assertNull(new WidgetStore(ctx).fetched());

        store.saveSnapshot("{\"v\":1}");
        ServerConfig.clear(ctx);
        assertNull(ServerConfig.baseUrl(ctx));
        assertNull(new WidgetStore(ctx).snapshot());
    }
}
