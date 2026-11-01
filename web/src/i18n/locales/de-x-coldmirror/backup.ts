/**
 * Coldmirror messages of the Google Drive backup, in the voice of "Fresh Dumbledore" (Fresh D.). Complete: it covers
 * every key of `de`. Crude humour only about the Harry Potter characters.
 */
import type { Messages } from '../../schema';

export default {
  label: 'Eulenpost-Backup in Google Drive, yo',
  hint: 'Deine Settings, Themes und die Tafel liegen im geheimen Verlies deines Google Drive, sicherer als Nevilles Kröte',
  allow: {
    label: 'Eulenpost ist aus, Digga',
    hint: 'Erlaub der App, ein Backup im eigenen versteckten Drive-Ordner zu stashen. Google fragt dich einmal, wie McGonagall bei der Anwesenheit.',
    button: 'Eulenpost in Google Drive erlauben, yo',
  },
  status: {
    never: 'Noch kein Backup, wie Voldemort ohne Nase',
    ok: 'Letztes Backup: {time}',
    failed: 'Letztes Backup verpatzt wie Nevilles Zaubertrank: {reason} (Fresh D. versucht es gleich nochmal)',
  },
  now: 'Jetzt in die Eulenpost, yo',
  restore: 'Aus der Eulenpost zurückzaubern',
  done: 'Fresh D. hat alles in die Eulenpost gepackt',
  failed: 'Die Eule ist gegen die Wand geflogen: {reason}',
  restoreNone: 'Keine Eulenpost da, Dobby hat nix gefunden',
  restoreFailed: 'Zurückzaubern verpatzt, Hermine schüttelt den Kopf: {reason}',
  restoreDialog: {
    title: 'Aus der Eulenpost zurückholen, Digga?',
    message: 'Das ersetzt deine Settings, Themes und Tafel auf diesem Server mit dem neuesten Backup, krass. Vorher gibt es ein Backup vom jetzigen Stand, damit es nicht endet wie bei Dumbledores Hand.',
    ok: 'Zurückzaubern, yo',
  },
} satisfies Messages['backup'];
