/**
 * Extra Now card lines contributed by other features (e.g. the open tasks tray registers
 * "Next task: Fold (Laundry)"). `fn` is evaluated reactively; return null for no line.
 */
import { markRaw, shallowReactive } from 'vue';

export const nowCardLines = shallowReactive<Array<() => string | null>>([]);
export function registerNowCardLine(fn: () => string | null): () => void {
  const f = markRaw(fn);
  nowCardLines.push(f);
  return () => {
    const i = nowCardLines.indexOf(f);
    if (i >= 0) nowCardLines.splice(i, 1);
  };
}
