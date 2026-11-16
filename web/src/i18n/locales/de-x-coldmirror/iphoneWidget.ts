/** Coldmirror texts of the iPhone widget setup; what is not jokey is German as in `de`. */
import iphoneWidgetDe from '../de/iphoneWidget.ts';

export default {
  ...iphoneWidgetDe,
  title: 'iPhone-Widget, yo',
  add: 'iPhone-Widget klarmachen',
  addAnother: '+ Noch ein Gerät, Digga',
  nameLabel: 'Wie heißt das Ding?',
  create: 'Weiter, BÄM',
  never: 'Noch nie angefasst',
  remove: 'Weg damit',
  done: 'Alles klar, Digga',
  hours: { ...iphoneWidgetDe.hours, label: 'Uhrzeiten (Mehrere Tage), yo' },
  circle: { ...iphoneWidgetDe.circle, label: 'Kreis auf dem Sperrbildschirm, yo', time: 'Startzeit, Digga', countdown: 'Countdown, BÄM' },
  guide: { ...iphoneWidgetDe.guide, copied: 'Kopiert ✓, yo', connected: 'Widget am Start ✓ – {name}, {time}' },
};
