import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, ApiError } from '@/api/client';
import { dropPushSubscription } from '@/pwa/push';
import { wipeDevice } from '@/lib/deviceDb';
import { forgetPeriod } from '@/lib/lastPeriod';

/** Where to go once signed in (set when the router sends a deep link to /signin). */
export const RETURN_KEY = 'signin-return';

/** Keys the app keeps on the device as `cal.*`; the theme ones and the language stay on sign-out (look and feel of the device, not of a person). */
const KEEP_PREFIX = 'cal.theme';

/** Removes the app's `cal.*` entries from local and session storage, except the theme and (outside `cal.*`) the language. */
export function clearPersonalStorage(): void {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const s = store();
      for (const k of Object.keys(s)) if (k.startsWith('cal.') && !k.startsWith(KEEP_PREFIX)) s.removeItem(k);
    } catch { /* storage blocked: nothing kept there */ }
  }
}

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

  /** Subscribes to 401 answers of any call: signed out -> sign-in page (the page left is kept as `RETURN_KEY`), lost Google access -> banner. */
  function listen(): () => void {
    return api.onAuthError((code) => {
      if (code === 'GOOGLE_REAUTH') reauth.value = true;
      else if (code === 'CALENDAR_PERMISSION_MISSING') calendarMissing.value = true;
      else if (window.location.pathname !== '/signin') {
        // this full-page jump can unload the page before the router guard has stashed the deep link, so stash it here
        const { pathname, search, hash } = window.location;
        const full = pathname + search + hash;
        try { if (full !== '/') sessionStorage.setItem(RETURN_KEY, full); } catch { /* private mode: no deep link */ }
        forgetPeriod();
        window.location.assign('/signin');
      }
    });
  }

  /**
   * Ends the session on the server, drops what this device keeps of the person (its last known state too) and goes to the sign-in page with
   * `location.replace`, so "back" cannot show the previous person's calendar.
   *
   * @param end The server call, given this browser's push endpoint (so the server deletes that subscription too).
   */
  async function leave(end: (endpoint: string | null) => Promise<void>): Promise<void> {
    // this browser stops getting the person's reminders, whatever the server answers
    const endpoint = await dropPushSubscription();
    try { await end(endpoint); } catch { /* already signed out (401) or the server is down: leave anyway */ }
    clearPersonalStorage();
    forgetPeriod();
    // the calendar this device kept for the person goes too (feature last-known-state)
    await wipeDevice();
    window.location.replace('/signin');
  }

  /** Signs out of this browser only. */
  function signOut(): Promise<void> {
    return leave((endpoint) => api.signOut(endpoint));
  }

  /** "Sign out everywhere": ends every session of the person, on every device. */
  function signOutAll(): Promise<void> {
    return leave((endpoint) => api.signOutAll(endpoint));
  }

  /** Goes to Google's consent screen again; the existing session is kept and the new grant adds to the old scopes. */
  function grantCalendar(): void {
    window.location.assign('/api/auth/google/start');
  }

  return { status, email, reauth, calendarMissing, grantCalendar, check, listen, signOut, signOutAll };
});
