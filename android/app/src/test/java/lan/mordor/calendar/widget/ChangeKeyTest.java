package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

/** The widget is only redrawn when its content changed: the snapshot's generation stamp alone does not count. */
public class ChangeKeyTest {
    @Test
    public void snapshotsDifferingOnlyInTheStampAreEqual() {
        String a = "{\"v\":1,\"generatedAt\":\"2026-10-14T08:30:00.000Z\",\"language\":\"de\"}";
        String b = "{\"v\":1,\"generatedAt\":\"2026-10-14T08:30:30.000Z\",\"language\":\"de\"}";
        assertEquals(ChangeKey.withoutStamp(a), ChangeKey.withoutStamp(b));
    }

    @Test
    public void aRealChangeIsNotHiddenByTheStrip() {
        String a = "{\"v\":1,\"generatedAt\":\"x\",\"language\":\"de\"}";
        String b = "{\"v\":1,\"generatedAt\":\"x\",\"language\":\"en\"}";
        assertNotEquals(ChangeKey.withoutStamp(a), ChangeKey.withoutStamp(b));
    }

    @Test
    public void keysAreEqualForEqualPartsAndDifferOtherwise() {
        assertEquals(ChangeKey.of("a", null, 5), ChangeKey.of("a", null, 5));
        assertNotEquals(ChangeKey.of("a", "b"), ChangeKey.of("ab", ""));
        assertNotEquals(ChangeKey.of("a", 1), ChangeKey.of("a", 2));
    }
}
