/** Light Mainfränkisch texts of the iPhone widget setup; the long steps fall back to `de`. */
import type { PartialMessages } from '../../schema';

export default {
  title: 'iPhone-Widget',
  intro: 'Dei Kalender affm Home-Bildschirm und affm Sperrbildschirm.',
  add: 'iPhone-Widget dazuduan',
  addAnother: '+ Nuch a Gerät dazuduan',
  nameLabel: 'Gerädename',
  create: 'Weider',
  never: 'Noch nie bnutzd',
  lastUsed: 'Zuletzd bnutzd: {time}',
  remove: 'Wegmachn',
  removeTitle: '„{name}“ wegmachn?',
  done: 'Bassd',
  circle: { label: 'Kreis affm Sperrbildschirm', time: 'Startzeid', countdown: 'Countdown' },
  guide: { copied: 'Kopierd ✓', connected: 'Widget verbundn ✓ – {name}, {time}' },
} satisfies PartialMessages['iphoneWidget'];
