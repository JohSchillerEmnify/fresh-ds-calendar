package lan.mordor.calendar.widget;

/**
 * The calendar server of the app and the widget (feature android-app). Configuration, not a choice: always the public
 * instance (owner 2026-10-23; the first-start chooser between it and the home-network server is gone). The app loads it,
 * the widget calls its API.
 */
public final class ServerConfig {
    /** The public instance, reached from anywhere over HTTPS. */
    public static final String BASE_URL = "https://cal.example.org";

    private ServerConfig() {}
}
