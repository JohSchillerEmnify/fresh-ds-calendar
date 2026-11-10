/** Chromium DevTools protocol helpers for the @perf memory checks. */
import type { CDPSession, Page } from '@playwright/test';
import type { BrowserMemory } from './world.js';

async function withCdp<T>(page: Page, fn: (cdp: CDPSession) => Promise<T>): Promise<T> {
  const cdp = await page.context().newCDPSession(page);
  try {
    return await fn(cdp);
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function gc(cdp: CDPSession) {
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
}

interface HeapSnapshot { snapshot: { meta: { node_fields: string[]; node_types: [string[]] } }; nodes: number[] }

/** Self size (bytes) of every heap snapshot node that is not compiled code, native (Blink) memory or synthetic. */
export function dataHeapBytes(snap: HeapSnapshot): number {
  const { node_fields: fields, node_types: types } = snap.snapshot.meta;
  const [typeIdx, sizeIdx] = [fields.indexOf('type'), fields.indexOf('self_size')];
  const skipped = new Set(['code', 'native', 'synthetic']);
  let total = 0;
  for (let i = 0; i < snap.nodes.length; i += fields.length) {
    if (!skipped.has(types[0][snap.nodes[i + typeIdx]])) total += snap.nodes[i + sizeIdx];
  }
  return total;
}

/** Parsed heap snapshot of the page after two forced GCs. */
async function takeSnapshot(cdp: CDPSession): Promise<HeapSnapshot> {
  await gc(cdp);
  const chunks: string[] = [];
  const onChunk = (e: { chunk: string }) => chunks.push(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  return JSON.parse(chunks.join('')) as HeapSnapshot;
}

/**
 * JS data heap (objects, arrays, strings, closures; not V8's compiled code), DOM node count and JS event listener count
 * after two forced GCs. Compiled code is left out because the JIT keeps tiering up hot functions for hundreds of
 * cycles (+1.8 MB over 250 view cycles while objects and arrays grew by 45 KB, once); that is the engine warming up, not the app.
 */
export async function measureMemory(page: Page): Promise<BrowserMemory> {
  // Chromium keeps every mark/measure/resource entry on the JS heap; they are test noise, not app growth
  await page.evaluate(() => { performance.clearMarks(); performance.clearMeasures(); performance.clearResourceTimings(); });
  return withCdp(page, async (cdp) => {
    const heap = dataHeapBytes(await takeSnapshot(cdp));
    const counters = await cdp.send('Memory.getDOMCounters');
    return { heap, nodes: counters.nodes, listeners: counters.jsEventListeners };
  });
}

export interface DetachedReport {
  /** Detached elements whose data-testid starts with one of the dialog prefixes. */
  fromDialogs: string[];
  /** All detached HTML elements (roots and descendants). */
  total: number;
  method: string;
}

interface DomNode { nodeType: number; nodeName: string; attributes?: string[]; children?: DomNode[] }

/**
 * Detached DOM after GC. Uses `DOM.getDetachedDomNodes` (Chromium >= 118, gives attributes); falls back to a heap
 * snapshot scan for "Detached <tag ...>" node names.
 */
export async function detachedNodes(page: Page, prefixes: string[]): Promise<DetachedReport> {
  return withCdp(page, async (cdp) => {
    await gc(cdp);
    const matchesPrefix = (testId: string | undefined) => !!testId && prefixes.some((p) => testId.startsWith(p));
    try {
      await cdp.send('DOM.enable');
      await cdp.send('DOM.getDocument', { depth: 0 });
      const res = (await cdp.send('DOM.getDetachedDomNodes' as never)) as unknown as {
        detachedNodes: { treeNode: DomNode }[];
      };
      const fromDialogs: string[] = [];
      let total = 0;
      const walk = (n: DomNode) => {
        if (n.nodeType === 1) {
          total++;
          const a = n.attributes ?? [];
          const i = a.indexOf('data-testid');
          const testId = i >= 0 ? a[i + 1] : undefined;
          if (matchesPrefix(testId)) fromDialogs.push(`${n.nodeName.toLowerCase()}[data-testid=${testId}]`);
        }
        n.children?.forEach(walk);
      };
      res.detachedNodes.forEach((d) => walk(d.treeNode));
      return { fromDialogs, total, method: 'DOM.getDetachedDomNodes' };
    } catch {
      // Fallback: heap snapshot
      const chunks: string[] = [];
      cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => chunks.push(e.chunk));
      await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      const snap = JSON.parse(chunks.join('')) as {
        snapshot: { meta: { node_fields: string[] } };
        nodes: number[];
        strings: string[];
      };
      const fields = snap.snapshot.meta.node_fields;
      const nameIdx = fields.indexOf('name');
      const detIdx = fields.indexOf('detachedness');
      const fromDialogs: string[] = [];
      let total = 0;
      for (let i = 0; i < snap.nodes.length; i += fields.length) {
        const name = snap.strings[snap.nodes[i + nameIdx]];
        const detached = detIdx >= 0 ? snap.nodes[i + detIdx] === 2 : name.startsWith('Detached ');
        if (!detached || !/HTML|<\w/.test(name)) continue;
        total++;
        const m = /data-testid="([^"]+)"/.exec(name);
        if (matchesPrefix(m?.[1])) fromDialogs.push(name);
      }
      return { fromDialogs, total, method: 'heap snapshot' };
    }
  });
}
