/** The DOM element behind a template ref that points at a single-root component (such as `Pressable`), or null while unmounted. */
export const elOf = (c: unknown): HTMLElement | null => (c as { $el?: HTMLElement } | null)?.$el ?? null;
