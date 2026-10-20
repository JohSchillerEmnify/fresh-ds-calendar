# Door plugin (web)

The UI half of the door plugin (server: `server/src/plugins/door/README.md`): one switch, "Show on door", in the
task list form (`TaskListDialog`) and in the list sheet's footer (`TaskListView`). It is rendered only while the
server lists `door` in `/api/config` → `plugins`, which happens only on a deployment that set `DOOR_API_TOKEN`.

"Show on door" is the tag `door` on the list (`withDoor` / `hasDoor` in `door.ts`); the form sends the whole tag
array, the sheet patches it at once.
