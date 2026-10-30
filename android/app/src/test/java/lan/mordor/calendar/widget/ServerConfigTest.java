package lan.mordor.calendar.widget;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** The server is configuration (ADR 0022); a choice left by the app with the chooser is forgotten once, with its data. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class ServerConfigTest {
    private final Context ctx = ApplicationProvider.getApplicationContext();

    @Test
    public void theServerIsTheConfiguredHttpsInstance() {
        assertTrue(ServerConfig.BASE_URL.matches("https://[^/]+"));
    }

    @Test
    public void aLegacyChoiceIsForgottenOnceWithTheWidgetsData() {
        ctx.getSharedPreferences(ServerConfig.LEGACY_PREFS, Context.MODE_PRIVATE).edit().putString("baseUrl", "http://cal.mordor.lan").commit();
        WidgetStore store = new WidgetStore(ctx);
        store.saveSnapshot("{\"v\":1,\"generatedAt\":\"a\"}");
        assertTrue(ServerConfig.forgetLegacyChoice(ctx));
        assertNull(store.rawSnapshot());
        assertTrue(ctx.getSharedPreferences(ServerConfig.LEGACY_PREFS, Context.MODE_PRIVATE).getAll().isEmpty());
        // the public server's data written afterwards is never dropped again
        store.saveSnapshot("{\"v\":1,\"generatedAt\":\"b\"}");
        assertFalse(ServerConfig.forgetLegacyChoice(ctx));
        assertNotNull(store.rawSnapshot());
    }
}
