package lan.mordor.calendar.widget;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** Owner bug 2026-10-14: "widget flashes". The app pushes a snapshot after every sync; an unchanged one must not redraw. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class SnapshotDedupTest {
    @Test
    public void aSnapshotDifferingOnlyInItsStampIsNotAChange() {
        Context ctx = ApplicationProvider.getApplicationContext();
        WidgetStore store = new WidgetStore(ctx);
        assertTrue(store.saveSnapshot("{\"v\":1,\"generatedAt\":\"2026-10-14T08:00:00Z\",\"language\":\"de\"}"));
        assertFalse(store.saveSnapshot("{\"v\":1,\"generatedAt\":\"2026-10-14T08:00:30Z\",\"language\":\"de\"}"));
        assertTrue(store.saveSnapshot("{\"v\":1,\"generatedAt\":\"2026-10-14T08:01:00Z\",\"language\":\"en\"}"));
    }
}
