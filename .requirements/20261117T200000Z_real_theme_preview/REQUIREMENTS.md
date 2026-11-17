# Real theme preview (#169)

As is: the theme menu's live preview and gallery cards used hand-made copies (week slice, task list, bar controls, header art).
To be: both render the real AppTopBar and TimeGrid (and TaskListCard through it) fed with sample data (`PreviewData`, provided
by `providePreview`); cards show the same preview scaled down.

Assumptions
- The status widgets (plant, streak, sync) are left out of the sample bar: they belong to the person and start network work.
- The sample hour grid starts at 07:00 whatever the real grid was scrolled to; hour height follows the person's zoom.
- The option tiles (Entries, Corners, ...) use the real event renderer as a chip instead of the deleted hand-made sample.
