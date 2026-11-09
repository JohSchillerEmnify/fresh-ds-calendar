/**
 * English messages of the Google Drive backup (feature drive-backup, ADR 0021): the Settings rows, the restore dialog
 * and the messages after a backup or restore. Spread into the main catalogue as `backup`; `{ } @ |` must be escaped.
 */
export default {
  label: 'Backup to Google Drive',
  hint: 'Your settings, themes and canvas are kept in a hidden folder of your Google Drive',
  allow: {
    label: 'Backups to Google Drive are off',
    hint: 'Allow the app to keep a backup in its own hidden Drive folder. Google asks you once.',
    button: 'Allow backups to Google Drive',
  },
  status: {
    never: 'No backup yet',
    ok: 'Last backup: {time}',
    failed: 'Last backup failed: {reason} (retrying)',
  },
  now: 'Back up now',
  restore: 'Restore from backup',
  done: 'Backup done',
  failed: "Couldn't back up: {reason}",
  restoreNone: 'There is no backup yet',
  restoreFailed: "Couldn't restore: {reason}",
  restoreDialog: {
    title: 'Restore from backup?',
    message: 'This replaces your settings, themes and canvas with the newest backup. Your current state is backed up first.',
    ok: 'Restore',
  },
};
