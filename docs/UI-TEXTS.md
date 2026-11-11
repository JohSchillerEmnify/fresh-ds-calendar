# Contract for user-facing texts

Everyone who writes UI strings follows this: labels, hints, setup guides, errors, toasts, dialogs, in all locales,
and in mockups too. The reader is a person using the app, not a developer.

## Rules

1. **Plain user language.** Say what the person sees and gets. — The app is for users, not for people who read code.
2. **A hint says what changes for the user, as short as possible,** and exists only when it adds something the label
   does not say. More than one sentence is fine when needed. No hint beats a weak hint.
3. **Never narrate what the UI already shows.** No "the button turns into Copied", "the page opens", "a small label
   in the corner". — The person sees it happen.
4. **No implementation, version or history words:** Labs, prefs, server, key, script, ids, "the ring version", "the
   old view". — They mean nothing to the reader and read like code comments.
5. **No hint that repeats its label.** "Show version in the corner" needs no "Shows the version".
6. **Setup guides: one action per step.** A hint appears only for what the person could not otherwise know.
7. **Error texts: one plain sentence on what to do next.** Supportive, never blaming, no status codes or internals
   ("it was rejected", not "the server refused it").
8. **Supportive wording for tasks.** An overdue task is not "missed"; errors may say plainly what went wrong ("failed" is fine) and should say what helps.
9. **Precise terms.** *Host name*, *URL*, *domain*: never "address" (that is an IP address). *Virtual calendar* exists
   only in the app; *Google calendar* exists in Google; say whether a setting is stored in the app or sent to
   Google. Never "own calendar".
10. **People:** "a user", "the other user". No gendered pronouns, no relationships.
11. **Typography:** real quotes “…” in English and „…“ in German, the ellipsis …, › in menu paths
    (Settings › Calendar), no straight quotes or three dots.
12. **German reads like a native wrote it:** the imperative and du-form the app already uses, passive status texts
    ("Wird gespeichert", "Wird synchronisiert"), correct case and pronouns, no calques from English. Translate the situation, not the words: describe what the user actually
    meets (Google asks for permissions when you sign in), never a literal "Googles Bildschirm".
13. **Fun locales keep their voice;** only grammar and the rules above are fixed, never the humour.
14. **Every string goes through i18n in all locales;** a changed meaning changes every locale.

## Glossary

One word per concept. Check the locale files before adding a new term. The table is generated from
`docs/ui-texts.json` (`pnpm ui-texts --write-doc`); change the words there.

<!-- glossary:begin (generated from docs/ui-texts.json: pnpm ui-texts --write-doc) -->
| English | German | Never use |
|---|---|---|
| Design | Design | Theme, Themes |
| home screen | Home-Bildschirm | Homescreen |
| start | Beginn | - |
| virtual calendar | virtueller Kalender | own calendar |
| Google calendar | Google-Kalender | - |
| task lists calendar | Kalender der Aufgabenlisten | tasks calendar |
| demo calendar | Demokalender | mock calendar, test calendar, Testkalender |
| bedtime mode | Schlafenszeit-Modus | Bedtime-Modus |
| host name | Host-Name | server address, web address, Serveradresse, Webadresse |
| went wrong | schiefgegangen | - |
| left-handed mode | Linkshänder-Modus | - |
<!-- glossary:end -->

## Localisation

| Rule | Gate |
|---|---|
| Every UI string goes through i18n and exists in `en` and `de`; the fun locales may fall back to `de` unless their type requires the key | `pnpm i18n:scan` (hard-coded strings), `pnpm i18n:check` and tsc (missing keys) |
| No German string equals its English one unless it is a loanword or name, listed in `allow` with a reason | `texts` gate, rule `same-as-en` |
| Dates, times, weekdays, months and numbers come from Intl with the app locale, never from hand-made tables; German times are 24-hour | `texts` gate, rule `hand-made-dates` (web and the Android widget); 24-hour: review only |
| Placeholders (`{date}`, `{n}`) instead of concatenated strings; plurals use the i18n library's plural forms | review only |
| The app language comes from the person's language setting (`auto` = device) and every surface follows it: web, Android widget, iPhone widget | review only |
| Texts made by the server (such as the Birthdays calendar name) are translated by the client, never written by the server | review only |
| German style: du-form, glossary terms, natural phrasing | glossary and `formal-sie` in the `texts` gate; naturalness: review only |

## Before and after

| Before | After | Rule |
|---|---|---|
| “A small label in a bottom corner” (hint of “Show version in the corner”) | no hint | 3, 5 |
| “The latest changes to the app” (hint of “What's new”) | no hint | 5 |
| “Replaces the mock calendar with fresh demo events” | “Replaces the demo calendar with fresh demo events” | 9 |
| “This replaces your settings, themes and canvas on this server with the newest backup.” | “This replaces your settings, themes and canvas with the newest backup.” | 4 |
| “Track reaches ahead” | “How far ahead the track shows” | 1 |
| “The ‘From Sat 10 Oct’ label on open lists moved to today. Off: they simply show up today.” | “Open lists moved on to today get a label like ‘From Sat 10 Oct’. When off, they just show up today.” | 2 |
| “Overlapping events share the width up to this many columns; more lie on top of the last one” | “How many overlapping events sit side by side. Any more are stacked on the last one.” | 1 |
| “The change was not saved because the server refused it.” | “The change was not saved because it was rejected.” | 4, 7 |
| „Das ersetzt deine Settings, Themes und Tafel“ | „Das ersetzt deine Einstellungen, Designs und Tafel“ | 12, glossary |
| „Der Boss löscht die Liste oder hört auf zu teilen“ | „Als Besitzer kannst du die Liste löschen oder mit dem Teilen aufhören“ | 12 |
| “Time left: the time left of the running entry in the Approaching card; off, it shows on the entry itself” | “Shows how much time the current event has left in the Approaching card. When off, it shows on the event itself.” | 2 |

## Review checklist

- [ ] Read the German and the English text aloud: does each sound like a native speaker wrote it?
- [ ] Does each hint add something the label and the screen do not already say, as briefly as possible?
- [ ] Would a person who never saw the code understand every word (no Labs, prefs, server, key, ring version)?
- [ ] Are the precise terms right (host name or URL not “address”; virtual vs Google calendar; app vs Google)?
- [ ] Do errors say what to do next, and do tasks avoid “missed”?
- [ ] Do all locales carry the change, with the glossary words, real quotes and natural German?

## How it is enforced

`pnpm quality` runs the `texts` gate (`pnpm ui-texts` lists the findings: file, key, rule, text). It reads
`docs/ui-texts.json` and checks every string of the `en` and `de` catalogues for: glossary “never use” words,
German strings identical to the English ones, hand-made weekday or month tables, implementation words, straight quotes, three dots and `>` in paths, a hint that repeats its label, a hint over
200 characters, formal “Sie” in German, and “missed” wording. The fun locales get the
typography rules only. It is a ratchet like the other gates: `quality-baseline.json` holds today's findings and any new
one fails; fix some and run `pnpm quality:ratchet`. An exception goes into `allow` in `docs/ui-texts.json` with a
one-line reason (this is where loanwords and names that are the same in German, such as OK or Filter, are
listed; an unknown key or a missing reason fails). `pnpm ui-texts` only lists findings; the gate in `pnpm quality`
enforces them. A test keeps the glossary table above in step with the JSON. A machine cannot judge whether a hint
says what changes for the user: that stays the reviewer's job.
