package lan.mordor.calendar.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

/** The pure maths of the week bitmap: column packing (a port of the web's {@code packColumns}), the hour range and the scale. */
public class WeekLayoutTest {
    private static WeekData.Item ev(String id, int start, int end) {
        return WeekData.Item.event(id, id, false, start, end, "#1a73e8");
    }

    private static WeekLayout.Placed find(List<WeekLayout.Placed> l, String id) {
        for (WeekLayout.Placed p : l) if (p.item.id.equals(id)) return p;
        throw new AssertionError(id);
    }

    private static List<WeekLayout.Placed> pack(WeekData.Item... items) {
        return WeekLayout.packColumns(List.of(items), 0);
    }

    @Test
    public void aLoneItemTakesTheWholeColumn() {
        WeekLayout.Placed p = pack(ev("a", 600, 660)).get(0);
        assertEquals(0, p.col);
        assertEquals(1, p.cols);
        assertEquals(1, p.span);
        assertEquals(0, p.level);
    }

    @Test
    public void theWeekSettingPlacesOverlapsSideBySideUpToItsLimit() {
        // owner, 2026-10-25: the widget's week follows "Week view: events side by side" like the app (web packSideBySide)
        List<WeekData.Item> day = List.of(ev("dentist", 540, 600), ev("standup", 540, 630), ev("call", 570, 660), ev("review", 600, 690));
        List<WeekLayout.Placed> two = WeekLayout.packColumns(day, 25, 0, 2);
        assertEquals(0, find(two, "standup").col);
        assertEquals(1, find(two, "dentist").col);
        assertEquals(1, find(two, "call").col);
        assertEquals(1, find(two, "call").level);
        assertEquals(2, find(two, "review").level);
        for (WeekLayout.Placed p : two) assertEquals(2, p.cols);
        List<WeekLayout.Placed> three = WeekLayout.packColumns(day, 25, 0, 3);
        assertEquals(2, find(three, "call").col);
        assertEquals(0, find(three, "call").level);
        assertEquals(1, find(three, "review").col);
        assertEquals(0, find(three, "review").level);
        // a cascade that would hide a title opens one more column instead, beyond the limit
        List<WeekLayout.Placed> close = WeekLayout.packColumns(List.of(ev("a", 540, 600), ev("b", 540, 600), ev("c", 545, 600)), 25, 0, 2);
        for (WeekLayout.Placed p : close) {
            assertEquals(3, p.cols);
            assertEquals(0, p.level);
        }
        // a later entry takes the column an earlier one has left
        List<WeekLayout.Placed> freed = WeekLayout.packColumns(List.of(ev("a", 540, 600), ev("b", 555, 630), ev("g", 600, 660)), 25, 0, 2);
        assertEquals(0, find(freed, "g").col);
        assertEquals(0, find(freed, "g").level);
    }

    @Test
    public void touchingItemsDoNotOverlap() {
        List<WeekLayout.Placed> l = pack(ev("a", 600, 660), ev("b", 660, 720));
        assertEquals(1, find(l, "a").cols);
        assertEquals(1, find(l, "b").cols);
    }

    @Test
    public void itemsStartingTogetherShareEqualColumns() {
        List<WeekLayout.Placed> l = pack(ev("a", 600, 660), ev("b", 605, 700));
        assertEquals(2, find(l, "a").cols);
        assertEquals(0, find(l, "a").col);
        assertEquals(1, find(l, "b").col);
        assertEquals(0, find(l, "b").level);
    }

    @Test
    public void aLaterOverlappingStartCascadesOneLevelDeeper() {
        List<WeekLayout.Placed> l = pack(ev("a", 600, 720), ev("b", 660, 700));
        assertEquals(0, find(l, "a").level);
        assertEquals(1, find(l, "b").level);
        assertEquals(1, find(l, "b").cols);
    }

    @Test
    public void cascadeStopsAtTheMaximumDepth() {
        List<WeekData.Item> items = new ArrayList<>();
        for (int i = 0; i < 6; i++) items.add(ev("e" + i, 600 + i * 20, 900));
        int deepest = 0;
        for (WeekLayout.Placed p : WeekLayout.packColumns(items, 0)) deepest = Math.max(deepest, p.level);
        assertEquals(WeekLayout.MAX_STACK_DEPTH, deepest);
    }

    @Test
    public void spanWidensOnlyOverFreeColumns() {
        // x (col 0) and y (col 1) start together; z (col 2) starts within the group window but only after y ended,
        // so z reuses y's column and x keeps its single column
        List<WeekLayout.Placed> l = pack(ev("x", 600, 700), ev("y", 600, 605), ev("z", 610, 700));
        assertEquals(2, find(l, "x").cols);
        assertEquals(1, find(l, "x").span);
        assertEquals(1, find(l, "z").col);
        // a lone short item next to a long one: nothing to widen into
        List<WeekLayout.Placed> m = pack(ev("p", 600, 660), ev("q", 600, 720));
        assertEquals(1, find(m, "p").span);
        assertEquals(1, find(m, "q").span);
    }

    @Test
    public void minimumDurationDoesNotCreateAnOverlap() {
        // a lasts 5 min and b starts 10 min later: no real overlap, one column, a drawn at its real 5 min
        List<WeekLayout.Placed> l = WeekLayout.packColumns(List.of(ev("a", 600, 605), ev("b", 610, 640)), 30);
        assertEquals(1, find(l, "b").cols);
        assertEquals(0, find(l, "b").level);
        assertEquals(5, find(l, "a").height);
        assertEquals(30, find(l, "b").height);
    }

    @Test
    public void aMinimumEventLengthLaysShortItemsOutAsThatLong() {
        // min-event-length: two back-to-back 15-min items under a 30-min minimum are drawn 30 min tall and overlap
        List<WeekLayout.Placed> l = WeekLayout.packColumns(List.of(ev("a", 660, 675), ev("b", 675, 690)), 11, 30);
        assertEquals(30, find(l, "a").height);
        assertEquals(30, find(l, "b").height);
        boolean sideBySide = find(l, "a").cols == 2 && find(l, "b").cols == 2;
        assertTrue("laid out as overlapping", sideBySide || find(l, "b").level == 1);
        // a longer item keeps its real length; no minimum is the strict rule
        assertEquals(20, WeekLayout.packColumns(List.of(ev("c", 780, 800)), 11, 15).get(0).height);
        assertEquals(15, find(WeekLayout.packColumns(List.of(ev("a", 660, 675), ev("b", 675, 690)), 11, 0), "a").height);
    }

    @Test
    public void backToBackItemsStayInOneColumn() {
        List<WeekLayout.Placed> l = WeekLayout.packColumns(List.of(ev("a", 540, 570), ev("b", 570, 600)), 31);
        assertEquals(1, find(l, "a").cols);
        assertEquals(1, find(l, "b").cols);
        assertEquals(30, find(l, "a").height);
        assertEquals(30, find(l, "b").height);
    }

    @Test
    public void trulyOverlappingShortItemsStillShareColumns() {
        List<WeekLayout.Placed> l = WeekLayout.packColumns(List.of(ev("a", 540, 545), ev("b", 543, 600)), 31);
        assertEquals(2, find(l, "a").cols);
        assertEquals(2, find(l, "b").cols);
        assertEquals(5, find(l, "a").height);
    }

    @Test
    public void untimedItemsAreIgnored() {
        assertEquals(0, WeekLayout.packColumns(List.of(WeekData.Item.event("x", "x", true, -1, -1, "#000000")), 0).size());
    }

    private static List<WeekData.Day> week(int... startEnd) {
        WeekData.Day d = new WeekData.Day(java.time.LocalDate.parse("2026-10-12"));
        for (int i = 0; i < startEnd.length; i += 2) d.items.add(ev("i" + i, startEnd[i], startEnd[i + 1]));
        return List.of(d);
    }

    @Test
    public void hourRangeFitsTheEarliestStartAndLatestEnd() {
        assertEquals(List.of(9, 17), asList(WeekLayout.hourRange(week(9 * 60 + 15, 10 * 60, 16 * 60, 16 * 60 + 30))));
    }

    @Test
    public void hourRangeRoundsTheEndUp() {
        assertEquals(List.of(8, 15), asList(WeekLayout.hourRange(week(8 * 60, 9 * 60, 13 * 60, 14 * 60 + 1))));
    }

    @Test
    public void hourRangeHasAMinimumSpan() {
        int[] r = WeekLayout.hourRange(week(12 * 60, 13 * 60));
        assertEquals(WeekLayout.MIN_SPAN_HOURS, r[1] - r[0]);
        assertTrue(r[0] <= 12 && r[1] >= 13);
    }

    @Test
    public void hourRangeStaysWithinTheDay() {
        int[] r = WeekLayout.hourRange(week(23 * 60, 24 * 60));
        assertEquals(24, r[1]);
        assertEquals(24 - WeekLayout.MIN_SPAN_HOURS, r[0]);
        int[] n = WeekLayout.hourRange(week(0, 60));
        assertEquals(0, n[0]);
    }

    @Test
    public void emptyWeekShowsTheDefaultRange() {
        assertEquals(List.of(WeekLayout.DEFAULT_START_HOUR, WeekLayout.DEFAULT_END_HOUR), asList(WeekLayout.hourRange(week())));
    }

    @Test
    public void bitmapScaleKeepsDensityWhenItFits() {
        assertEquals(2.5f, WeekLayout.bitmapScale(250, 110, 2.5f, 1080L * 2400), 0.0001f);
    }

    @Test
    public void bitmapScaleShrinksToThePixelBudget() {
        float s = WeekLayout.bitmapScale(1000, 2000, 3f, 1_000_000L);
        assertEquals(1_000_000d, (1000 * s) * (2000 * s), 1000d);
    }

    private static List<Integer> asList(int[] a) {
        return List.of(a[0], a[1]);
    }

    @Test
    public void onColorPicksTheMoreContrastingText() {
        assertEquals(0xFFFFFFFF, WeekLayout.onColor(0x3f51b5));
        assertEquals(0xFF000000, WeekLayout.onColor(0xf6bf26));
        assertEquals(0xFFFFFFFF, WeekLayout.onColor(0x000000));
    }
}
