package lan.mordor.calendar.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receives the widgets' own broadcasts (the refresh icon's tap and the clock's 5-minute tick). It is not exported, so
 * only this app can send them; the exported widget providers take nothing but the system's widget broadcasts.
 */
public class WidgetActionReceiver extends BroadcastReceiver {
    static final String ACTION_REFRESH = "lan.mordor.calendar.widget.REFRESH";
    static final String ACTION_TICK = "lan.mordor.calendar.widget.CLOCK_TICK";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_REFRESH.equals(action)) {
            WeekWidgetProvider.renderAll(context);
            WeekWidgetProvider.enqueueFetch(context);
        } else if (ACTION_TICK.equals(action)) {
            ClockWidgetProvider.renderAll(context);
        }
    }
}
