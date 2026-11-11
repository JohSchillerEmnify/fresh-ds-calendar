/**
 * Coldmirror messages of bedtime mode, in the voice of "Fresh Dumbledore" (Fresh D.). Complete: it covers every key of
 * `de`. Rude only about Harry Potter characters; never sexual, never slurs.
 */
import type { PartialMessages } from '../../schema';

export default {
  reminder: 'Fresh D. muss ins Bett in {count} Minute, sonst find ich mein Hörgerät morgen nicht | Fresh D. muss ins Bett in {count} Minuten, sonst find ich mein Hörgerät morgen nicht',
  moon: 'Ab ins Bett um {time}, yo',
  notification: 'Ab ins Bett um {time}, yo',
  sun: 'Aufstehen um {time}, fresh',
  settings: {
    on: { label: 'Bettzeit, yo', hint: 'Zeigt die Nacht im Kalender, und Fresh D. sagt vorher Bescheid, Digga' },
    mode: { label: 'Bettzeit ist, yo', fixed: 'Fest, Schinken!', dynamic: 'Nach Termin, fresh' },
    bedtime: 'Ab ins Bett',
    wake: 'Aufstehen, yo',
    weekend: { label: 'Am Wochenende anders, du Oberpflaume', hint: 'Für die Nächte vor Samstag und Sonntag, nicht mal Snape kontrolliert da' },
    weekendBedtime: 'Ab ins Bett am Wochenende',
    weekendWake: 'Aufstehen am Wochenende',
    dynamicHint: 'Ist dein erster Termin am nächsten Tag früh, gehst du entsprechend früher in die Koje, sonst wird Fresh D. grantig wie Filch. Ansonsten gelten die festen Zeiten.',
    sleep: { label: 'Schlafdauer, yo', hours: '{count} Stunde, yo | {count} Stunden, yo' },
    lead: { label: 'Zeit vor dem ersten Termin', minutes: '{count} Min., yo', none: 'Keine, Digga' },
    reminder: { label: 'Vorher Bescheid sagen, fresh', minutes: '{count} Min., yo', off: 'Aus, bye' },
  },
  runway: {
    header: 'Noch {left} bis Fresh D. pennt · {free} chillen',
    now: 'Jetzt {time}, yo',
    bed: 'Bett {time}, yo',
    off: 'Schlafenszeit ist aus, Digga – stell sie in den Einstellungen ein, sonst schläft hier keiner',
    passed: 'Schlafenszeit war um {time}, ab ins Bett, sonst macht Snape Nachsitzen',
    openSettings: 'Einstellungen auf, yo',
  },
} satisfies PartialMessages['bedtime'];
