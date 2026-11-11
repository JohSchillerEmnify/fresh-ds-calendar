/** The person's iPhone widget keys (never the key itself), kept on the device and read again while the setup is open. */
import { ref } from 'vue';
import { api } from '@/api/client';
import type { WidgetKey, WidgetKeyCreated } from '@/api/types';
import { useDeviceStore } from '@/stores/device';

const keys = ref<WidgetKey[]>([]);
const loaded = ref(false);

export function useWidgetKeys() {
  const device = useDeviceStore();
  const keep = (): void => device.putFile('widgetKeys', { keys: keys.value });
  const take = (list: WidgetKey[]): void => { keys.value = list; loaded.value = true; };

  /** The device copy at once, the server only before the device's first sync. */
  async function load(): Promise<void> {
    const held = device.file<{ keys: WidgetKey[] }>('widgetKeys');
    if (held) return take(held.keys);
    return refresh();
  }

  /** Asks the server (the setup polls this to see the first use of a key). */
  async function refresh(): Promise<void> {
    take(await api.widgetKeys());
    keep();
  }

  /** Makes a key; the answer holds the key itself, which only the caller sees. */
  async function create(name: string): Promise<WidgetKeyCreated> {
    const made = await api.createWidgetKey(name);
    keys.value = [{ id: made.id, name: made.name, createdAt: made.createdAt, lastUsedAt: made.lastUsedAt }, ...keys.value];
    keep();
    return made;
  }

  async function remove(id: string): Promise<void> {
    await api.deleteWidgetKey(id);
    keys.value = keys.value.filter((k) => k.id !== id);
    keep();
  }

  return { keys, loaded, load, refresh, create, remove };
}
