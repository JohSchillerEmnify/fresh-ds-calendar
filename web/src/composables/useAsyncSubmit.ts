import { ref, type Ref } from 'vue';
import { ApiError } from '@/api/client';
import { t, type MessageKey } from '@/i18n';

/**
 * Busy/error state for a dialog's submit: `run` sets `busy`, clears `error`, awaits the call, then `onDone` (usually
 * closing the dialog); a failure leaves the dialog open with the server's message (`ApiError`) or the fallback text.
 * Pass an existing `error` ref when the dialog shows one message for several sources.
 */
export function useAsyncSubmit(opts: { onDone?: () => void; error?: Ref<string> } = {}) {
  const busy = ref(false);
  const error = opts.error ?? ref('');
  async function run(fn: () => Promise<unknown>, fallbackKey: MessageKey): Promise<void> {
    busy.value = true;
    error.value = '';
    try {
      await fn();
      opts.onDone?.();
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : t(fallbackKey);
    } finally {
      busy.value = false;
    }
  }
  return { busy, error, run };
}
