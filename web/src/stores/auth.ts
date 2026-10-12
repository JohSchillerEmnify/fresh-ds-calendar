import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, ApiError } from '@/api/client';

/** Where to go once signed in (set when the router sends a deep link to /signin). */
export const RETURN_KEY = 'signin-return';

/**
 * Sign-in state. `status` is `off` when the server runs without sign-in (PROVIDER=mock), `in` / `out` otherwise.
 * `reauth` is set when Google no longer accepts the person's access (banner with a link to sign in again).
 */
export const useAuthStore = defineStore('auth', () => {
  const status = ref<'unknown' | 'off' | 'in' | 'out'>('unknown');
  const email = ref<string | null>(null);
  const reauth = ref(false);
  let checking: Promise<void> | null = null;

  /** Asks the server who is signed in, once (later calls reuse the answer). */
  function check(): Promise<void> {
    checking ??= api.me().then(
      (me) => { email.value = me.email; status.value = me.email ? 'in' : 'off'; },
      (e) => { status.value = e instanceof ApiError && e.status === 401 ? 'out' : 'off'; },
    );
    return checking;
  }

  /** Subscribes to 401 answers of any call: signed out -> sign-in page, lost Google access -> banner. */
  function listen(): () => void {
    return api.onAuthError((code) => {
      if (code === 'GOOGLE_REAUTH') reauth.value = true;
      else if (window.location.pathname !== '/signin') window.location.assign('/signin');
    });
  }

  /** Ends the session on the server, then reloads onto the sign-in page (drops everything held in memory). */
  async function signOut(): Promise<void> {
    await api.signOut();
    window.location.assign('/signin');
  }

  return { status, email, reauth, check, listen, signOut };
});
