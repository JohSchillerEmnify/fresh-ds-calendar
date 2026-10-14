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
    zoom: 'Zoom-Monat',
  },
  zoomMonth: {
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
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
      notifications: 'Benachrichtigungen',
    },
    notifications: {
      hint: 'In der Android-App kommen diese Erinnerungen auch, wenn die App geschlossen ist. Im Browser erscheinen sie nur in der App (Benachrichtigungen brauchen dort die HTTPS-Adresse).',
      bedtime: 'Erinnerung vor der Schlafenszeit',
      events: { label: 'Vor Terminen', hint: 'So früh wie der Hinweis unter Fokus & Motivation' },
      tasklists: 'Vor Aufgabenlisten mit Uhrzeit',
      morning: { label: 'Tagesüberblick am Morgen', hint: 'Dein Tag auf einen Blick, zu einer Uhrzeit deiner Wahl', time: 'Uhrzeit des Überblicks' },
      overview: { title: 'Dein Tag', appointments: 'keine Termine | 1 Termin | {count} Termine', lists: 'keine Listen | 1 Liste | {count} Listen', first: 'zuerst: {title} {time}' },
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
      carriedFrom: { label: 'Herkunft verschobener Listen zeigen', hint: 'Das Etikett „Vom Sa., 10. Okt.“ an offenen Listen, die auf heute gerückt sind. Aus: Sie stehen einfach bei heute.' },
      categories: 'Kategorien',
      taskCategories: { label: 'Kategorien für Aufgabenlisten', hint: 'Aufgabenlisten nach Kategorie gruppieren, sortieren, filtern und einfärben. Ausschalten blendet nur aus, nichts wird gelöscht.' },
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
      views: { title: 'Anzubietende experimentelle Ansichten' },
      experimental: { label: 'Experimentelle Ansichten', hint: 'Uhr, Zeitstrahl und Streifen in der Ansichtswahl' },
    },
    account: {
      signedIn: 'Mit Google angemeldet',
      signOut: 'Abmelden',
      calendarAccess: { label: 'Kalenderzugriff', hint: 'Der Zugriff auf Google Kalender fehlt. Erlaube ihn und setz auf Googles Bildschirm den Haken beim Kalender.', grant: 'Kalenderzugriff erlauben' },
      resetDemo: { label: 'Demodaten zurücksetzen', hint: 'Ersetzt den Testkalender durch frische Demotermine', button: 'Zurücksetzen', done: 'Demodaten wiederhergestellt', failed: 'Demodaten konnten nicht zurückgesetzt werden' },
      version: 'Version {version}',
      androidApp: { label: 'Android-App', updateLabel: 'App aktualisieren', hint: 'Den Kalender als Android-App mit Wochen-Widget für den Homescreen installieren', download: 'Herunterladen' },
      server: { label: 'Server: {host}', hint: 'Welchen Kalender-Server die App benutzt', change: 'Ändern' },
      installApp: { label: 'App installieren', hint: 'Den Kalender zum Home-Bildschirm hinzufügen', button: 'Anleitung', title: 'Kalender installieren', step1: 'Tippe auf den Teilen-Button', step2: 'Wähle „Zum Home-Bildschirm“', step3: 'Tippe auf Hinzufügen', close: 'Verstanden' },
      versionCorner: { label: 'Version in der Ecke zeigen', hint: 'Ein kleines Label in einer unteren Ecke' },
    },
    leftHanded: { label: 'Linkshänder-Modus', hint: 'Spiegelt das Handy-Layout, sodass die wichtigsten Bedienelemente unter dem linken Daumen liegen' },
    navPosition: { label: 'Ansichtswechsel', hint: 'Wo Jahr, Monat, Woche und Tag liegen', phone: 'Auf dem Handy', desktop: 'Auf Desktop und Tablet', bottom: 'Unten', top: 'Oben', rail: 'Seitenleiste' },
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
