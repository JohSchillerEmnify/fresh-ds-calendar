# iOS without a Mac and without much money

Research date 2026-10-13, deepened 2026-10-14 (tool issue trackers, Apple docs). Question (owner): is there really no way to ship a native iOS
app, or at least an iOS home-screen widget, without owning an Apple device for development and without paying a lot?

## What came of it

- **Built:** the Scriptable widget, with a per-device widget key created in Settings (ADR 0044, issue #95; script in
  `ios/widget/`, scenarios in `spec/features/app/iphone-widget.feature`). Small, medium and large sizes and the lock
  screen are covered; a configurable number of days is issue #108.
- **Built:** Web Push reminders for the installed web app (`server/src/services/push.ts`), on the public HTTPS domain.
- **Not built:** a native iOS app. The reasoning below still holds.

The research below is from October 2026 and is kept as the reasoning behind these choices.

## Short answer

- **Notifications on iPhone**: yes, free, no native app: an installed PWA gets Web Push (iOS 16.4+). Needs HTTPS (the
  planned domain). [I1]
- **A home-screen widget**: yes, free, no Mac: the free **Scriptable** app runs a JavaScript widget that can call the
  calendar API and draw the week like the Android widget (DrawContext). Refresh timing is up to iOS. [I2][I3] (Built, see above.)
- **A real native app**: possible without a Mac (cloud macOS builds or `xtool` on Linux) and without paying, but a free
  Apple ID signs for **7 days, max 3 apps per device**, so it must be re-signed weekly (SideStore on the phone after a
  one-time PC setup, or AltServer/Sideloadly on the Windows PC). Widgets need an App Group to share data with the app;
  a free team officially has none. [I4]–[I8]
- **$99/year** (Apple Developer Program, no waiver for individuals) removes the 7-day and 3-app limits, adds App
  Groups, TestFlight and a 1-year signature. [I9]

## Options

| Option | Cost | Needs | Widget | Notifications | Upkeep |
|---|---|---|---|---|---|
| PWA from Safari (Add to Home Screen) | 0 | HTTPS | no | Web Push (16.4+) | none |
| Scriptable widget script | 0 | Scriptable app, API reachable (LAN or HTTPS), auth header/token | yes (drawn) | no | none |
| Capacitor app, built on cloud macOS (Codemagic 500 free M2 min/month; GitHub Actions ~200 macOS min/month on a private repo) or `xtool` on Linux, installed with a free Apple ID | 0 | Apple ID, Windows PC once (SideStore) or always (AltStore/Sideloadly) | maybe (no App Group on free teams; widget could fetch on its own) | local notifications yes; APNs push no | re-sign every 7 days |
| Same, with the paid program | 99 USD/yr | as above | yes | yes | yearly |
| EU alternative marketplaces / Web Distribution | paid program + notarisation | – | – | – | not realistic |

## Details that decide it (as of October 2026)

- **Sideloading with a free Apple ID is fragile right now.** SideStore's issue tracker shows refresh and pairing-file
  failures through iOS 26.x in 2026 (stable builds broken for new pairing files in August, connections going stale after
  a few days, workarounds by re-pairing with iLoader or nightly builds). [I10] AltStore needs AltServer on the PC on the
  same Wi-Fi every 7 days; Sideloadly has no automatic refresh. A reminder app that silently stops launching after a
  failed refresh is the worst case for an ADHD tool.
- **xtool cannot ship a widget yet.** Widget extensions build to an empty binary, and with the workaround they crash on
  launch (issue #313, open since 2026-10-10). Free-team App Groups (needed for app and widget to share data) are an
  unmerged pull request (#284, changes requested 2026-10-04). [I11]
- **WidgetKit refreshes 40–70 times a day** for a widget the person looks at often (about every 15–60 minutes, decided
  by iOS), so an iOS widget, native or Scriptable, can never tick like a clock; it shows a snapshot. [I12]
- **Web Push on iOS got simpler.** Since iOS 18.4, Home Screen web apps can use *Declarative Web Push*: the server sends
  the notification content and no service worker has to run, which is more reliable than classic Web Push. [I13] The
  installed PWA also gets the Badging API (16.4+), though badge counts are a guilt risk (ADHD-RESEARCH 1.21).
- **Scriptable**: `Request` has `headers` (a per-device token can go in a header) and `allowInsecureRequest` for invalid
  certificates; whether plain `http://` to the LAN is allowed is not documented, so HTTPS on the real domain is the safe
  assumption. Widgets can draw freely with `DrawContext`, like the Android bitmap widget. [I3][I14]

## Recommendation

1. **HTTPS first** (done: the app runs on its own domain with HTTPS): it unlocks the PWA install on iPhone, Declarative Web Push for
   the bedtime and transition reminders, and a safe target for a widget script.
2. **Widget: a Scriptable script** (done, ADR 0044), written by us, pasted once into the free Scriptable app: today's clock or the
   week, drawn like the Android widgets, authenticated with a per-device token (a small server addition, revocable in
   Settings). No Mac, no money, no weekly re-signing.
3. **A native iOS app only with the 99 USD/year program.** Without it, the 7-day signature, the 3-app limit and the
   current SideStore breakage make it unreliable, and xtool cannot build widgets yet. Revisit if xtool #313/#284 land
   and the owner wants a native shell anyway.

## Sources

- [I1] Web Push for Home Screen web apps, iOS 16.4: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide ; EU reversal: https://www.theregister.com/2024/02/16/apple_web_apps/
- [I2] Scriptable (App Store): https://apps.apple.com/us/app/-/id1405459188 ; docs: https://docs.scriptable.app/
- [I3] Scriptable Request (headers, `allowInsecureRequest`): https://docs.scriptable.app/request/ ; ListWidget refresh: https://docs.scriptable.app/listwidget/
- [I4] xtool, build/sign/install iOS apps from Linux/WSL: https://github.com/xtool-org/xtool ; extensions docs: https://docsearch.algolia.com/mcp/docs/repo/xtool-org/xtool ; free-team app group PR: https://github.com/xtool-org/xtool/pull/284
- [I5] Free Apple ID limits (7 days, 3 apps, App ID quota): https://mybyways.com/blog/new-limitations-imposed-on-free-apple-developer-account ; https://zudo-tauri-wisdom.takazudomodular.com/docs/mobile/ios-signing-free-team/
- [I6] SideStore / AltStore / Sideloadly comparison: https://builds.io/blog/technologies/ios-technologies/sideloadly-vs-altstore-vs-sidestore/
- [I7] Codemagic free tier: https://agentdeals.dev/vendor/codemagic
- [I8] GitHub Actions macOS minute multiplier: https://dev.to/maclessdev/github-actions-free-macos-minutes-explained-33p7 ; https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- [I9] Fee waivers (organisations only): https://developer.apple.com/support/fee-waiver ; https://flaviocopes.com/apple-developer-free-vs-paid/
- [I10] SideStore issues (2026): https://github.com/SideStore/SideStore/issues/1401 ; https://github.com/SideStore/SideStore/issues/1351 ; https://github.com/SideStore/SideStore/issues/1611
- [I11] xtool widget extension crash: https://github.com/xtool-org/xtool/issues/313 ; free-team app groups PR: https://github.com/xtool-org/xtool/pull/284
- [I12] Apple, Keeping a widget up to date (40–70 refreshes per day): https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date
- [I13] WebKit, Meet Declarative Web Push: https://webkit.org/?p=16535 ; WebKit features in Safari 18.4: https://webkit.org/blog/16574/digital-credentials-api/
- [I14] Scriptable DrawContext examples: https://talk.automators.fm/t/widget-examples/7994?page=26
