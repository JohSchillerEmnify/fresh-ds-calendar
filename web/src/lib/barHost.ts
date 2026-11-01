import { ref } from 'vue';

/** The bottom bar is drawn and carries a slot for the open tasks row (set by `NavigationBar`, read by `TaskTray`). */
export const barHostsRow = ref(false);
