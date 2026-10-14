/**
 * Light Mainfränkisch ("Fränggisch"). Partial: whatever is missing falls back to `de`, then `en`.
 * Moderate spellings only (des, ned, bassd, etz, amal, gud), readable for non-Franconians.
 */
import type { PartialMessages } from '../schema';
import calendarMainfr from './de-x-mainfr/calendar.ts';
import canvasMainfr from './de-x-mainfr/canvas.ts';
import bedtimeMainfr from './de-x-mainfr/bedtime.ts';

import sharingMainfr from './de-x-mainfr/sharing.ts';
import tasksMainfr from './de-x-mainfr/tasks.ts';
import themeMainfr from './de-x-mainfr/theme.ts';

export default {
  calendar: calendarMainfr,
  canvas: canvasMainfr,
  bedtime: bedtimeMainfr,
  sharing: sharingMainfr,
  tasks: tasksMainfr,
  views: {
    year: 'Jahr',
    month: 'Monad',
    week: 'Woche',
    day: 'Dag',
    tasks: 'Aufgabn',
  },
  nav: {
    views: 'Ansichdn',
  },
  common: {
    off: 'Aus',
  },
  errors: {
    saveUnavailable: 'Des hat ned geglabbd: Google Kalender is grad ned erreichbar',
    conflict: "Des wurd woanners gändert. Lad's amal neu un probier's widda.",
    validation: {
      endAfterStart: 'S Ende muss nach m Anfang kumma',
    },
  },
  tasklist: {
    untitled: 'Lisdn',
    titleOrItem: 'Schreib amal an Titel oder an Eindrag hin',
  },
  settings: {
    title: 'Eisdellunga',
    back: 'Zurück',
    saveFailed: 'Des konnd ned gspeichert wern',
    sections: {
      appearance: 'Aussehn',
      calendar: 'Kalender',
      tasklists: 'Aufgabnlisdn',
      motivation: 'Fokus un Motivation',
      motion: 'Bewegung un Ton',
      bedtime: 'Bettzeit',
      account: 'Konto un Daden',
    },
    theme: {
      label: 'Design',
    },
    language: {
      label: 'Sprach',
      auto: 'Automadisch',
    },
    calendar: {
      defaultView: 'Normale Ansichd',
      approachingCard: { label: 'Gleich-Karden', hint: 'Was etz lafft un was als Nächsdes kummt' },
      tasksCalendar: { label: 'Aufgabnkalender in Google zeing', hint: 'Die Lisdn bleibn auf jeden Fall in der App' },
    },
    tasklists: {
      categories: 'Kadegorien',
      addCategory: 'Kadegorie dazu',
    },
    motivation: {
      warnBefore: 'Vor m Terminanfang warna',
      calmMode: { label: 'Ruhemodus', hint: 'Weniger Glumb, ruhigere Farbn' },
      supportCat: 'Drostkatz',
      supportSometimes: 'Amal wieder',
      supportAlways: 'Jedes Mal',
    },
    account: {
      androidApp: { label: 'Android-App', updateLabel: 'App aktualisiern', hint: 'Den Kalender als Android-App mit Wochen-Widget, nur im Heim-WLAN', download: 'Runnerladen' },
      signOut: 'Abmelden',
      calendarAccess: { label: 'Kalenderzugriff', hint: 'Der Zugriff auf Google Kalender fehld. Erlaub ihn un setz auf Googles Bildschirm des Häkla beim Kalender.', grant: 'Kalenderzugriff erlaubn' },
      resetDemo: { done: 'Demodaden sin widda da' },
    },
    leftHanded: { label: 'Linkshänder-Modus', hint: 'Spiegld des Handy-Layout, dass die wichdichsdn Knöpf unterm linkn Daumen liegn' },
    plant: 'Pflanze',
    sunflowers: { label: 'Sonnenblumn', hint: 'Gilt bloß für die Szene Sonnenblumnfeld', grow: 'Wachsn mid Punkdn', full: 'Volles Feld' },
    ownThemes: { label: 'Eigene Designs (KI un Import)', hint: 'Experimentell: a Prompt für a KI un der Import vo ihrer Design-Datei im Design-Menü' },
  },
  themePreview: {
    label: 'Live-Vorschau',
    collapse: 'Live-Vorschau einklappn',
    expand: 'Live-Vorschau ausklappn',
    month: 'Januar 2030',
    today: 'Heid',
    sample: {
      sync: 'Team-Abstimmung', lunch: 'Middagessn', run: 'Laufn', review: 'Review', call: 'Anruf',
      groceries: 'Einkauf', milk: 'Milch', bread: 'Brod', eggs: 'Eier',
    },
  },
  theme: themeMainfr,
} satisfies PartialMessages;
