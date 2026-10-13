/**
 * Light Mainfränkisch ("Fränggisch"). Partial: whatever is missing falls back to `de`, then `en`.
 * Moderate spellings only (des, ned, bassd, etz, amal, gud), readable for non-Franconians.
 */
import type { PartialMessages } from '../schema';

export default {
  views: {
    year: 'Jahr',
    month: 'Monad',
    week: 'Woche',
    day: 'Dag',
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
      account: 'Konto un Daden',
    },
    theme: {
      label: 'Design',
      automatic: 'Automadisch · {name}',
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
      signOut: 'Abmelden',
      resetDemo: { done: 'Demodaden sin widda da' },
    },
  },
} satisfies PartialMessages;
