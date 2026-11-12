/** German message catalogue; complete (a key missing here is a type error and fails `pnpm i18n:check`). */
import type { Messages } from '../schema';
import calendarDe from './de/calendar.ts';
import outboxDe from './de/outbox.ts';
import iphoneWidgetDe from './de/iphoneWidget.ts';
import deviceLogDe from './de/deviceLog.ts';
import backupDe from './de/backup.ts';
import canvasDe from './de/canvas.ts';
import inkDe from './de/ink.ts';
import bedtimeDe from './de/bedtime.ts';

import sharingDe from './de/sharing.ts';
import tasksDe from './de/tasks.ts';
import themeDe from './de/theme.ts';

import settingsNavDe from './de/settingsNav.ts';
export default {
  settingsNav: settingsNavDe,
  calendar: calendarDe,
  outbox: outboxDe,
  iphoneWidget: iphoneWidgetDe,
  deviceLog: deviceLogDe,
  backup: backupDe,
  canvas: canvasDe,
  ink: inkDe,
  bedtime: bedtimeDe,
  sharing: sharingDe,
  tasks: tasksDe,
  app: {
    name: "Fresh-D's Kalender",
    short: 'Fresh-D',
    slogan: 'Trag ein, trag aus, macht mir nix aus!',
  },
  views: {
    year: 'Jahr',
    month: 'Monat',
    week: 'Woche',
    day: 'Tag',
    tasks: 'Aufgaben',
    clock: 'Einfache Uhr',
    clockRings: 'Uhr',
    timeline: 'Zeitstrahl',
    strip: 'Streifen',
    zoom: 'Zoom-Monat',
    horizontal: 'Horizontal',
    runway: 'Bis ins Bett',
    now: 'Jetzt',
  },
  horizontal: {
    timeIn: 'Zeit vergrößern',
    timeOut: 'Zeit verkleinern',
    dayIn: 'Tage höher',
    dayOut: 'Tage niedriger',
  },
  zoomMonth: {
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
  },
  nav: {
    views: 'Ansichten',
    menu: 'Menü',
    calendars: 'Kalender',
  },
  common: {
    off: 'Aus',
  },
  errors: {
    saveUnavailable: 'Speichern nicht möglich: Google Kalender ist nicht erreichbar',
    saveServerUnreachable: 'Speichern nicht möglich: Der Kalender-Server ist nicht erreichbar',
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
    showsTwice: 'Diese Liste steht am {date} doppelt im Kalender. Lösche die andere Kopie und versuche es dann noch einmal.',
    titleOrItem: 'Gib einen Titel oder einen Eintrag ein',
    tooManyItems: 'Eine Aufgabenliste darf höchstens 200 Einträge haben',
    tagsUnique: 'Jeder Tag kann nur einmal verwendet werden.',
  },
  settings: {
    title: 'Einstellungen',
    back: 'Zurück',
    sectionsLabel: 'Bereiche der Einstellungen',
    saveFailed: 'Einstellungen konnten nicht gespeichert werden',
    sections: {
      bedtime: 'Schlafenszeit',
    },
    reminders: {
      intro: 'Das sind die Erinnerungen von Google Kalender. Die Standard-Erinnerungen eines Kalenders gelten für jeden Termin, der keine eigenen hat.',
      push: {
        denied: 'Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen und schalte das danach wieder ein.',
        failed: 'Die Browser-Erinnerungen ließen sich nicht einschalten. Versuche es noch einmal.',
      },
      tasklists: {
        default: 'Standard-Erinnerungen der Aufgabenlisten',
      },
    },
    notifications: {
      events: { label: 'Vor Terminen' },
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
      viewsKeepOne: 'Mindestens eine Ansicht bleibt eingeschaltet.',
      approachingCard: { label: 'Karte „Gleich“', hint: 'Was jetzt läuft und als Nächstes kommt, über dem Kalender' },
      approachTimeLeft: { label: 'Restzeit', hint: 'Zeigt in der Karte „Gleich“, wie lange der laufende Termin noch dauert. Wenn aus, steht das am Termin selbst.' },
      minEventLength: { label: 'Mindestlänge für Termine', hint: 'Kürzere Termine und Aufgabenlisten werden mindestens so lang angezeigt, damit ihr Titel lesbar bleibt', off: 'Aus', minutes: '{n} Min.' },
      sideBySide: { hint: 'Wie viele überlappende Termine nebeneinander stehen. Weitere liegen versetzt auf dem letzten.', upTo: 'Bis zu {n}', only: 'Nur {n}' },
      barSize: { expressive: 'Ausdrucksstark', compact: 'Kompakt' },
      topBarSize: { label: 'Größe der Kopfzeile', hint: 'Auf dem Handy; Ausdrucksstark zeigt die ganze Szene, Kompakt ist eine Zeile' },
      bottomBarSize: { label: 'Größe der unteren Leiste', hint: 'Auf dem Handy' },
      monthScroll: { label: 'Monatsansicht scrollt', sideways: 'Seitwärts', vertical: 'Auf und ab', verticalSnap: 'Auf und ab, ein Monat nach dem anderen' },
      approachBar: { label: 'Leiste „Gleich“', hint: 'Was heute als Nächstes kommt, als Leiste in der Karte' },
      syncIndicator: { hint: 'Zeigt das Sync-Symbol immer, nicht nur, wenn die Synchronisierung fehlschlägt' },
      approachWindow: {
        label: 'Wie weit die Leiste vorausschaut',
      },
    },
    tasklists: {
      carriedFrom: { label: 'Herkunft verschobener Listen zeigen', hint: 'Offene Listen, die auf heute weitergerückt sind, bekommen ein Etikett wie „Vom Sa., 10. Okt.“. Wenn aus, stehen sie einfach bei heute.' },
      taskCategories: { label: 'Kategorien für Aufgabenlisten', hint: 'Aufgabenlisten nach Kategorie gruppieren, sortieren, filtern und einfärben. Ausschalten blendet nur aus, nichts wird gelöscht.' },
      addCategory: 'Kategorie hinzufügen',
      editCategory: '{name} bearbeiten',
      undatedDone: { label: 'Erledigte Liste ohne Datum', calendar: 'Am Tag der Erledigung zeigen', archive: 'Nur im Archiv' },
      taskOpen: { label: 'Tippen auf eine Aufgabenliste', inline: 'Klappt auf', drawer: 'Öffnet die Liste' },
      growSeveral: { label: 'Mehrere Listen offen lassen', hint: 'Angetippte Listen bleiben offen, bis du auf ihren Titel tippst. Aus: Eine neue Liste schließt die vorherige.' },
    },
    motivation: {
      calmMode: { label: 'Ruhemodus', hint: 'Weniger Details, ruhigere Farben, weniger Bewegung' },
      streak: { label: 'Serie', off: 'Aus', flame: 'Flamme', plant: 'Pflanze' },
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
    widgets: {
      android: { label: 'Widgets für den Home-Bildschirm', hint: 'Ist die Android-App installiert, halte den Home-Bildschirm gedrückt, tippe auf „Widgets“ und wähle den Kalender für die Woche, den Tag, die Uhr, die Liste oder mehrere Tage.' },
      scroll: { label: 'Stunden im Blick', hint: 'Bei „Automatisch“ richtet sich der Bereich nach deinen Terminen. Mit „Fest“ wählst du, wie viele Stunden das Widget „Mehrere Tage“ auf einmal zeigt.', auto: 'Automatisch', fixed: 'Fest', hoursValue: '{n} Stunden', days: 'Anzahl der Tage' },
      timeline: { hint: 'Wie viele Tage „Mehrere Tage“ ab heute zeigt.' },
      textSize: { label: 'Schriftgröße', hint: 'Größer ist leichter zu lesen; dafür passt weniger Text in schmale Spalten.' },
    },
    labs: {
      weekTwoRow: { label: 'Wochenübersicht in zwei Zeilen', hint: 'Zeigt die Woche in zwei Zeilen, damit alle sieben Tage ohne Scrollen auf einen Bildschirm passen', split: 'Tage in der oberen Zeile' },
    },
    account: {
      signedIn: 'Mit Google angemeldet',
      signOut: 'Abmelden',
      signOutAll: { label: 'Überall abmelden', hint: 'Beendet die Anmeldung auf allen Geräten, auch auf diesem', button: 'Überall abmelden' },
      calendarAccess: { label: 'Kalenderzugriff', hint: 'Wenn Google nach Berechtigungen fragt, wähle „Kalender“ aus. Ohne diese Berechtigung kann dein Kalender nicht geladen werden.', grant: 'Kalenderzugriff erlauben' },
      resetDemo: { label: 'Demodaten zurücksetzen', hint: 'Ersetzt den Demokalender durch frische Demotermine', button: 'Zurücksetzen', done: 'Demodaten wiederhergestellt', failed: 'Demodaten konnten nicht zurückgesetzt werden' },
      update: { check: 'Nach Updates suchen', checking: 'Suche läuft…', current: 'Das ist die neueste Version.', ready: 'Eine neue Version ist bereit.', load: 'Jetzt aktualisieren', apk: 'Eine neue App-Version ist bereit.', failed: 'Die Suche hat nicht geklappt. Versuche es später noch einmal.' },
      version: 'Version {version}',
      appCert: { label: 'Signaturzertifikat der App (SHA-256)', hint: 'Die hier angebotene Android-App ist mit diesem Zertifikat signiert. Vergleiche es, bevor du ein Update installierst.' },
      whatsNew: { label: 'Was ist neu' },
      credits: { label: 'Danksagungen', hint: 'Bibliotheken und Inhalte, die diese App verwendet', title: 'Danksagungen', intro: 'Diese App entsteht mit den folgenden Bibliotheken und Inhalten. Danke an alle, die sie bauen und teilen.', close: 'Schließen' },
      androidApp: { label: 'Android-App', updateLabel: 'App aktualisieren', hint: 'Mit Wochen-Widget für den Home-Bildschirm', download: 'Herunterladen' },
      installApp: { label: 'App installieren', hint: 'Den Kalender zum Home-Bildschirm hinzufügen', button: 'Anleitung', title: 'Kalender installieren', step1: 'Tippe auf „Teilen“', step2: 'Wähle „Zum Home-Bildschirm“', step3: 'Tippe auf „Hinzufügen“', close: 'Verstanden' },
      versionCorner: { label: 'Version in der Ecke zeigen' },
    },
    leftHanded: { label: 'Linkshänder-Modus', hint: 'Spiegelt das Handy-Layout, sodass die wichtigsten Bedienelemente unter dem linken Daumen liegen' },
    navPosition: { hint: 'Wo Jahr, Monat, Woche und Tag liegen', bottom: 'Unten', top: 'Oben', rail: 'Seitenleiste', drawer: 'Seitenmenü' },
    sunflowers: { label: 'Sonnenblumen', hint: 'Gilt für die Szene Sonnenblumenfeld', grow: 'Wachsen mit Punkten', full: 'Volles Feld' },
    ownThemes: { label: 'Designs mit KI erzeugen', hint: 'Experimentell: einen Prompt für eine KI holen und das Design importieren, das sie liefert' },
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
