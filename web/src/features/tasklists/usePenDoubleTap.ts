/** Pencil double tap = undo (decision Q1): the app takes the DOM event `pencildoubletap` a host (the Android app, a platform bridge) dispatches; no browser reports the tap itself. */
import { onBeforeUnmount, onMounted } from 'vue';
import { listen, type Disposer } from '@/lib/timers';

export function usePenDoubleTap(undo: () => void, active: () => boolean): void {
  let stop: Disposer | null = null;
  onMounted(() => { stop = listen(window, 'pencildoubletap', () => { if (active()) undo(); }); });
  onBeforeUnmount(() => stop?.());
}
