import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, ApiError } from '@/api/client';

/** Where to go once signed in (set when the router sends a deep link to /signin). */
export const RETURN_KEY = 'signin-return';

/**
 * Sign-in state. `status` is `off` when the server says it runs without sign-in (PROVIDER=mock), `in` / `out` otherwise, `unknown`
 * until it has answered (also after a failed check).
 * `reauth` is set when Google no longer accepts the person's access (banner with a link to sign in again).
 * `calendarMissing` is set when the person signed in without ticking Google's calendar checkbox (banner with a button
 * to grant it).
 */
export const useAuthStore = defineStore('auth', () => {
  const status = ref<'unknown' | 'off' | 'in' | 'out'>('unknown');
  const email = ref<string | null>(null);
  const reauth = ref(false);
  const calendarMissing = ref(false);
  let checking: Promise<void> | null = null;

  /** Asks the server who is signed in, once (later calls reuse the answer). */
  function check(): Promise<void> {
    // the OAuth callback flags a grant without the calendar scope; the flag is consumed so a reload does not repeat it
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'missing') {
      calendarMissing.value = true;
      params.delete('calendar');
      const qs = params.toString();
      window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    }
    checking ??= api.me().then(
      (me) => { email.value = me.email; status.value = me.email ? 'in' : 'off'; },
      (e) => {
        // only the server's own "sign-in is off" answer means off; a failed check stays unknown and is asked again
        if (e instanceof ApiError && e.status === 401) status.value = 'out';
        else checking = null;
      },
    );
    return checking;
  }

  /** Subscribes to 401 answers of any call: signed out -> sign-in page, lost Google access -> banner. */
  function listen(): () => void {
    return api.onAuthError((code) => {
      if (code === 'GOOGLE_REAUTH') reauth.value = true;
      else if (code === 'CALENDAR_PERMISSION_MISSING') calendarMissing.value = true;
      else if (window.location.pathname !== '/signin') window.location.assign('/signin');
    });
  }

  /** Ends the session on the server, then reloads onto the sign-in page (drops everything held in memory). */
  async function signOut(): Promise<void> {
    await api.signOut();
    window.location.assign('/signin');
  }

  /** Goes to Google's consent screen again; the existing session is kept and the new grant adds to the old scopes. */
  function grantCalendar(): void {
    window.location.assign('/api/auth/google/start');
  }

  return { status, email, reauth, calendarMissing, grantCalendar, check, listen, signOut };
});
