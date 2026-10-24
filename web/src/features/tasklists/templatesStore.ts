/**
 * The person's task list templates (feature tasklist-templates), kept by the app server (`/api/templates`) so they
 * follow the person to every device. Loaded when something needs them (the template picker, the Templates page, a
 * save); deletes go through the undo snackbar (`pendingDeletes.deleteTemplate`), which hides the template meanwhile.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import type { TaskTemplate, TaskTemplateInput } from '@/api/types';

const byName = (a: TaskTemplate, b: TaskTemplate): number => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export const useTemplatesStore = defineStore('templates', () => {
  const all = ref<TaskTemplate[]>([]);
  const loaded = ref(false);
  /** Templates whose delete is waiting for its undo time. */
  const hidden = ref<string[]>([]);
  /** The templates shown: sorted by name, without the ones being deleted. */
  const list = computed(() => all.value.filter((x) => !hidden.value.includes(x.id)).sort(byName));

  /** Reads the templates from the server (every time: another device may have changed them). */
  async function load(): Promise<void> {
    all.value = (await api.templates()).templates;
    loaded.value = true;
  }

  const put = (t: TaskTemplate): void => { all.value = [...all.value.filter((x) => x.id !== t.id), t]; };

  /** Saves a new template; resolves with it once the server has it. */
  async function add(input: TaskTemplateInput): Promise<TaskTemplate> {
    const saved = await api.createTemplate(input);
    put(saved);
    return saved;
  }

  /** Replaces a template whole (name, items, estimate, category). */
  async function update(id: string, input: TaskTemplateInput): Promise<TaskTemplate> {
    const saved = await api.updateTemplate(id, input);
    put(saved);
    return saved;
  }

  const hide = (id: string): void => { hidden.value = [...hidden.value, id]; };
  const unhide = (id: string): void => { hidden.value = hidden.value.filter((x) => x !== id); };

  /** Deletes on the server (after the undo time); the template is gone for good. */
  async function remove(id: string, keepalive = false): Promise<void> {
    await api.deleteTemplate(id, { keepalive });
    all.value = all.value.filter((x) => x.id !== id);
    unhide(id);
  }

  return { list, loaded, load, add, update, hide, unhide, remove };
});
