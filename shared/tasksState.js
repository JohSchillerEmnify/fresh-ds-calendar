/** Whether task lists are available to a person: not while they still have to answer the question or said "not now". An unknown state (nothing synced yet) hides nothing. */
export function tasksAreOn(state) {
  return state === undefined || state === 'on';
}
