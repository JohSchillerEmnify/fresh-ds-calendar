/**
 * Coldmirror locale in the voice of "Fresh Dumbledore" (Fresh D.), the ancient headmaster who tries far too hard to be a
 * rapper. Complete: it covers every key of `de`. Never "Ich bin voll geil" (owner).
 */
import type { Messages } from '../schema';

import tasksColdmirror from './de-x-coldmirror/tasks.ts';

export default {
  tasks: tasksColdmirror,
  views: {
    year: 'Jahr, yo',
    month: 'Monat, yo',
    week: 'Woche, fresh',
    day: 'Tag, Digga',
    tasks: 'Aufgaben, yo',
    clock: 'Uhr, krass',
    timeline: 'Zeitstrahl, yo',
    strip: 'Streifen, yo',
  },
  nav: {
    views: 'Ansichten, yo',
  },
  common: {
    off: 'Aus, bye',
  },
  errors: {
    saveUnavailable: 'Ey Mann, wo\'s mein Hörgerät? Google Kalender ist nicht erreichbar, Schinken!',
    conflict: 'Fresh D vs. MCV, das Battle endet nie! Der Termin wurde woanders geändert, du Oberpflaume. Lad ihn neu.',
    validation: {
      endAfterStart: 'Das Ende vor dem Anfang? Du Oberpflaume. Das hätt nicht mal Voldemort verbockt.',
      eventTooLong: 'Bekannt aus „Ich hasse dich“ und „Verzieh dich“: Fresh D. sagt nö. Maximal 366 Tage.',
    },
  },
  category: {
    nameExists: 'Hallo, ich bin Ron. Ähm, das hast du eben schon gesagt: Den Namen gibt es schon.',
  },
  tasklist: {
    untitled: 'Liste, yo',
    titleOrItem: 'Schinken! Gib einen Titel oder einen Eintrag ein, Digga',
    tooManyItems: 'Haltet mal eure Schnauzen, Kinder: Fresh Dumbledore möchte maximal 200 Einträge.',
    tagsUnique: 'Ähm, das hast du eben schon gesagt. Tags müssen unique sein.',
  },
  settings: {
    title: 'Settings, yo',
    back: 'Back, Digga',
    sectionsLabel: 'Bereiche der Settings, fresh',
    saveFailed: 'BÄMbus! Nee, doch nicht: nix gespeichert. Wenn du denkst, es geht nicht mehr, kommt von irgendwo ein Fresh Dumbledore her!',
    sections: {
      appearance: 'Look, fresh',
      calendar: 'Kalender, yo',
      tasklists: 'To-do-Listen',
      motivation: 'Fokus & Flow',
      motion: 'Move & Sound',
      labs: 'Hexenlabor',
      account: 'Konto & Daten, yo',
    },
    theme: {
      label: 'Bling-Bling',
      hint: 'Modus, Farbe, Glow, Einträge, Ecken und Szene. Check mal aus, alles fresh.',
    },
    language: {
      label: 'Sprache, du Oberpflaume',
      auto: 'Automatisch, yo',
    },
    calendar: {
      defaultView: 'Standard-Ansicht, yo',
      defaultEventColor: 'Standardfarbe für Termine, fresh',
      calendarColor: 'Farbe vom Kalender, yo',
      approachingCard: { label: 'Karte „Gleich“, yo', hint: 'Was jetzt läuft und als Nächstes kommt, über dem Kalender. Sie haben fett vergessen? Fresh D. nicht.' },
      approachBar: { label: 'Leiste „Gleich“, yo', hint: 'Was heute als Nächstes kommt, als Leiste in der Karte, Digga' },
      approachWindow: {
        label: 'Die Leiste reicht voraus, yo',
        hours: '{count} Stunde, fresh | {count} Stunden, fresh',
        custom: 'Eigene, yo…',
        customLabel: 'Stunden, Digga',
        invalid: 'Gib eine ganze Zahl von 1 bis 24 ein, du Oberpflaume. Scheiße, so schwer ist das nicht.',
      },
      tasksCalendar: { label: 'Aufgabenkalender in Google zeigen, yo', hint: 'Aufgabenlisten bleiben in jedem Fall in der App, Digga' },
    },
    tasklists: {
      categories: 'Kategorien, yo',
      addCategory: 'Kategorie am Start, yo',
      editCategory: '{name} pimpen',
      moveUp: '{name} nach oben, yo',
      moveDown: '{name} nach unten, yo',
    },
    motivation: {
      warnBefore: 'Vor Terminbeginn warnen, Digga',
      transitionWarning: 'Warnung vor dem Wechsel, yo',
      minutes: '{count} Min., yo',
      calmMode: { label: 'Chill-Modus', hint: 'Weniger Details, ruhigere Farben, weniger Bewegung, wie Fresh D. am Nachmittag' },
      streakFlame: 'Serien-Flamme, krass',
      currentStreak: 'Aktuelle Serie, yo',
      bestStreak: 'Beste Serie, krass',
      supportCat: 'Trostkatze (Eulen. Eulen everywhere.)',
      supportSometimes: 'Manchmal, yo',
      supportAlways: 'Jedes Mal, fresh',
    },
    motion: {
      animations: 'Animationen, fresh',
      full: 'Voll, krass',
      reduced: 'Reduziert, yo',
      systemReduced: 'Dein Gerät will weniger Bewegung, Digga, deshalb sind Animationen auf „Reduziert“ begrenzt. Fresh D. versteht das, Hagrid stinkt auch zu viel für Action.',
      ignoreSystem: { label: 'Geräte-Setting ignorieren, yo', hint: 'Die Animationsstufe oben auch dann nutzen, wenn das Gerät weniger Bewegung will, Digga' },
      sounds: 'Sounds (ich rappe hier, ich rappe dort)',
    },
    labs: {
      experimental: { label: 'Experimentelle Ansichten, yo', hint: 'Uhr, Zeitstrahl und Streifen in der Ansichtswahl. Fresh D. hat das gecheckt, seit Billionen Jahren.' },
    },
    account: {
      signedIn: 'Mit Google am Start. Post für mich, Post für mich!',
      signOut: 'Schönen Day noch!',
      resetDemo: { label: 'Demodaten resetten, yo', hint: 'Ersetzt den Testkalender durch frische Demotermine. Kind auf die Türmatte, klingeln, wegrennen.', button: 'Hokus Pokus', done: 'Back from the Underground: Der Phönix ersteht aus seiner Asche, Demodaten sind da. Yo, vielen lieben thank und schönen day noch!', failed: 'Ich bin alt, ich bin bald tot, aus Grün wird Rot: Demodaten nicht resettet' },
      version: 'Version {version}, yo',
      versionCorner: { label: 'Version in der Ecke zeigen, yo', hint: 'Ein kleines Label unten links. Ey, wenn hier einer unnötige Anglismen verwendet, dann bin das immer noch ich.' },
    },
  },
} satisfies Messages;
