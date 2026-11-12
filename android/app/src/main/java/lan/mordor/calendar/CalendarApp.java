package lan.mordor.calendar;

import android.app.Application;
import lan.mordor.calendar.crash.CrashRecorder;

/** The app process starts here, for the activity and for the widgets alike: crashes are recorded from the first moment. */
public class CalendarApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        CrashRecorder.install(this);
    }
}
