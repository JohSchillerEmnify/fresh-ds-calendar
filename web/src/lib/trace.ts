/** Fire-and-forget UI step trace to the server log (`client_trace`) and the device log: step names only, never data. */
import { logDevice } from './deviceLog';

const t0 = Date.now();
export function trace(step: string, detail?: string): void {
  logDevice('trace', { step, detail });
  try {
    void fetch('/api/diag/trace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step, ...(detail ? { detail: detail.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 40) } : {}), ms: Date.now() - t0 }), keepalive: true }).catch(() => undefined);
  } catch { /* tracing never breaks the app */ }
}
