package lan.mordor.calendar.notify;

import android.Manifest;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONException;

/**
 * Capacitor plugin {@code Reminders}: the web app schedules its next reminder (the bedtime reminder,
 * web/src/features/bedtime/bedtimeReminder.ts) ahead of time; it shows as a system notification when due. The first
 * schedule asks for the notification permission (Android 13+); the reminder is stored either way.
 */
@CapacitorPlugin(
    name = "Reminders",
    permissions = @Permission(alias = RemindersPlugin.NOTIFICATIONS, strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class RemindersPlugin extends Plugin {
    static final String NOTIFICATIONS = "notifications";

    /** {@code schedule({ id, at, title, body })}: {@code at} in epoch ms; replaces a pending reminder with the same id. */
    @PluginMethod
    public void schedule(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState(NOTIFICATIONS) == PermissionState.PROMPT) {
            requestPermissionForAlias(NOTIFICATIONS, call, "afterPermission");
            return;
        }
        store(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        store(call);
    }

    private void store(PluginCall call) {
        String id = call.getString("id");
        Long at = call.getLong("at");
        String title = call.getString("title");
        if (id == null || id.isEmpty() || id.length() > 160 || at == null || title == null || title.length() > 200) {
            call.reject("id, at and title are required");
            return;
        }
        String body = call.getString("body", "");
        if (body.length() > 500) body = body.substring(0, 500);
        try {
            Reminders.schedule(getContext(), new Reminders.Entry(id, at, title, body));
        } catch (JSONException e) {
            call.reject("could not store the reminder", e);
            return;
        }
        call.resolve(new JSObject());
    }

    /** {@code cancel({ id })}: removes a pending reminder. */
    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        Reminders.cancel(getContext(), id);
        call.resolve(new JSObject());
    }

    /** {@code list()}: the ids of every reminder still stored, as {@code { ids: string[] }}. */
    @PluginMethod
    public void list(PluginCall call) {
        JSObject res = new JSObject();
        res.put("ids", new JSArray(Reminders.ids(getContext())));
        call.resolve(res);
    }
}
