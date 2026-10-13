package lan.mordor.calendar.widget;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin {@code WidgetBridge}: the web app hands over its snapshot (theme, language, the week) after each
 * sync and at start; the plugin stores it and asks the widget to refresh.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    /** {@code setSnapshot({ json })}: {@code json} is the serialised snapshot (web/src/native/widgetSnapshot.ts). */
    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.length() > 200_000) {
            call.reject("json missing or too large");
            return;
        }
        new WidgetStore(getContext()).saveSnapshot(json);
        WeekWidgetProvider.onSnapshot(getContext());
        call.resolve(new JSObject());
    }
}
