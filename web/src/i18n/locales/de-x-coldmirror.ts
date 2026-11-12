/**
 * Coldmirror locale in the voice of "Fresh Dumbledore" (Fresh D.), the ancient headmaster who tries far too hard to be a
 * rapper. Complete: it covers every key of `de`. Never "Ich bin voll geil".
 */
import type { Messages } from '../schema';
import outboxDe from './de/outbox.ts';
import deviceLogDe from './de/deviceLog.ts';
import calendarColdmirror from './de-x-coldmirror/calendar.ts';
import backupColdmirror from './de-x-coldmirror/backup.ts';
import iphoneWidgetColdmirror from './de-x-coldmirror/iphoneWidget.ts';
import canvasColdmirror from './de-x-coldmirror/canvas.ts';
import inkColdmirror from './de-x-coldmirror/ink.ts';
import bedtimeColdmirror from './de-x-coldmirror/bedtime.ts';

import sharingColdmirror from './de-x-coldmirror/sharing.ts';
import tasksColdmirror from './de-x-coldmirror/tasks.ts';
import themeColdmirror from './de-x-coldmirror/theme.ts';

import settingsNavColdmirror from './de-x-coldmirror/settingsNav.ts';
export default {
  settingsNav: settingsNavColdmirror,
  calendar: calendarColdmirror,
  outbox: outboxDe,
  deviceLog: deviceLogDe,
  backup: backupColdmirror,
  iphoneWidget: iphoneWidgetColdmirror,
  canvas: canvasColdmirror,
  ink: inkColdmirror,
  bedtime: bedtimeColdmirror,
  sharing: sharingColdmirror,
  tasks: tasksColdmirror,
  app: {
    name: "Fresh-D's Kalender",
    short: 'Fresh-D',
    slogan: 'Trag ein, trag aus, macht mir nix aus!',
  },
  views: {
    year: 'Jahr, yo',
    month: 'Monat, yo',
    week: 'Woche, fresh',
    day: 'Tag, Digga',
    tasks: 'Aufgaben, yo',
    clock: 'Einfache Uhr, krass',
    clockRings: 'Uhr, krass',
    timeline: 'Zeitstrahl, yo',
    strip: 'Streifen, yo',
    zoom: 'Zoom-Monat, yo',
    horizontal: 'Horizontal, yo',
    runway: 'Bis ins Bett, yo',
    now: 'Jetzt, yo',
  },
  horizontal: {
    timeIn: 'Zeit reinzoomen, yo',
    timeOut: 'Zeit rauszoomen, yo',
    dayIn: 'Tage höher, yo',
    dayOut: 'Tage niedriger, yo',
  },
  zoomMonth: {
    zoomIn: 'Reinzoomen, yo',
    zoomOut: 'Rauszoomen, yo',
  },
  nav: {
    views: 'Ansichten, yo',
    menu: 'Menü, yo',
    calendars: 'Kalender, Digga',
  },
  common: {
    off: 'Aus, bye',
  },
  errors: {
    saveUnavailable: 'Ey Mann, wo\'s mein Hörgerät? Google Kalender ist nicht erreichbar, Schinken!',
    saveServerUnreachable: 'Ey Mann, wo\'s mein Hörgerät? Der Kalender-Server is nicht erreichbar, Schinken!',
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
    showsTwice: "Doppelt hält besser? Nö! Die Liste steht am {date} zweimal drin, Digga. Lösch die andere Kopie und probier's nochmal.",
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
      bedtime: 'Bettzeit, yo',
    },
    reminders: {
      intro: 'Das sind die Erinnerungen von Google Kalender. Die Standard-Erinnerungen eines Kalenders gelten für jeden Termin ohne eigene, Digga.',
      push: {
        denied: 'Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen und schalte das danach wieder ein.',
        failed: 'Die Browser-Erinnerungen ließen sich nicht einschalten. Versuche es noch einmal.',
      },
      tasklists: {
        default: 'Standard-Erinnerungen der To-do-Listen',
      },
    },
    notifications: {
      events: { label: 'Vor Terminen' },
      tasklists: 'Vor Listen mit Uhrzeit',
      morning: { label: 'Morgen-Überblick', hint: 'Dein Tag auf einen Blick, wann du willst', time: 'Uhrzeit vom Überblick' },
      overview: { title: 'Dein Tag, yo', appointments: 'keine Termine | 1 Termin | {count} Termine', lists: 'keine Listen | 1 Liste | {count} Listen', first: 'zuerst: {title} {time}' },
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
      viewsKeepOne: 'Mindestens eine Ansicht bleibt an, yo.',
      barSize: { expressive: 'Ausdrucksstark', compact: 'Kompakt' },
      topBarSize: { label: 'Kopfzeilengröße, yo', hint: 'Aufm Handy, Digga; Ausdrucksstark zeigt die ganze Szene, Kompakt ist eine Zeile' },
      bottomBarSize: { label: 'Untere Leiste Größe, Digga', hint: 'Aufm Handy, Digga' },
      monthScroll: { label: 'Monatsansicht scrollt, yo', sideways: 'Seitwärts', vertical: 'Auf und ab', verticalSnap: 'Auf und ab, ein Monat nach dem anderen' },
      syncIndicator: { hint: 'Zeigt das Sync-Symbol immer, nicht nur wenn der Abgleich rumzickt, Digga' },
      approachingCard: { label: 'Karte „Gleich“, yo', hint: 'Was jetzt läuft und als Nächstes kommt, über dem Kalender. Sie haben fett vergessen? Fresh D. nicht.' },
      approachTimeLeft: { label: 'Restzeit, yo', hint: 'Zeigt in der Karte, wie lang der Termin noch läuft. Wenn aus, steht das am Termin selbst, Digga' },
      minEventLength: { label: 'Mindestlänge für Termine', hint: 'Kurze Termine werden mindestens so lang gezeichnet. Lesbar bleiben, Digga.', off: 'Aus', minutes: '{n} Min.' },
      sideBySide: { hint: 'So viele Termine passen nebeneinander. Der Rest stapelt sich, Digga.', upTo: 'Bis zu {n}', only: 'Nur {n}' },
      approachBar: { label: 'Leiste „Gleich“, yo', hint: 'Was heute als Nächstes kommt, als Leiste in der Karte, Digga' },
      approachWindow: {
        label: 'Wie weit die Leiste vorausschaut, yo',
      },
      tasksCalendar: { label: 'Kalender der Aufgabenlisten in Google zeigen, yo', hint: 'Aufgabenlisten bleiben in jedem Fall in der App, Digga' },
    },
    tasklists: {
      carriedFrom: { label: 'Zeigen, woher verschobene Listen kommen, yo', hint: 'Offene Listen von früher kriegen ein „Vom Sa., 10. Okt.“-Etikett. Wenn aus, stehen die einfach bei heute, Digga.' },
      undatedDone: { label: 'Erledigte Liste ohne Datum, yo', calendar: 'Am Tag der Erledigung zeigen', archive: 'Nur im Archiv, Digga' },
      taskOpen: { label: 'Tippen auf ne Aufgabenliste, yo', inline: 'Klappt auf', drawer: 'Macht die Liste auf, Digga' },
      growSeveral: { label: 'Mehrere Listen offen lassen, yo', hint: 'Angetippte Listen bleiben offen, bis du auf ihren Titel tippst. Aus: Ne neue Liste macht die vorherige zu.' },
      taskCategories: { label: 'Kategorien für Aufgabenlisten, yo', hint: 'Aufgabenlisten nach Kategorie gruppieren, sortieren, filtern und einfärben. Ausschalten blendet nur aus, nix wird gelöscht, Digga.' },
      addCategory: 'Kategorie am Start, yo',
      editCategory: '{name} pimpen',
    },
    motivation: {
      calmMode: { label: 'Chill-Modus', hint: 'Weniger Details, ruhigere Farben, weniger Bewegung, wie Fresh D. am Nachmittag' },
      streak: { label: 'Serie, krass', off: 'Aus, Digga', flame: 'Flamme, yo', plant: 'Pflanze, yo' },
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
    widgets: {
      android: { label: 'Widgets für den Home-Bildschirm, yo', hint: 'Android-App drauf, dann Home-Bildschirm gedrückt halten, „Widgets“ antippen und den Kalender für Woche, Tag, Uhr, Liste oder mehrere Tage wählen, Digga.' },
      scroll: { label: 'Stunden im Blick, yo', hint: 'Wie viele Stunden des Tages das Widget „Mehrere Tage“ ohne Scrollen zeigt, Digga.', days: 'Tage in der Zeitleiste, yo' },
      timeline: { hint: 'Wie viele Tage die Zeitleiste ab heute zeigt, Digga.' },
      textSize: { label: 'Schriftgröße in der Zeitleiste', hint: 'Größer ist leichter zu lesen, Digga; dafür passt weniger Text in schmale Spalten.' },
    },
    labs: {
      weekTwoRow: { label: 'Wochenübersicht in zwei Zeilen, yo', hint: 'Die Woche in zwei Zeilen, damit alle sieben Tage ohne Scrollen auf den Screen passen, Digga', split: 'Tage in der oberen Zeile, yo' },
    },
    account: {
      signedIn: 'Mit Google am Start. Post für mich, Post für mich!',
      signOut: 'Schönen Day noch!',
      signOutAll: { label: 'Überall Schönen Day noch, yo', hint: 'Beendet die Anmeldung auf allen Geräten, auch auf diesem', button: 'Überall abmelden, yo' },
      calendarAccess: { label: 'Kalenderzugriff', hint: 'Google Kalender ist nicht erlaubt, Schinken! Erlaub ihn und setz den Haken beim Kalender, wenn Google nach den Berechtigungen fragt.', grant: 'Kalender erlauben, yo' },
      resetDemo: { label: 'Demodaten resetten, yo', hint: 'Ersetzt den Demokalender durch frische Demotermine. Kind auf die Türmatte, klingeln, wegrennen.', button: 'Hokus Pokus', done: 'Back from the Underground: Der Phönix ersteht aus seiner Asche, Demodaten sind da. Yo, vielen lieben thank und schönen day noch!', failed: 'Ich bin alt, ich bin bald tot, aus Grün wird Rot: Demodaten nicht resettet' },
      update: { check: 'Nach Updates checken, yo', checking: 'Checke gerade…', current: 'Das ist die neueste Version, fresh.', ready: 'Eine neue Version ist am Start.', load: 'Jetzt updaten, fresh', apk: 'Eine neue App-Version ist am Start.', failed: 'Hat nicht geklappt, yo. Probier es später nochmal.' },
      version: 'Version {version}, yo',
      appCert: { label: 'Signaturzertifikat der App (SHA-256), yo', hint: 'Die hier angebotene Android-App ist mit diesem Zertifikat signiert. Vergleiche es, bevor du ein Update installierst.' },
      whatsNew: { label: 'Was geht ab, yo' },
      credits: { label: 'Props, yo', hint: 'Bibliotheken und Inhalte, die diese App nutzt', title: 'Props, yo', intro: 'Diese App läuft mit den folgenden Bibliotheken und Inhalten. Respekt an alle, die sie bauen und teilen.', close: 'Zu, yo' },
      androidApp: { label: 'Android-App, fresh', updateLabel: 'App-Update, yo', hint: 'Fresh D. auf dein Handy, mit Wochen-Widget. Läuft überall, Digga', download: 'Runterladen, yo' },
      installApp: { label: 'App installieren, yo', hint: 'Fresh D. auf deinen Home-Bildschirm, Digga', button: 'Zeig mal', title: 'Fresh D. installieren', step1: 'Tipp auf den Teilen-Button, yo', step2: 'Wähl „Zum Home-Bildschirm“', step3: 'Tipp auf Hinzufügen, BÄMbus!', close: 'Alles klar, Digga' },
      versionCorner: { label: 'Version in der Ecke zeigen, yo' },
    },
    leftHanded: { label: 'Linkshänder-Modus, yo', hint: 'Spiegelt das Handy-Layout, damit die wichtigen Knöpfe unter dem linken Daumen liegen. Fresh D. ist Linkshänder, Digga.' },
    navPosition: { hint: 'Wo Jahr, Monat, Woche und Tag chillen, Digga', bottom: 'Unten', top: 'Oben', rail: 'Seitenleiste', drawer: 'Seitenmenü, fresh' },
    sunflowers: { label: 'Sonnenblumen, fresh', hint: 'Gilt nur für die Szene Sonnenblumenfeld, Digga', grow: 'Wachsen mit Punkten, yo', full: 'Volles Feld, fresh' },
    ownThemes: { label: 'Bling-Blings mit KI erzeugen', hint: 'Experimentell, Digga: einen Prompt für eine KI holen und das Bling-Bling importieren, das sie liefert' },
  },
  themePreview: {
    label: 'Live-Vorschau, fresh',
    collapse: 'Vorschau einklappen, yo',
    expand: 'Vorschau ausklappen, yo',
    month: 'Januar 2030',
    today: 'Heute, Digga',
    sample: {
      sync: 'Lehrerkonferenz', lunch: 'Mittag mit Hagrid', run: 'Vor Voldemort weglaufen', review: 'Rap-Battle', call: 'Eule an McGonagall',
      groceries: 'Einkauf', milk: 'Kürbissaft', bread: 'Brot', eggs: 'Drachen-Eier',
    },
  },
  theme: themeColdmirror,
} satisfies Messages;
