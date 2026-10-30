/**
 * Coldmirror locale in the voice of "Fresh Dumbledore" (Fresh D.), the ancient headmaster who tries far too hard to be a
 * rapper. Complete: it covers every key of `de`. Never "Ich bin voll geil" (owner).
 */
import type { Messages } from '../schema';
import outboxDe from './de/outbox.ts';
import calendarColdmirror from './de-x-coldmirror/calendar.ts';
import backupColdmirror from './de-x-coldmirror/backup.ts';
import canvasColdmirror from './de-x-coldmirror/canvas.ts';
import inkColdmirror from './de-x-coldmirror/ink.ts';
import bedtimeColdmirror from './de-x-coldmirror/bedtime.ts';

import sharingColdmirror from './de-x-coldmirror/sharing.ts';
import tasksColdmirror from './de-x-coldmirror/tasks.ts';
import themeColdmirror from './de-x-coldmirror/theme.ts';

export default {
  calendar: calendarColdmirror,
  outbox: outboxDe,
  backup: backupColdmirror,
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
    clock: 'Uhr, krass',
    clockRings: 'Uhr: Ringe, krass',
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
      appearance: 'Look, fresh',
      calendar: 'Kalender, yo',
      tasklists: 'To-do-Listen',
      motivation: 'Fokus & Flow',
      motion: 'Move & Sound',
      bedtime: 'Bettzeit, yo',
      labs: 'Hexenlabor',
      account: 'Konto & Daten, yo',
      notifications: 'Benachrichtigungen, yo',
    },
    reminders: {
      label: 'Erinnerungen, yo',
      hint: 'Wann die App vor einem Termin klingelt, pro Kalender',
      title: 'Erinnerungen, yo',
      intro: 'Das sind die Erinnerungen von Google Kalender. Der Standard eines Kalenders gilt für jeden Termin ohne eigene Liste, Digga.',
      defaultFor: 'Standard-Erinnerungen von {name}',
      push: {
        title: 'Browser',
        label: 'Erinnerungen in diesem Browser, wenn die App geschlossen ist',
        hint: 'Dieser Browser bekommt die Erinnerungen als Benachrichtigung, zusätzlich zu denen in der App.',
        denied: 'Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen und schalte das danach wieder ein.',
        failed: 'Die Browser-Erinnerungen ließen sich nicht einschalten. Versuche es noch einmal.',
      },
      tasklists: {
        title: 'To-do-Listen',
        switch: { label: 'An To-do-Listen erinnern', hint: 'Listen mit Uhrzeit klingeln wie Termine. Die eigenen Erinnerungen stellst du in der Liste ein, yo.' },
        default: 'Standard-Erinnerungen der To-do-Listen',
      },
    },
    notifications: {
      hint: 'Die Erinnerungen kommen auch bei zugeklappter App, Digga: in der Android-App und im Browser, wenn „Erinnerungen in diesem Browser“ an ist (da braucht es HTTPS).',
      bedtime: 'Bettzeit-Alarm',
      events: { label: 'Vor Terminen', hint: 'Bei jeder Erinnerung eines Termins (Einstellungen → Erinnerungen), yo' },
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
      defaultEventColor: 'Standardfarbe für Termine, fresh',
      calendarColor: 'Farbe vom Kalender, yo',
      barSize: { expressive: 'Ausdrucksstark', compact: 'Kompakt' },
      topBarSize: { label: 'Kopfzeilengröße, yo', hint: 'Aufm Handy, Digga; Ausdrucksstark zeigt die ganze Szene, Kompakt ist eine Zeile' },
      bottomBarSize: { label: 'Untere Leiste Größe, Digga', hint: 'Aufm Handy, Digga' },
      syncIndicator: { label: 'Sync-Anzeige, yo', hint: 'Zeigt das Sync-Symbol immer, nicht nur wenn der Abgleich rumzickt, Digga' },
      approachingCard: { label: 'Karte „Gleich“, yo', hint: 'Was jetzt läuft und als Nächstes kommt, über dem Kalender. Sie haben fett vergessen? Fresh D. nicht.' },
      approachTimeLeft: { label: 'Restzeit, yo', hint: 'Die Restzeit des laufenden Termins in der Karte; aus, steht sie am Termin selbst, Digga' },
      minEventLength: { label: 'Mindestlänge für Termine', hint: 'Kurze Termine werden mindestens so lang gezeichnet. Lesbar bleiben, Digga.', off: 'Aus', minutes: '{n} Min.' },
      sideBySide: { day: 'Tagesansicht: Termine nebeneinander, yo', week: 'Wochenansicht: Termine nebeneinander, yo', hint: 'So viele Termine passen nebeneinander. Der Rest stapelt sich, Digga.', upTo: 'Bis zu {n}' },
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
      carriedFrom: { label: 'Zeigen, woher verschobene Listen kommen, yo', hint: 'Das „Vom Sa., 10. Okt.“-Etikett an offenen Listen von früher. Aus: Die stehen einfach bei heute, Digga.' },
      undatedDone: { label: 'Erledigte Liste ohne Datum, yo', calendar: 'Am Tag der Erledigung zeigen', archive: 'Nur im Archiv, Digga' },
      taskOpen: { label: 'Tippen auf ne Aufgabenliste, yo', inline: 'Wächst an Ort und Stelle', drawer: 'Macht die Liste auf, Digga' },
      categories: 'Kategorien, yo',
      taskCategories: { label: 'Kategorien für Aufgabenlisten, yo', hint: 'Aufgabenlisten nach Kategorie gruppieren, sortieren, filtern und einfärben. Ausschalten blendet nur aus, nix wird gelöscht, Digga.' },
      addCategory: 'Kategorie am Start, yo',
      editCategory: '{name} pimpen',
      moveUp: '{name} nach oben, yo',
      moveDown: '{name} nach unten, yo',
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
    labs: {
      views: { title: 'Welche Experimente sollen mit, yo' },
      experimental: { label: 'Experimentelle Ansichten, yo', hint: 'Uhr, Zeitstrahl und Streifen in der Ansichtswahl. Fresh D. hat das gecheckt, seit Billionen Jahren.' },
      growCards: { label: 'Aufklappende Aufgabenlisten-Karten, yo', hint: 'Tipp auf eine Aufgabenliste im Kalender klappt die Karte direkt auf; aus: macht die Liste auf, Digga' },
      weekTwoRow: { label: 'Wochenübersicht in zwei Zeilen, yo', hint: 'Die Woche in zwei Zeilen, damit alle sieben Tage ohne Scrollen auf den Screen passen, Digga', split: 'Tage in der oberen Zeile, yo' },
    },
    account: {
      signedIn: 'Mit Google am Start. Post für mich, Post für mich!',
      signOut: 'Schönen Day noch!',
      signOutAll: { label: 'Überall Schönen Day noch, yo', hint: 'Beendet die Anmeldung auf allen Geräten, auch auf diesem', button: 'Überall abmelden, yo' },
      calendarAccess: { label: 'Kalenderzugriff', hint: 'Google Kalender ist nicht erlaubt, Schinken! Erlaub ihn und setz auf Googles Bildschirm den Haken beim Kalender.', grant: 'Kalender erlauben, yo' },
      resetDemo: { label: 'Demodaten resetten, yo', hint: 'Ersetzt den Testkalender durch frische Demotermine. Kind auf die Türmatte, klingeln, wegrennen.', button: 'Hokus Pokus', done: 'Back from the Underground: Der Phönix ersteht aus seiner Asche, Demodaten sind da. Yo, vielen lieben thank und schönen day noch!', failed: 'Ich bin alt, ich bin bald tot, aus Grün wird Rot: Demodaten nicht resettet' },
      version: 'Version {version}, yo',
      appCert: { label: 'Signaturzertifikat der App (SHA-256), yo', hint: 'Die hier angebotene Android-App ist mit diesem Zertifikat signiert. Vergleich es, bevor du ein Update installierst.' },
      whatsNew: { label: 'Was geht ab, yo', hint: 'Die frischen Änderungen an der App', button: 'Zeig mal' },
      androidApp: { label: 'Android-App, fresh', updateLabel: 'App-Update, yo', hint: 'Fresh D. auf dein Handy, mit Wochen-Widget. Läuft überall, Digga', download: 'Runterladen, yo' },
      installApp: { label: 'App installieren, yo', hint: 'Fresh D. auf deinen Home-Bildschirm, Digga', button: 'Zeig mal', title: 'Fresh D. installieren', step1: 'Tipp auf den Teilen-Button, yo', step2: 'Wähl „Zum Home-Bildschirm“', step3: 'Tipp auf Hinzufügen, BÄMbus!', close: 'Alles klar, Digga' },
      versionCorner: { label: 'Version in der Ecke zeigen, yo', hint: 'Ein kleines Label unten links. Ey, wenn hier einer unnötige Anglismen verwendet, dann bin das immer noch ich.' },
    },
    leftHanded: { label: 'Linkshänder-Modus, yo', hint: 'Spiegelt das Handy-Layout, damit die wichtigen Knöpfe unter dem linken Daumen liegen. Fresh D. ist Linkshänder, Digga.' },
    navPosition: { label: 'Ansichtswechsel, yo', hint: 'Wo Jahr, Monat, Woche und Tag chillen, Digga', phone: 'Auf dem Handy', desktop: 'Auf Desktop und Tablet', bottom: 'Unten', top: 'Oben', rail: 'Seitenleiste', drawer: 'Seitenmenü, fresh' },
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
