# Credits (#69)

## As Is
Settings > Account & app > "App" section (`web/src/views/settings/AccountGroup.vue`) shows install, what's new, error log, version. No attribution anywhere.

## To Be
A "Credits" row in that App section, below the version, opens an AdaptiveSheet with the list (name, author, licence, link). List is generated at build time and lazy-loaded (first-load JS budget unchanged).

## Requirements
1. Generated list of what ships in the web bundle: `rollup-plugin-license` 3.7.1 in vite.config. Spiked: works with Vite 8 (Rolldown), emitted 'vue-router', 'dompurify', '@vue/*' ... with name/version/license/author/repository, only modules actually bundled.
2. Extra credits file (`web/src/credits/extra.ts`): one entry per asset npm does not describe (Material Symbols via iconify info.json, scene art, later Solar Bold Duotone CC BY 4.0 for #66). Merge de-duplicates by name, sorts by name.
3. Credits row + sheet with data-testid, i18n in all locales, offline (bundled JSON chunk, precached).
4. Android shell native deps: added only if Gradle metadata is reasonably available, else documented as not covered.
Acceptance: scenarios in spec/features/app/credits.feature; unit tests for merge; bundle budget numbers.

## Assumptions / open questions
- Plugin choice: rollup-plugin-license is the maintained (MIT, release 2026-04) standard; it reads the bundle graph, so it lists what really ships rather than package.json. 3.7.2 is <1 day old and blocked by the repo's release-age policy, so 3.7.1.
- Fonts: no bundled font files found (CSS stack only), so none credited.
- Own scene art / logos: credited as one "this app" entry? Open question.
- Licence texts: link + SPDX id only, not full texts? Open question.
