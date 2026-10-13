# iOS without a Mac and without much money

Research date 2026-10-13 (first pass; to be deepened). Question (owner): is there really no way to ship a native iOS
app, or at least an iOS home-screen widget, without owning an Apple device for development and without paying a lot?

## Short answer

- **Notifications on iPhone**: yes, free, no native app: an installed PWA gets Web Push (iOS 16.4+). Needs HTTPS (the
  planned domain). [I1]
- **A home-screen widget**: yes, free, no Mac: the free **Scriptable** app runs a JavaScript widget that can call the
  calendar API and draw the week like the Android widget (DrawContext). Refresh timing is up to iOS. [I2][I3]
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

## Recommendation (first pass)

1. Once HTTPS is live: the PWA on iPhone for the app itself and Web Push for reminders.
2. For the widget now: a Scriptable script (we write it; the phone owner pastes it once). Needs a way to authenticate
   without the WebView cookie (a per-device token) when sign-in is on; with `PROVIDER=mock` no auth is needed.
3. A native iOS app only if the 99 USD/year is accepted; without it the weekly re-sign makes it fragile.

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
