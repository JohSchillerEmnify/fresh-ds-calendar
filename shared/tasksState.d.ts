/** A person's task lists: on (calendar exists or confirmed), off ("not now") or still to be asked. */
export type TasksState = 'on' | 'off' | 'ask';
export function tasksAreOn(state: TasksState | undefined): boolean;
