/** German message catalogue; complete (a key missing here is a type error and fails `pnpm i18n:check`). */
import type { Messages } from '../schema';
import calendarDe from './de/calendar.ts';
import backupDe from './de/backup.ts';
import canvasDe from './de/canvas.ts';
import bedtimeDe from './de/bedtime.ts';

import sharingDe from './de/sharing.ts';
import tasksDe from './de/tasks.ts';
import themeDe from './de/theme.ts';

export default {
  calendar: calendarDe,
  backup: backupDe,
  canvas: canvasDe,
  bedtime: bedtimeDe,
  sharing: sharingDe,
  tasks: tasksDe,
  views: {
    year: 'Jahr',
    month: 'Monat',
    week: 'Woche',
    day: 'Tag',
    tasks: 'Aufgaben',
    clock: 'Uhr',
    timeline: 'Zeitstrahl',
    strip: 'Streifen',
  },
  nav: {
    views: 'Ansichten',
  },
  common: {
    off: 'Aus',
  },
  errors: {
    saveUnavailable: 'Speichern nicht möglich: Google Kalender ist nicht erreichbar',
    conflict: 'Dieser Termin wurde woanders geändert. Lade ihn neu und versuche es noch einmal.',
    validation: {
      endAfterStart: 'Das Ende muss nach dem Beginn liegen',
      eventTooLong: 'Ein Termin darf höchstens 366 Tage lang sein',
    },
  },
  category: {
    nameExists: 'Eine Kategorie mit diesem Namen gibt es schon',
  },
  tasklist: {
    untitled: 'Liste',
    titleOrItem: 'Gib einen Titel oder einen Eintrag ein',
    tooManyItems: 'Eine Aufgabenliste darf höchstens 200 Einträge haben',
    tagsUnique: 'Tags müssen eindeutig sein',
  },
  settings: {
    title: 'Einstellungen',
    back: 'Zurück',
    sectionsLabel: 'Bereiche der Einstellungen',
    saveFailed: 'Einstellungen konnten nicht gespeichert werden',
    sections: {
      appearance: 'Darstellung',
      calendar: 'Kalender',
      tasklists: 'Aufgabenlisten',
      motivation: 'Fokus & Motivation',
      motion: 'Bewegung & Ton',
      bedtime: 'Schlafenszeit',
      labs: 'Labor',
      account: 'Konto & Daten',
    },
    theme: {
      label: 'Design',
      hint: 'Modus, Farbe, Leuchten, Einträge, Ecken und Szene',
    },
    language: {
      label: 'Sprache',
      auto: 'Automatisch',
    },
    calendar: {
      defaultView: 'Standardansicht',
      defaultEventColor: 'Standardfarbe für Termine',
      calendarColor: 'Farbe des Kalenders',
      approachingCard: { label: 'Karte „Gleich“', hint: 'Was jetzt läuft und als Nächstes kommt, über dem Kalender' },
      approachBar: { label: 'Leiste „Gleich“', hint: 'Was heute als Nächstes kommt, als Leiste in der Karte' },
      approachWindow: {
        label: 'Die Leiste reicht voraus',
        hours: '{count} Stunde | {count} Stunden',
        custom: 'Eigene…',
        customLabel: 'Stunden',
        invalid: 'Gib eine ganze Zahl von 1 bis 24 ein',
      },
      tasksCalendar: { label: 'Aufgabenkalender in Google zeigen', hint: 'Aufgabenlisten bleiben in jedem Fall in der App' },
    },
    tasklists: {
      categories: 'Kategorien',
      addCategory: 'Kategorie hinzufügen',
      editCategory: '{name} bearbeiten',
      moveUp: '{name} nach oben',
      moveDown: '{name} nach unten',
      undatedDone: { label: 'Erledigte Liste ohne Datum', calendar: 'Am Tag der Erledigung zeigen', archive: 'Nur im Archiv' },
    },
    motivation: {
      warnBefore: 'Vor Terminbeginn warnen',
      transitionWarning: 'Warnung vor dem Wechsel',
      minutes: '{count} Min.',
      calmMode: { label: 'Ruhemodus', hint: 'Weniger Details, ruhigere Farben, weniger Bewegung' },
      streakFlame: 'Serienflamme',
      currentStreak: 'Aktuelle Serie',
      bestStreak: 'Beste Serie',
      supportCat: 'Trostkatze',
      supportSometimes: 'Manchmal',
      supportAlways: 'Jedes Mal',
    },
    motion: {
      animations: 'Animationen',
      full: 'Voll',
      reduced: 'Reduziert',
      systemReduced: 'Dein Gerät wünscht weniger Bewegung, deshalb sind Animationen auf „Reduziert“ begrenzt.',
      ignoreSystem: { label: 'Geräteeinstellung ignorieren', hint: 'Die Animationsstufe oben auch dann nutzen, wenn das Gerät weniger Bewegung wünscht' },
      sounds: 'Töne',
    },
    labs: {
      experimental: { label: 'Experimentelle Ansichten', hint: 'Uhr, Zeitstrahl und Streifen in der Ansichtswahl' },
    },
    account: {
      signedIn: 'Mit Google angemeldet',
      signOut: 'Abmelden',
      calendarAccess: { label: 'Kalenderzugriff', hint: 'Der Zugriff auf Google Kalender fehlt. Erlaube ihn und setz auf Googles Bildschirm den Haken beim Kalender.', grant: 'Kalenderzugriff erlauben' },
      resetDemo: { label: 'Demodaten zurücksetzen', hint: 'Ersetzt den Testkalender durch frische Demotermine', button: 'Zurücksetzen', done: 'Demodaten wiederhergestellt', failed: 'Demodaten konnten nicht zurückgesetzt werden' },
      version: 'Version {version}',
      androidApp: { label: 'Android-App', updateLabel: 'App aktualisieren', hint: 'Den Kalender als Android-App mit Wochen-Widget für den Homescreen installieren (nur im Heim-WLAN)', download: 'Herunterladen' },
      versionCorner: { label: 'Version in der Ecke zeigen', hint: 'Ein kleines Label in einer unteren Ecke' },
    },
    leftHanded: { label: 'Linkshänder-Modus', hint: 'Spiegelt das Handy-Layout, sodass die wichtigsten Bedienelemente unter dem linken Daumen liegen' },
    plant: 'Pflanze',
    sunflowers: { label: 'Sonnenblumen', hint: 'Gilt für die Szene Sonnenblumenfeld', grow: 'Wachsen mit Punkten', full: 'Volles Feld' },
    ownThemes: { label: 'Eigene Designs (KI und Import)', hint: 'Experimentell: ein Prompt für eine KI und der Import ihrer Design-Datei im Design-Menü' },
  },
  themePreview: {
    label: 'Live-Vorschau',
    collapse: 'Live-Vorschau einklappen',
    expand: 'Live-Vorschau ausklappen',
    month: 'Januar 2030',
    today: 'Heute',
    sample: {
      sync: 'Team-Abstimmung', lunch: 'Mittagessen', run: 'Laufen', review: 'Review', call: 'Anruf',
      groceries: 'Einkauf', milk: 'Milch', bread: 'Brot', eggs: 'Eier',
    },
  },
  theme: themeDe,
} satisfies Messages;
