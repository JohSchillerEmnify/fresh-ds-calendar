package lan.mordor.calendar.crash;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/** Capacitor plugin {@code CrashReports}: {@code take()} answers {@code { records: [...] }} once per record. */
@CapacitorPlugin(name = "CrashReports")
public class CrashReportsPlugin extends Plugin {
    @PluginMethod
    public void take(PluginCall call) {
        try {
            call.resolve(new JSObject().put("records", CrashReports.take(getContext())));
        } catch (JSONException e) {
            call.reject("no records");
        }
    }
}
