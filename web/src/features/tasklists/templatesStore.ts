/**
 * The person's task list templates (feature tasklist-templates), kept by the app server (`/api/templates`) so they
 * follow the person to every device, and on the device with the last known state (ADR 0023): restored at start, read
 * again on every sync and when something needs them (the template picker, the Templates page, a save); deletes go
 * through the undo snackbar (`pendingDeletes.deleteTemplate`), which hides the template meanwhile.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import type { TaskTemplate, TaskTemplateInput } from '@/api/types';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';

const byName = (a: TaskTemplate, b: TaskTemplate): number => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export const useTemplatesStore = defineStore('templates', () => {
  const all = ref<TaskTemplate[]>([]);
  const loaded = ref(false);
  /** Templates whose delete is waiting for its undo time. */
  const hidden = ref<string[]>([]);
  /** The templates shown: sorted by name, without the ones being deleted. */
  const list = computed(() => all.value.filter((x) => !hidden.value.includes(x.id)).sort(byName));

  /** Counts changes made here: a reading that started before the latest one is out of date when it arrives. */
  let changes = 0;

  /** Reads the templates from the server (every time: another device may have changed them). */
  async function load(): Promise<void> {
    const at = changes;
    const fresh = (await api.templates()).templates;
    // a template added, changed or deleted while this was on its way would be lost: the reading is dropped and
    // done again, so the list always ends up read (also when that change failed)
    if (at !== changes) return load();
    all.value = fresh;
    loaded.value = true;
  }

  /** Shows the templates this device kept (last known state) until the server answers. */
  function restore(saved: TaskTemplate[]): void {
    all.value = saved;
    loaded.value = true;
  }

  const put = (t: TaskTemplate): void => {
    changes++;
    all.value = [...all.value.filter((x) => x.id !== t.id), t];
  };

  /** Deletes on their way to the server, by template id. */
  const deleting = new Map<string, Promise<void>>();

  /**
   * A template with this name waiting for its undo time is deleted now, and one whose delete is already on its way is
   * waited for: the name is free on the server first.
   */
  async function freeName(name: string, self?: string): Promise<void> {
    const n = name.trim();
    const same = all.value.filter((x) => x.id !== self && hidden.value.includes(x.id) && x.name.trim().localeCompare(n, undefined, { sensitivity: 'base' }) === 0);
    if (!same.length) return;
    await usePendingDeletesStore().flush();
    await Promise.all(same.map((x) => deleting.get(x.id)?.catch(() => undefined)));
  }

  /** Saves a new template; resolves with it once the server has it. */
  async function add(input: TaskTemplateInput): Promise<TaskTemplate> {
    await freeName(input.name);
    changes++;
    const saved = await api.createTemplate(input);
    put(saved);
    return saved;
  }

  /** Replaces a template whole (name, items, estimate, category). */
  async function update(id: string, input: TaskTemplateInput): Promise<TaskTemplate> {
    await freeName(input.name, id);
    changes++;
    const saved = await api.updateTemplate(id, input);
    put(saved);
    return saved;
  }

  const hide = (id: string): void => { hidden.value = [...hidden.value, id]; };
  const unhide = (id: string): void => { hidden.value = hidden.value.filter((x) => x !== id); };

  /** Deletes on the server (after the undo time); the template is gone for good. */
  async function remove(id: string, keepalive = false): Promise<void> {
    changes++;
    const sent = api.deleteTemplate(id, { keepalive });
    deleting.set(id, sent);
    try {
      await sent;
    } finally {
      deleting.delete(id);
    }
    changes++;
    all.value = all.value.filter((x) => x.id !== id);
    unhide(id);
  }

  return { list, loaded, load, restore, add, update, hide, unhide, remove };
});
