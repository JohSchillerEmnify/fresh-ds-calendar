/**
 * Light Mainfränkisch ("Fränggisch"). Partial: whatever is missing falls back to `de`, then `en`.
 * Moderate spellings only (des, ned, bassd, etz, amal, gud), readable for non-Franconians.
 */
import type { PartialMessages } from '../schema';
import calendarMainfr from './de-x-mainfr/calendar.ts';
import backupMainfr from './de-x-mainfr/backup.ts';
import canvasMainfr from './de-x-mainfr/canvas.ts';
import bedtimeMainfr from './de-x-mainfr/bedtime.ts';

import sharingMainfr from './de-x-mainfr/sharing.ts';
import tasksMainfr from './de-x-mainfr/tasks.ts';
import themeMainfr from './de-x-mainfr/theme.ts';

import settingsNavMainfr from './de-x-mainfr/settingsNav.ts';
export default {
  settingsNav: settingsNavMainfr,
  calendar: calendarMainfr,
  backup: backupMainfr,
  canvas: canvasMainfr,
  bedtime: bedtimeMainfr,
  sharing: sharingMainfr,
  tasks: tasksMainfr,
  app: {
    name: "Fresh-D's Kalender",
    short: 'Fresh-D',
    slogan: 'Trag ein, trag aus, macht mir nix aus!',
  },
  views: {
    year: 'Jahr',
    month: 'Monad',
    week: 'Woche',
    day: 'Dag',
    tasks: 'Aufgabn',
    zoom: 'Zoom-Monad',
    horizontal: 'Waagrechd',
    runway: 'Bis ins Bedd',
    now: 'Etz',
  },
  horizontal: {
    timeIn: 'Zeid nei zoomma',
    timeOut: 'Zeid naus zoomma',
    dayIn: 'Dag hecher',
    dayOut: 'Dag niedriger',
  },
  zoomMonth: {
    zoomIn: 'Nei zoomma',
    zoomOut: 'Naus zoomma',
  },
  nav: {
    views: 'Ansichdn',
    menu: 'Menü',
    calendars: 'Kalender',
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
    titleOrItem: 'Schreib amal an Titel oder an Eindrag hin',
  },
  settings: {
    title: 'Eisdellunga',
    back: 'Zurück',
    saveFailed: 'Des konnd ned gspeichert wern',
    sections: {
      bedtime: 'Bettzeit',
    },
    notifications: {
      events: { label: 'Vor Termin' },
      tasklists: 'Vor Listen mit Uhrzeit',
      morning: { label: 'Überblick in der Früh', hint: 'Dei Tag auf an Blick, wann du willst', time: 'Uhrzeit vom Überblick' },
      overview: { title: 'Dei Tag', appointments: 'ka Termin | 1 Termin | {count} Termin', lists: 'ka Listen | 1 Listn | {count} Listen', first: 'zerst: {title} {time}' },
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
      approachTimeLeft: { label: 'Restzeid', hint: 'Die Restzeid vom laufenden Termin in der Karden; aus, stehd sie am Termin selber' },
      minEventLength: { label: 'Mindesdlänge für Termine', hint: 'Kürzere Termine wern so lang hiigmold, dass mer ihrn Titel noch lesn ko', off: 'Aus', minutes: '{n} Min.' },
      sideBySide: { hint: 'So vill Termine passn nebnanander, der Rest leichd obndrauf', upTo: 'Bis zu {n}', only: 'Nur {n}' },
      tasksCalendar: { label: 'Aufgabnkalender in Google zeing', hint: 'Die Lisdn bleibn auf jeden Fall in der App' },
    },
    tasklists: {
      carriedFrom: { label: 'Zeigen, wo verschobne Listen herkumma', hint: 'Des „Vom Sa., 10. Okt.“ an offne Listen, die auf heut grutscht sin. Aus: Die stehn halt bei heut.' },
      taskCategories: { label: 'Kadegorien für Aufgabnlisdn', hint: 'Aufgabnlisdn nach Kadegorie grubbieren, sordiern, fildern un einfärbn. Ausschalddn blendes nur aus, nix wird gelöschd.' },
      addCategory: 'Kadegorie dazu',
    },
    motivation: {
      calmMode: { label: 'Ruhemodus', hint: 'Weniger Glumb, ruhigere Farbn' },
      supportCat: 'Drostkatz',
      supportSometimes: 'Amal wieder',
      supportAlways: 'Jedes Mal',
    },
    account: {
      androidApp: { label: 'Android-App', updateLabel: 'App aktualisiern', hint: 'Den Kalender als Android-App mit Wochen-Widget', download: 'Runnerladen' },
      installApp: { label: 'App installiern', hint: 'Den Kalender affn Home-Bildschirm lekn', button: 'Anleidung', title: 'Kalender installiern', step1: 'Tipp auf den Teiln-Knopf', step2: 'Wähl „Zum Home-Bildschirm“', step3: 'Tipp auf Hinzufügn', close: 'Bassd' },
      signOut: 'Abmelden',
      calendarAccess: { label: 'Kalenderzugriff', hint: 'Der Zugriff auf Google Kalender fehld. Erlaub ihn un setz auf Googles Bildschirm des Häkla beim Kalender.', grant: 'Kalenderzugriff erlaubn' },
      resetDemo: { done: 'Demodaden sin widda da' },
    },
    leftHanded: { label: 'Linkshänder-Modus', hint: 'Spiegld des Handy-Layout, dass die wichdichsdn Knöpf unterm linkn Daumen liegn' },
    navPosition: { hint: 'Wo Jahr, Monad, Woche un Dag liegn', bottom: 'Unden', top: 'Oben', rail: 'Seidnleisdn', drawer: 'Seidnmenü' },
    sunflowers: { label: 'Sonnenblumn', hint: 'Gilt bloß für die Szene Sonnenblumnfeld', grow: 'Wachsn mid Punkdn', full: 'Volles Feld' },
    ownThemes: { label: 'Designs mit KI erzeuge', hint: 'Experimentell: a Prompt für a KI hole un des Design importiere, wo sie liefert' },
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
