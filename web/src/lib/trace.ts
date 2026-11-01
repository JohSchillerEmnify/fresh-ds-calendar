/** Fire-and-forget UI step trace to the server log (`client_trace`): step names only, never data. */
const t0 = Date.now();
export function trace(step: string, detail?: string): void {
  try {
    void fetch('/api/diag/trace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step, ...(detail ? { detail: detail.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 40) } : {}), ms: Date.now() - t0 }), keepalive: true }).catch(() => undefined);
  } catch { /* tracing never breaks the app */ }
}
