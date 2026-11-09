/** German messages of the Google Drive backup; complete (a key missing here is a type error). */
import type { Messages } from '../../schema';

export default {
  label: 'Sicherung in Google Drive',
  hint: 'Deine Einstellungen, Designs und die Tafel liegen in einem versteckten Ordner deines Google Drive',
  allow: {
    label: 'Sicherungen in Google Drive sind aus',
    hint: 'Erlaube der App, eine Sicherung in ihrem eigenen versteckten Drive-Ordner abzulegen. Google fragt dich einmal.',
    button: 'Sicherungen in Google Drive erlauben',
  },
  status: {
    never: 'Noch keine Sicherung',
    ok: 'Letzte Sicherung: {time}',
    failed: 'Letzte Sicherung fehlgeschlagen: {reason} (neuer Versuch folgt)',
  },
  now: 'Jetzt sichern',
  restore: 'Aus Sicherung wiederherstellen',
  done: 'Sicherung fertig',
  failed: 'Sicherung nicht möglich: {reason}',
  restoreNone: 'Es gibt noch keine Sicherung',
  restoreFailed: 'Wiederherstellen nicht möglich: {reason}',
  restoreDialog: {
    title: 'Aus Sicherung wiederherstellen?',
    message: 'Das ersetzt deine Einstellungen, Designs und Tafel durch die neueste Sicherung. Vorher wird der jetzige Stand gesichert.',
    ok: 'Wiederherstellen',
  },
} satisfies Messages['backup'];
