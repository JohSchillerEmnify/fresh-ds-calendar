/**
 * Plugin UI registry (ADR 0004): optional integrations keep their UI in `plugins/<name>/`, and the core shows it
 * only while the server lists the plugin as enabled (`/api/config` → `plugins`).
 */
import { computed, type ComputedRef } from 'vue';
import { useClockStore } from '@/stores/clock';

/** Whether the server has the named plugin turned on. */
export function usePluginEnabled(name: string): ComputedRef<boolean> {
  const clock = useClockStore();
  // an older server (or a test fixture) answers without the list: then no plugin is on
  return computed(() => (clock.config.plugins ?? []).includes(name));
}
