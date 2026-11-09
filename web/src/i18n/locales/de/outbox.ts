/** Texts of the offline outbox: the "not synced" popover, the notices of refused changes, the sign-out warning (ADR 0031). */
export default {
  icon: 'Nicht synchronisiert — Details',
  title: 'Noch nicht synchronisiert',
  lastToday: 'Zuletzt synchronisiert heute um {time}',
  lastOn: 'Zuletzt synchronisiert {date} um {time}',
  lastNever: 'Auf diesem Gerät noch nicht synchronisiert',
  empty: 'Nichts wartet darauf, gesendet zu werden.',
  hint: 'Änderungen werden automatisch gesendet, sobald die Verbindung wieder da ist.',
  change: {
    ticked: '{title} abgehakt',
    created: '{title} angelegt',
    renamed: '{title} umbenannt',
    changed: '{title} geändert',
    deleted: '{title} gelöscht',
  },
  gone: 'Die Änderung an „{title}“ wurde nicht gespeichert, weil es anderswo gelöscht wurde.',
  refused: 'Die Änderung an „{title}“ wurde nicht gespeichert, weil sie abgelehnt wurde.',
  editAgain: 'Nochmal bearbeiten',
  signOutAsk: 'Abmelden und {count} nicht gesendete Änderung verlieren? | Abmelden und {count} nicht gesendete Änderungen verlieren?',
  signOutAnyway: 'Trotzdem abmelden',
  stay: 'Angemeldet bleiben',
};
