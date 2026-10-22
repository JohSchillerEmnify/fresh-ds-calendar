/** German messages of bedtime mode; complete (a key missing here is a type error). */
import type { Messages } from '../../schema';

export default {
  reminder: 'Schlafenszeit in {count} Minute | Schlafenszeit in {count} Minuten',
  moon: 'Schlafenszeit {time}',
  notification: 'Schlafenszeit um {time}',
  sun: 'Aufstehen {time}',
  settings: {
    on: { label: 'Schlafenszeit', hint: 'Zeigt die Nacht in den Kalenderansichten und erinnert dich vor dem Schlafengehen' },
    mode: { label: 'Schlafenszeit ist', fixed: 'Feste Zeiten', dynamic: 'Nach meinem ersten Termin' },
    bedtime: 'Schlafenszeit',
    wake: 'Aufstehen',
    weekend: { label: 'Am Wochenende anders', hint: 'Für die Nächte vor Samstag und Sonntag' },
    weekendBedtime: 'Schlafenszeit am Wochenende',
    weekendWake: 'Aufstehen am Wochenende',
    dynamicHint: 'Dein erster Termin am nächsten Tag kann die Schlafenszeit nur früher als die festen Zeiten legen. Ohne Termin mit Uhrzeit gelten die festen Zeiten.',
    sleep: { label: 'Schlafdauer', hours: '{count} Stunde | {count} Stunden' },
    lead: { label: 'Zeit vor dem ersten Termin', minutes: '{count} Min.', none: 'Keine' },
    reminder: { label: 'Vor der Schlafenszeit erinnern', minutes: '{count} Min.', off: 'Aus' },
  },
} satisfies Messages['bedtime'];
