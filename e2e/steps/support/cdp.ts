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

/** JS heap used size, DOM node count and JS event listener count after two forced GCs. */
export async function measureMemory(page: Page): Promise<BrowserMemory> {
  // Chromium keeps every mark/measure/resource entry on the JS heap; they are test noise, not app growth
  await page.evaluate(() => { performance.clearMarks(); performance.clearMeasures(); performance.clearResourceTimings(); });
  return withCdp(page, async (cdp) => {
    await gc(cdp);
    const heap = await cdp.send('Runtime.getHeapUsage');
    const counters = await cdp.send('Memory.getDOMCounters');
    return { heap: heap.usedSize, nodes: counters.nodes, listeners: counters.jsEventListeners };
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
