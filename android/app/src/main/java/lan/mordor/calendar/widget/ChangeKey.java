package lan.mordor.calendar.widget;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Pure helpers to tell whether the widget's content changed, so an unchanged widget is never redrawn (a redraw replaces
 * the bitmap and the launcher cross-fades it, which looks like flashing).
 */
final class ChangeKey {
    private ChangeKey() {}

    /** The app's snapshot without its {@code generatedAt} stamp, which differs on every push although nothing else does. */
    static String withoutStamp(String snapshotJson) {
        return snapshotJson == null ? null : snapshotJson.replaceFirst("\"generatedAt\"\\s*:\\s*\"[^\"]*\"\\s*,?", "");
    }

    /** A digest of all parts: equal parts give equal keys; a null part counts as empty. */
    static String of(Object... parts) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (Object p : parts) {
                md.update(String.valueOf(p).getBytes(StandardCharsets.UTF_8));
                md.update((byte) 0);
            }
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest()) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
