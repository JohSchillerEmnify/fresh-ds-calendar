/**
 * The iPhone widget keys of the person (feature iphone-widget): name, creation and last use only, never the key itself.
 * Kept on the device with the last known state (ADR 0023) and read again when the setup is open; adding and removing
 * need the server.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { WidgetKey, WidgetKeyCreated } from '@/api/types';
import { useDeviceStore } from '@/stores/device';

export const useWidgetKeysStore = defineStore('widgetKeys', () => {
  const keys = ref<WidgetKey[]>([]);
  const loaded = ref(false);

  const keep = (): void => useDeviceStore().putFile('widgetKeys', { keys: keys.value });

  /** Takes the keys the device holds (every sync). */
  function fromDevice(held: WidgetKey[]): void {
    keys.value = held;
    loaded.value = true;
  }

  /** Reads the keys from the device store, from the server only before the first sync. */
  async function load(): Promise<void> {
    const held = useDeviceStore().file<{ keys: WidgetKey[] }>('widgetKeys');
    if (held) return fromDevice(held.keys);
    return refresh();
  }

  /** Asks the server (the setup polls this to see the first use of a key). */
  async function refresh(): Promise<void> {
    fromDevice(await api.widgetKeys());
    keep();
  }

  /** Makes a key; the answer holds the key itself, which only the caller sees. */
  async function create(name: string): Promise<WidgetKeyCreated> {
    const made = await api.createWidgetKey(name);
    const { key: _secret, ...listed } = made;
    keys.value = [listed, ...keys.value];
    keep();
    return made;
  }

  async function remove(id: string): Promise<void> {
    await api.deleteWidgetKey(id);
    keys.value = keys.value.filter((k) => k.id !== id);
    keep();
  }

  return { keys, loaded, load, fromDevice, refresh, create, remove };
});
