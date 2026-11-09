/** Mainfränkisch (light) messages of bedtime mode. Complete: it covers every key of `de`. */
import type { PartialMessages } from '../../schema';

export default {
  reminder: 'Gleich is Bettzeit, in {count} Minuhd | Gleich is Bettzeit, in {count} Minuden',
  moon: 'Ins Bett um {time}',
  notification: 'Ins Bett um {time}',
  sun: 'Aufstehn um {time}',
  settings: {
    on: { label: 'Bettzeit', hint: 'Zeigt die Nachd im Kalender un sacht dir vorher Bescheid' },
    mode: { label: 'Bettzeit is', fixed: 'Feste Zeidn', dynamic: 'Nach meim erschdn Termin' },
    bedtime: 'Ins Bett',
    wake: 'Aufstehn',
    weekend: { label: 'Am Wochenende annerschd', hint: 'Für die Nächd vor Samsdag un Sonndag' },
    weekendBedtime: 'Ins Bett am Wochenende',
    weekendWake: 'Aufstehn am Wochenende',
    dynamicHint: 'Dei erschder Termin vom nächsdn Dag kann die Bettzeit nur früher leggn als die festn Zeidn. Ohne Termin mit Uhrzeit gelden die festn Zeidn.',
    sleep: { label: 'Wie lang schlafn', hours: '{count} Stund | {count} Stunden' },
    lead: { label: 'Zeit vor dem erschdn Termin', minutes: '{count} Min.', none: 'Kei' },
    reminder: { label: 'Vorher Bescheid sachn', minutes: '{count} Min.', off: 'Aus' },
  },
  runway: {
    header: 'Noch {left} bis ins Bedd · {free} frei',
    now: 'Etz {time}',
    bed: 'Bedd {time}',
    off: 'Bettzeit is aus – stell sa in die Einstellunga ei',
    passed: 'Ins Bedd wärs um {time} ganga',
    openSettings: 'Einstellunga aufmachn',
  },
} satisfies PartialMessages['bedtime'];
