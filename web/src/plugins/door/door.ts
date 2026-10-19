/** Door plugin: "Show on door" is the tag `door` on a task list (server: `server/src/plugins/door/`). */
export const DOOR_PLUGIN = 'door';
export const DOOR_TAG = 'door';

export const hasDoor = (tags: string[]): boolean => tags.includes(DOOR_TAG);

/** The list's tags with the door tag added or removed; the other tags stay as they are (tags are otherwise shelved). */
export const withDoor = (tags: string[], on: boolean): string[] => (on ? (hasDoor(tags) ? tags : [...tags, DOOR_TAG]) : tags.filter((t) => t !== DOOR_TAG));
