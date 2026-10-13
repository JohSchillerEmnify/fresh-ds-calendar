/** German messages of shared task lists; complete (a key missing here is a type error). */
import type { Messages } from '../../schema';

export default {
  badge: 'Geteilt mit {name}',
  badgeMember: 'Geteilt von {name}',
  title: 'Teilen',
  person: 'Person',
  choose: 'Person auswählen',
  share: 'Teilen',
  stop: 'Nicht mehr teilen',
  leave: 'Verlassen',
  sharedWith: 'Geteilt mit {names}',
  noPeople: 'Es kann noch niemand hinzugefügt werden: die Person muss sich einmal anmelden.',
  shareFailed: 'Die Liste konnte nicht geteilt werden.',
  stopFailed: 'Das Teilen konnte nicht beendet werden.',
  leaveFailed: 'Die Liste konnte nicht verlassen werden.',
  ownerOnlyCategory: 'Nur die Besitzerin oder der Besitzer kann die Kategorie einer geteilten Liste ändern.',
  category: {
    label: 'Teilen mit',
    nobody: 'Niemand',
    hint: 'Alle Listen dieser Kategorie und neue Listen werden mit dieser Person geteilt.',
    failed: 'Das Teilen konnte nicht geändert werden.',
  },
  ownerOnly: 'Das kann nur die Besitzerin oder der Besitzer.',
  needsSignIn: 'Zum Teilen ist eine Anmeldung nötig.',
  self: 'Du kannst nicht mit dir selbst teilen.',
  unknownPerson: 'Diese Person kann nicht hinzugefügt werden.',
  repeating: 'Eine wiederkehrende Aufgabenliste kann nicht geteilt werden.',
  ownerCannotLeave: 'Die Besitzerin oder der Besitzer löscht die Liste oder beendet das Teilen.',
  categoryOwnerOnly: 'Nur die Besitzerin oder der Besitzer kann die Kategorie einer geteilten Liste ändern.',
} satisfies Messages['sharing'];
