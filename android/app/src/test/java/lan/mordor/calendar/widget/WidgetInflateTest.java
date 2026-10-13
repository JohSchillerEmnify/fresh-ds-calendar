package lan.mordor.calendar.widget;

import static org.junit.Assert.assertNotNull;

import android.content.Context;
import android.os.Bundle;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import androidx.test.core.app.ApplicationProvider;
import java.time.LocalDate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/**
 * The widget's RemoteViews must inflate the way a launcher does it: only RemoteViews-allowed classes (a plain {@code View}
 * made launchers show "Can't load widget", owner 2026-10-14).
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35)
public class WidgetInflateTest {
    private final Context ctx = ApplicationProvider.getApplicationContext();

    @Test
    public void weekWidgetInflates() {
        RemoteViews rv = WidgetRenderer.build(ctx, new Bundle(), LocalDate.of(2026, 10, 14));
        assertNotNull(rv.apply(ctx, new FrameLayout(ctx)));
    }
}
