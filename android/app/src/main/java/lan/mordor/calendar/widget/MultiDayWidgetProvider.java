package lan.mordor.calendar.widget;

/** The Multi-day home-screen widget: the next days as columns with the hours running down (the Timeline); everything else is the List widget's. */
public class MultiDayWidgetProvider extends ScrollWidgetProvider {
    @Override
    boolean timeline() {
        return true;
    }
}
