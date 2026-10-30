/** Signing out: with changes not sent yet it asks first, because they would be lost (ADR 0031). */
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useOutboxStore } from '@/stores/outbox';

export function useSignOut() {
  const auth = useAuthStore();
  const outbox = useOutboxStore();
  /** Which sign-out waits for the answer, or null. */
  const asking = ref<'one' | 'all' | null>(null);
  function leave(kind: 'one' | 'all', confirmed = false): void {
    if (!confirmed && outbox.count > 0) { asking.value = kind; return; }
    asking.value = null;
    if (kind === 'all') void auth.signOutAll();
    else void auth.signOut();
  }
  return { asking, leave, unsent: outbox };
}
