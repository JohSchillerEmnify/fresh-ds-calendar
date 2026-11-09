/** Light Mainfränkisch messages of the Google Drive backup; complete, moderate spellings only. */
import type { PartialMessages } from '../../schema';

export default {
  label: 'Sicherung in Google Drive',
  hint: 'Deine Einstellungen, Designs un die Tafel liegn in am versteckdn Ordner in deim Google Drive',
  allow: {
    label: 'Sicherung in Google Drive is aus',
    hint: 'Erlaub der App, a Sicherung in ihrm eigenen versteckdn Drive-Ordner abzulegn. Google fragt di nur amol.',
    button: 'Sicherung in Google Drive erlaubn',
  },
  status: {
    never: 'Noch ka Sicherung',
    ok: 'Letzde Sicherung: {time}',
    failed: 'Letzde Sicherung is schiefgangen: {reason} (probier ichs gleich widda)',
  },
  now: 'Etz sichern',
  restore: 'Aus Sicherung widdaherstelln',
  done: 'Sicherung gud gmacht',
  failed: 'Sicherung hat ned geklabbd: {reason}',
  restoreNone: 'Es gibd noch ka Sicherung',
  restoreFailed: 'Widdaherstelln hat ned geklabbd: {reason}',
  restoreDialog: {
    title: 'Aus Sicherung widdaherstelln?',
    message: 'Des ersetzt deine Einstellungen, Designs un die Tafel durch die neuesde Sicherung. Vorher wird der jetzige Stand gsichert.',
    ok: 'Widdaherstelln',
  },
} satisfies NonNullable<PartialMessages['backup']>;
