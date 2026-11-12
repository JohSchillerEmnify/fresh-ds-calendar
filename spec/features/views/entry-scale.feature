@views @entry-scale @id:entry-scale
Feature: The same kind of entry looks the same in every view
  An entry is drawn with one type scale in the month, the week and the day: the same kind of entry has the same text
  size and weight in all three, an event, a multi-day bar and a task list title alike. Every size follows the density
  setting (Compact, Comfortable, Airy), and on a phone every entry is one step smaller. A timed block in the week and
  the day may keep a slightly larger title, since it has room that a month chip has not. Smaller differences are gone
  too: on a phone a one-line entry title (chip, bar, all-day entry, task list card) fades out in every view, never an
  ellipsis in one and a fade in another. A multi-line timed block in the week and the day keeps the ellipsis on a cut
  title, since a fade cannot show a cut where the last line ends at a word break; a block only one line tall is a
  one-line entry and fades out. The
  birthday and anniversary marker has one size, and each kind of entry (chip, bar, all-day entry, block, card) has one
  padding. The sizes, weights and paddings are the shared `--entry-*` tokens in `web/src/styles.css`. The component
  golden `web/goldens/EntryScale.golden.ts` is the reference for how an entry looks at every size: minimum, small,
  regular and large, in each density and on a phone.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  @desktop
  Scenario Outline: An all-day entry has the same text in the month, the week and the day
    Given the calendar contains an all-day event "Holiday" on 2026-10-14
    Then in the <view> view of 2026-10-14 the title of "Holiday" is 12 px at weight 600

    Examples:
      | view  |
      | month |
      | week  |
      | day   |

  @desktop
  Scenario Outline: A multi-day bar has the same text in the month and the week
    Given the calendar contains an all-day event "Trip" from 2026-10-13 to 2026-10-15
    Then in the <view> view of 2026-10-14 the title of "Trip" is 12 px at weight 600

    Examples:
      | view  |
      | month |
      | week  |

  @desktop
  Scenario: A task list title weighs the same as an event title in every view
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item  | done |
      | Milk  | no   |
    Then in the month view of 2026-10-14 the title of "Groceries" is 12 px at weight 600
    And in the week view of 2026-10-14 the title of "Groceries" is 12 px at weight 600
    And in the day view of 2026-10-14 the title of "Groceries" is 12 px at weight 600

  @desktop
  Scenario: A timed event is a chip in the month and a block with a larger title in the week and the day
    Given the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
    Then in the month view of 2026-10-14 the title of "Standup" is 12 px at weight 600
    And in the week view of 2026-10-14 the title of "Standup" is 13 px at weight 600
    And in the day view of 2026-10-14 the title of "Standup" is 13 px at weight 600

  @desktop
  Scenario Outline: Every view follows the density setting
    Given the density is "<density>"
    And the calendar contains an all-day event "Holiday" on 2026-10-14
    Then in the month view of 2026-10-14 the title of "Holiday" is <size> px at weight 600
    And in the week view of 2026-10-14 the title of "Holiday" is <size> px at weight 600
    And in the day view of 2026-10-14 the title of "Holiday" is <size> px at weight 600

    Examples:
      | density     | size  |
      | Compact     | 10.8  |
      | Comfortable | 12    |
      | Airy        | 13.44 |

  @mobile
  Scenario Outline: On a phone every view is one step smaller
    Given the calendar contains an all-day event "Holiday" on 2026-10-14
    Then in the <view> view of 2026-10-14 the title of "Holiday" is 10 px at weight 600

    Examples:
      | view  |
      | month |
      | week  |
      | day   |

  @mobile
  Scenario Outline: On a phone a multi-day bar fades out in every view
    Given the calendar contains an all-day event "Trip" from 2026-10-13 to 2026-10-15
    Then in the <view> view of 2026-10-14 the title of "Trip" fades out instead of ending in an ellipsis

    Examples:
      | view  |
      | month |
      | week  |

  @mobile
  Scenario: On a phone a timed entry in the month fades out
    Given the calendar contains an event "Quarterly planning with the whole extended team" on 2026-10-14 from 10:00 to 10:30
    Then in the month view of 2026-10-14 the title of "Quarterly planning with the whole extended team" fades out instead of ending in an ellipsis

  @mobile
  Scenario Outline: On a phone a task list title fades out in every view
    Given the calendar contains a task list "Groceries for the whole long weekend away at the lake house with everyone from the old school" on 2026-10-14 with items:
      | item  | done |
      | Milk  | no   |
    Then in the <view> view of 2026-10-14 the title of "Groceries for the whole long weekend away at the lake house with everyone from the old school" fades out instead of ending in an ellipsis

    Examples:
      | view  |
      | month |
      | week  |
      | day   |

  @mobile
  Scenario Outline: On a phone a timed entry only one line tall fades out
    Given the calendar contains an event "Quarterly planning with the whole extended team" on 2026-10-14 from 10:00 to 10:15
    Then in the <view> view of 2026-10-14 the title of "Quarterly planning with the whole extended team" fades out instead of ending in an ellipsis

    Examples:
      | view |
      | week |
      | day  |

  @mobile
  Scenario Outline: On a phone a title that fits shows in full without a fade
    Given the Birthdays calendar has a birthday "Anna" on 2026-10-14
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:00 to 13:00
    Then in the <view> view of 2026-10-14 the title of "Anna" shows in full without a fade
    And in the <view> view of 2026-10-14 the title of "Lunch" shows in full without a fade

    Examples:
      | view  |
      | month |
      | week  |
      | day   |

  @desktop
  Scenario Outline: The birthday marker has one size in every view
    Given the Birthdays calendar has a birthday "Anna" on 2026-10-14
    Then in the <view> view of 2026-10-14 the marker of "Anna" is 10.8 px

    Examples:
      | view  |
      | month |
      | week  |
      | day   |
