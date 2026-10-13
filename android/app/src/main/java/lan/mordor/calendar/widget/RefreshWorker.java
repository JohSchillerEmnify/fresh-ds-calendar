package lan.mordor.calendar.widget;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.time.LocalDate;

/** Fetches the current week with the app's session and redraws the widgets (periodic and on-demand). */
public class RefreshWorker extends Worker {
    public RefreshWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        if (!WeekWidgetProvider.hasWidgets(context)) return Result.success();
        WeekFetcher.fetchAndStore(context, new WidgetStore(context), LocalDate.now());
        // a failed fetch still redraws: the footer and the sign-in hint follow the stored state
        WeekWidgetProvider.renderAll(context);
        return Result.success();
    }
}
