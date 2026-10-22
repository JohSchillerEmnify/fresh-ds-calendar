# Stack research (2026-10-12)

Scope: runtime and package manager, backend framework and Google client, Material 3 UI and calendar component, PWA,
and automated leak and performance testing. Owner priorities: low server RAM/CPU, small image and bundle, phone
battery and RAM, no memory leaks, current Android look (Material 3 Expressive), installable on iOS and Android.

Versions come from the npm registry, Docker Hub and nodejs.org on 2026-10-12. Numbers marked **measured** were
measured on the home server (4 cores, Linux 5.15) with the exact versions given. Treat them as relative, not absolute.

---

## 0. Version snapshot (npm `latest`, 2026-10-12)

| Area | Package | Latest | Notes |
|---|---|---|---|
| Runtime | Node.js | 24.21.0 (LTS "Krypton"), 26.11.1 (Current), 22.23.3 (LTS "Jod") | Node 24 enters maintenance 2026-10-20 and reaches EOL 2028-04-30. Node 26 becomes LTS on 2026-10-28. [schedule](https://github.com/nodejs/Release/blob/main/schedule.json) |
| Runtime | bun | 1.4.3 | 1.4 shipped 2026-08-20 and rewrote the runtime from Zig to Rust. [blog](https://bun.com/blog/bun-v1.4) |
| PM | pnpm | 12.11.2 | 12.0 shipped 2026-08-26 |
| Build | vite | 8.3.4 | Rolldown-based. **engines `^20.19 \|\| >=22.12`** |
| Test | vitest | 5.0.3 | **engines `^22.12 \|\| ^24 \|\| >=26`** |
| Test | jsdom | 30.1.2 | **engines `^22.22.2 \|\| ^24.15 \|\| >=26`** |
| E2E | @playwright/test | 1.64.0 | Chromium 156, Firefox 157, WebKit 27.2 |
| E2E | playwright-bdd | 9.2.1 | peer `@playwright/test >=1.44` |
| Lang | typescript | 7.0.2 (Go) / 6.0.3 | TS 7 has no stable JS API yet, so vue-tsc/Volar cannot use it. Stay on **6.0.x**. [VS Magazine](https://visualstudiomagazine.com/articles/2026/07/08/typescript-7-arrives-to-rock-vs-code-with-go-powered-speed.aspx), [ecorpit](https://ecorpit.com/typescript-7-migration-readiness-eslint-astro-blockers-2026/) |
| Vue | vue / vue-router / pinia | 3.5.43 / 5.4.0 / 4.0.3 | vue-router 5 peer `vite ^7 \|\| ^8` |
| Server | fastify / hono / @hono/node-server | 5.12.5 / 4.13.13 / 2.1.4 | |
| Google | googleapis / @googleapis/calendar / @googleapis/tasks / google-auth-library | 185.0.0 / 20.1.0 / 17.0.1 / 11.2.0 | All need `node >=22` |
| PWA | vite-plugin-pwa | 2.0.0 (2026-10-03) | workbox 7.4.1, peer vite 3 to 8 |

**Key finding:** the scaffold runs on Node **22.11.0**, which is below the minimum for Vite 8, Vitest 5 and jsdom 30.
It is also why the `light-my-request` override exists, because `require(esm)` needs Node 22.12 or later. So upgrading
Node is required, not optional.

---

## 1. Runtime and package manager

### Measured: idle RSS of a tiny JSON server

Each server answers `GET /` with `{"ok":true}`. Load was autocannon with 20 connections for 5 s (about 100k
requests). Idle RSS was taken 2 s after start. Peak RSS was sampled during the load.

| Runtime | Server | Idle RSS | Peak under load | 10 s after load |
|---|---|---|---|---|
| Node 22.11 | node:http | 51 MB | — | — |
| Node 22.11 | Fastify 5.12.5 | 68 MB | — | — |
| Node 22.11 | Hono 4.13.13 + @hono/node-server | 59 MB | — | — |
| Node 24.21 | node:http | 57 MB | 76 MB | 76 MB |
| Node 24.21 | Fastify | 72 MB | 92 MB | 93 MB |
| Node 24.21 | Hono (node-server) | 67 MB | 85 MB | 85 MB |
| Node 24.21 | Fastify, `--max-old-space-size=64 --max-semi-space-size=1` | 68 MB | 86 MB | — |
| Bun 1.4.3 | node:http | 23 MB | — | — |
| Bun 1.4.3 | Fastify | 44 MB | 76 MB | 57 MB |
| Bun 1.4.3 | Hono on `Bun.serve` | **21 MB** | **41 MB** | 32 MB |

### Measured: cost of the Google client (idle RSS after `import`)

| Library imported | Node 24 + Fastify | Bun + Hono | Size on disk |
|---|---|---|---|
| none | 72 MB | 21 MB | — |
| `googleapis@185` (all APIs) | **181 MB** | 126 MB | **241 MB** |
| `@googleapis/calendar@20.1` | 78 MB | 40 MB | 1.2 MB (calendar + tasks) |
| `google-auth-library@11.2` only | 76 MB | 35 MB | 0.8 MB |

The Google client choice affects memory more than the runtime choice does: `googleapis` adds about 110 MB RSS and
241 MB of image size.

### Docker base images (compressed, linux/amd64, Docker Hub 2026-10-12)

| Image | Size |
|---|---|
| `node:24-alpine` (24.21.0, alpine 3.24) | 61.6 MB |
| `node:22-alpine` | 60.7 MB |
| `oven/bun:1.4.3-alpine` | 47.4 MB |
| `oven/bun:1.4.3-distroless` | 48.9 MB |
| `gcr.io/distroless/nodejs24-debian13` | exists; not measured. It has no shell, which makes debugging on a home server harder. |

### Compatibility and maturity

| Concern | Node 24 + pnpm | Bun 1.4 |
|---|---|---|
| googleapis / google-auth-library | Officially supported ("active and maintenance Node versions"). [googleapis-common](https://classic.yarnpkg.com/en/package/googleapis-common) | Not officially supported. No Bun-specific reports were found. The library uses gaxios, `node:crypto` and `node:http`. Bun's crypto passes 123/135 and webcrypto 39/50 Node tests ([Bun 1.4](https://bun.com/blog/bun-v1.4)). It probably works, but this is not verified. |
| Vite 8, Vitest 5, Playwright 1.64 | First-class | Vite runs. Vitest and Playwright run their workers on Node anyway. `bun test` is not Vitest: weaker module mocking and experimental coverage ([pkgpulse](https://www.pkgpulse.com/guides/bun-test-vs-vitest-vs-jest-2026)). |
| Leak tooling | V8 heap snapshots, `--expose-gc`, `--heapsnapshot-signal`, Chrome DevTools, memlab (V8 snapshots) | JavaScriptCore heap snapshots in a different format. memlab and DevTools workflows do not apply. |
| Maturity | Node 24 LTS until 2028-04 | 1.4 is a 2-month-old Rust rewrite. Bun says it "is not 100% compatible with Node.js yet". node:test passes 28/81. |

Bun's 1.4 release notes claim up to 35% less memory and 5x less idle CPU ([Bun 1.4](https://bun.com/blog/bun-v1.4)).
Third-party blogs report idle Bun at about 32 MB versus 52 MB for Node 22 ([tech-insider](https://tech-insider.org/bun-vs-node-2026/), [kunalganglani](https://www.kunalganglani.com/blog/bun-vs-node-performance-2026)).
These claims match the measurements above.

### Package manager

| Option | Pros | Cons |
|---|---|---|
| npm (workspaces) | Already in place | Slowest. Flat hoisting hides missing dependencies. No `deploy` for a slim production `node_modules`. |
| **pnpm 12** | Strict isolated `node_modules` catch phantom dependencies. Content-addressed store. `pnpm deploy --prod --filter server` builds a minimal production folder for Docker. `pnpm-workspace.yaml` with a `catalog:` keeps versions in one place. | One more tool. Corepack is no longer bundled from Node 25, so install it with `npm i -g pnpm@12` or a standalone binary. |
| Bun as PM only (Node runtime) | Very fast installs. Text `bun.lock`. | The Bun binary is needed in CI, Docker build and dev. It does not reduce runtime RAM, so it gives no gain on the owner's actual priorities. Installs are not a bottleneck for a 2-workspace repo. |

**Recommendation (1):** use **Node 24 LTS (24.21.0) + pnpm 12**. Move to Node 26 after it becomes LTS on 2026-10-28;
that is a one-line change in `.nvmrc` and the Dockerfile. Bun saves about 40 to 50 MB RSS, which is about 0.6% of the
server's RAM. That does not outweigh unverified Google library support, a 2-month-old rewrite, and losing the V8 leak
tooling the owner needs. Bun as package manager only is **not** worth it.

Keep the Bun option open by writing the server on web-standard `Request`/`Response` (Hono, below). A later switch is
then a change to the entrypoint only, and can be measured with the soak test in §5.

Cap memory so a leak restarts the container instead of eating the host: set `mem_limit: 192m` in compose and
`NODE_OPTIONS=--max-old-space-size=96`.

---

## 2. Backend framework and Google client

| | Fastify 5.12 | **Hono 4.13** | Plain `node:http` |
|---|---|---|---|
| Idle / peak RSS on Node 24 (measured) | 72 / 92 MB | 67 / 85 MB | 57 / 76 MB |
| Dependencies | 15 direct (pino, avvio, ajv, …) | 0 (+ `@hono/node-server`, 0 deps) | 0 |
| Testing without a socket | `app.inject()` via light-my-request (currently pinned to 6.6.0 by an override) | `await app.request('/api/x', init)` returns a standard `Response` | Hand-rolled |
| Bun portability | Runs, but slower and larger than on Node (44 MB idle) | Native (`Bun.serve({ fetch: app.fetch })`, 21 MB) | `node:http` shim |
| Static files + SPA fallback | `@fastify/static` 10.1 | `serveStatic` from `@hono/node-server/serve-static` (or `hono/bun`) | Hand-rolled |
| Validation | JSON-schema / ajv built in | `@hono/standard-validator` with zod/valibot, or hand checks | Hand-rolled |
| Throughput (irrelevant at this scale) | about 88k req/s | about 82k req/s ([fastify.dev/benchmarks](https://www.fastify.dev/benchmarks/), Aug 2026) | — |

**Recommendation (2a):** use **Hono 4.13 + @hono/node-server 2.1**. It saves 5 to 10 MB, drops about 15 transitive
packages and the `light-my-request` override hack, and its `app.request()` is as convenient as `inject()`. It is the
only option that is portable to Bun unchanged. The scaffold has only `app.ts`, `config.ts`, `index.ts` and `routes/`,
so switching now is cheap. Plain `node:http` saves 10 MB more but means hand-writing routing, errors and static
serving, which adds leak and bug risk.

Keep `buildApp(config, provider)` returning the Hono app and test with `app.request`. The contracts in spec/API.md
do not change.

**Recommendation (2b), Google client:** do **not** use `googleapis`. It adds about 110 MB RSS and 241 MB on disk
(measured).

- Use `@googleapis/calendar@20.1.0` (+ `@googleapis/tasks@17.0.1` if Tasks is added) for the typed `calendar_v3` client.
  It costs only about 6 MB RSS over a bare server.
- Use `google-auth-library@11.2.0` `OAuth2Client` with a refresh token. It is already pulled in by `googleapis-common`.
- Plain `fetch` + `google-auth-library` would save a further 1 to 2 MB but loses the types. It is not worth it.
- Unit-test `GoogleProvider` by mocking HTTP at the gaxios/fetch layer, as the BRIEF already says.

---

## 3. UI: Material 3 on Vue, and the calendar component

### What "current Android design language" means in 2026

The current language is **Material 3 Expressive**, an evolution of M3 rather than "M4". It was announced at I/O 2025
and is shipped in Android 16 and later. It brings spring-based motion (spatial and effects springs), 35 morphable
shapes, emphasized type, and new components: button groups, split buttons, FAB menu, loading indicator and toolbars.
([Android Developers Blog](https://android-developers.googleblog.com/2025/05/androidify-building-delightful-ui-with-compose.html), [9to5google](https://9to5google.com/?p=671907))

There is **no official Google M3 Expressive library for the web or Vue**. Only Compose and Flutter have one.

### Measured: bundle cost of a typical mobile component set

The set: app bar, bottom navigation, button, FAB, dialog/bottom sheet, text field, checkbox, list, chip and menu.
Built with Vite 8.3.4 and minified. Sizes are gzip -9. "Base" is Vue 3.5.43 alone at 23.0 KB JS.

| Option | Version | JS gz | CSS gz | Overhead over Vue | Look | Status |
|---|---|---|---|---|---|---|
| Hand-rolled + M3 tokens | — | about 5 to 15 (estimate) | about 5 to 10 | **about 10 to 25 KB** | Exactly M3 Expressive (you implement it) | — |
| `@material/material-color-utilities` (runtime `themeFromSourceColor` + `applyTheme`) | 0.4.0 | 19.6 | — | about 20 KB if shipped at runtime, **0** if tokens are generated at build time | Includes `SchemeExpressive`, `SchemeTonalSpot` and others | Active (Jan 2026) |
| `@material/web` (Lit web components) | 2.5.0 (2026-07-15) | 67.0 | in JS | 44 KB | Real M3. 2.5 adds **Labs** "expressive" button, FAB, list, menu and split button | README still says "maintenance mode pending new maintainers" ([repo](https://github.com/material-components/material-web), [#5642](https://github.com/material-components/material-web/discussions/5642)). Releases continue but are rare. No nav bar outside Labs. Shadow DOM limits styling. |
| Vuetify (md3 blueprint, `vite-plugin-vuetify` autoImport) | 4.2.4 | 93.8 | 41.4 | **112 KB** | M3 baseline (typography, elevation 0 to 5, shapes). Not Expressive. | Very active. v4.0 shipped 2026-02-23 with MD3 typography and elevation ([Vuetify blog](https://store.vuetifyjs.com/blogs/vuetify-blog/vuetify-in-january-2026-661-commits-v4-beta-and-the-road-to-v5)) |
| Quasar | 2.35.0 | 77.3 | 35.3 | 90 KB | MD2-ish by default | Active |
| PrimeVue (Material preset, styled mode) | 5.0.2 | 111.6 | runtime CSS-in-JS | 89 KB + runtime style injection | M3-like preset | Active |

Hand-rolled is the clear winner on look per KB. A month view, a week view, task chips and a few sheets and dialogs do
not need a widget library. Native `<dialog>`, the Popover API, `<input>` and CSS do most of the work.

### Recommended UI approach

1. **Token layer:** a build-time script uses `@material/material-color-utilities@0.4.0` (dev dependency) to generate
   `tokens.css`. It holds `--md-sys-color-*` for light and dark (`SchemeTonalSpot` or `SchemeExpressive` from one seed),
   plus hand-written `--md-sys-typescale-*`, `--md-sys-shape-corner-*`, `--md-sys-elevation-*` and motion tokens.
   Approximate M3 springs with CSS `linear()` easing; it is baseline in all evergreen browsers.
2. **Dynamic color at runtime** (user picks a seed color) is optional. Load it as a lazy chunk (`import()`), so it
   costs nothing until it is used.
3. **Components:** hand-written SFCs: `MButton`, `MFab`, `MIconButton`, `MTextField`, `MCheckbox`, `MChip`,
   `MBottomSheet` (on `<dialog>`), `MNavigationBar` and `MTopAppBar`. Add ripples and state layers with
   `:active` / `::after` CSS, not JS.
4. **Icons:** use `unplugin-icons@24` + `@iconify-json/material-symbols@1.2.95`. Only used icons are compiled to inline
   SVG. Do not use an icon font: it is a large download and causes a flash of unstyled text.
5. **Fonts:** use the system stack (`Roboto` on Android, `-apple-system` on iOS). This is 0 KB and matches each OS.
6. **Fallback:** if hand-rolling stalls, Vuetify 4 + md3 blueprint is the best maintained Vue option. Expect about
   110 KB gz overhead.

### Calendar component

Measured with Vite 8, gzip. Overhead is over the 23 KB Vue baseline.

| Option | Version | JS gz | CSS gz | Overhead | Monday start | Custom task-list chips in cells | Notes |
|---|---|---|---|---|---|---|---|
| **Custom (date-fns 4.4)** | — | about 8 to 15 (estimate, date-fns tree-shaken) | about 3 | **about 10 to 18 KB** | trivial | full control | Matches the spec exactly (expandable chips, `data-testid`s) |
| vue-cal | 4.10.2 (v5 still RC since 2025-02) | 57.7 | 4.2 | 39 KB | `startWeekOnSunday: false` | via slots; inline expansion is awkward | Slow-moving |
| Schedule-X | 4.9.1 + @schedule-x/vue 4.1.0 | 90.3 | 5.5 | 72 KB | `firstDayOfWeek: 1` | custom components via adapters | Preact + Signals + temporal-polyfill inside. MIT core, some premium plugins ([GitHub](https://github.com/argshook/schedule-x)) |
| FullCalendar | 7.1.1 (v7 ~June 2026) | 124.2 | 3.6 | 104 KB | `firstDay: 1` | slots work | Heaviest. Needs temporal-polyfill. New theme system ([blog](https://fullcalendar.io/blog)) |

**Recommendation (3):** **build the calendar views yourself** with date-fns. Month and day cells must host expandable,
tickable task lists, which no library models well, and the libraries cost 4 to 10 times the bytes. Virtualization is
unnecessary: one month holds at most 42 cells, and week/day views render one range.

---

## 4. PWA

### vite-plugin-pwa

- **2.0.0** shipped 2026-10-03. It is built on Workbox 7.4.1 and supports Vite 3 to 8 (peer).
- The only breaking change: the optional peer `@vite-pwa/assets-generator` moves to ^2.0.0.
- 1.3.0 added Vite 8 support and an `onNeedReload` hook.
- Source: [releases](https://github.com/vite-pwa/vite-plugin-pwa/releases).

The existing `generateSW` config carries over unchanged.

Recommended additions:
- `registerType: 'prompt'`, with an "Update available" snackbar. `autoUpdate` reloads mid-edit.
- `workbox.runtimeCaching` for `/api/` with `NetworkFirst` and a short timeout.
- Use `@vite-pwa/assets-generator@2.0.0` to generate icons, including the 180 px apple-touch-icon.

### Android (Chrome) install criteria

These come from [web.dev/install-criteria](https://web.dev/articles/install-criteria):
- HTTPS (or localhost).
- A manifest with `name`/`short_name`, `start_url`, and 192 px + 512 px icons.
- `display` set to `standalone`, `fullscreen`, `minimal-ui` or `window-controls-overlay`.
- `prefer_related_applications` absent or false.
- Engagement: at least one click/tap and at least 30 s on the page.

The current list does not require a service worker. Ship one anyway for the offline shell.

`beforeinstallprompt` fires only when the criteria are met. Store the event and show a custom Install button.

### iOS / iPadOS 26 caveats

| Topic | State (2026) |
|---|---|
| Install | No `beforeinstallprompt`. The user goes Share, then "Add to Home Screen". Show a one-time hint. From iOS 26, **every** site added to the Home Screen opens as a web app by default ("Open as Web App" toggle) ([WebKit WWDC25](https://webkit.org/?p=16993), [heise](https://heise.de/-10749652)). Developers report extra taps in the iOS 26 flow ([Apple forums](https://developer.apple.com/forums/thread/801602)). |
| Standalone | Honors `display: standalone`, `apple-touch-icon` and `theme-color`. Use `viewport-fit=cover` + `env(safe-area-inset-*)` for the notch and home indicator. |
| Storage | A Home Screen web app has the **same quota** as in the browser, up to 60% of disk per origin. Eviction happens on quota or storage pressure, or after inactivity. `navigator.storage.persist()` is granted by heuristics, including being a Home Screen web app ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)). The 7-day ITP script-storage cap counts *days of use of the web app itself*, not Safari ([WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). |
| Push | Web Push only for Home Screen apps (iOS 16.4+). Declarative Web Push (iOS 18.4+) needs no service worker ([WebKit](https://webkit.org/?p=16535)). Permission must come from a user gesture. Not needed for v1. |
| Background | No Background Sync and no Periodic Sync. Sync on `visibilitychange`, `focus` and `online` instead. |
| Secure context | HTTPS is needed for the service worker and install on both platforms. `http://cal.mordor.local` is not enough; this is an owner action, as the BRIEF says. |

Design implication: Google stays the only source of truth, so eviction only costs a re-fetch. Call
`navigator.storage.persist()` after install anyway.

---

## 5. Automated leak and performance testing

All of this runs in the Playwright Docker image (Chromium only, because it uses CDP) and in Vitest on Node.

### 5.1 Frontend: bounded heap and DOM growth (Playwright + CDP), every PR

`e2e/perf/leak.spec.ts`:

```ts
import { test, expect, type CDPSession } from '@playwright/test';

async function measure(cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  const dom = await cdp.send('Memory.getDOMCounters'); // { documents, nodes, jsEventListeners }
  return { heap: usedSize, ...dom };
}

test('switching views and expanding task lists does not leak', async ({ page }) => {
  await page.goto('/');
  const cdp = await page.context().newCDPSession(page);
  const cycle = async () => {
    for (const v of ['month', 'week', 'day'] as const) {
      await page.getByTestId(`view-switch-${v}`).click();
      await page.getByTestId(`view-${v}`).waitFor();
    }
    await page.getByTestId('tasklist-chip').first().click();   // expand
    await page.keyboard.press('Escape');                        // collapse
    await page.getByTestId('nav-next').click();
    await page.getByTestId('nav-prev').click();
  };
  for (let i = 0; i < 5; i++) await cycle();                    // warm-up: JIT, caches, lazy chunks
  const before = await measure(cdp);
  for (let i = 0; i < 50; i++) await cycle();
  const after = await measure(cdp);
  expect(after.heap - before.heap).toBeLessThan(1_000_000);     // < 1 MB growth over 50 cycles
  expect(after.nodes - before.nodes).toBeLessThan(200);         // detached/leaked DOM
  expect(after.jsEventListeners - before.jsEventListeners).toBeLessThan(20);
});
```

Adapt the `data-testid` names to STEPS.md. Run with `workers: 1` and a dedicated `perf` project, so other tests do not
add noise.

### 5.2 Frontend: memlab retainer analysis (nightly or manual, explains *why*)

Take three V8 snapshots from Playwright (baseline, after action, after revert). Then run memlab on them.
memlab drives Puppeteer itself, but `find-leaks` accepts any V8 snapshots
([memlab CLI](https://facebook.github.io/memlab/docs/cli/CLI-commands)).

```ts
import fs from 'node:fs';
async function snapshot(cdp: CDPSession, file: string) {
  const chunks: string[] = [];
  const on = (e: { chunk: string }) => chunks.push(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', on);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', on);
  fs.writeFileSync(file, chunks.join(''));
}
// s1 on /month, s2 after opening week+day+task list N times, s3 after returning to /month
```

```sh
npx memlab@2.0.5 find-leaks --baseline snaps/s1.heapsnapshot --target snaps/s2.heapsnapshot --final snaps/s3.heapsnapshot
npx memlab@2.0.5 analyze detached-DOM --snapshot snaps/s3.heapsnapshot
npx memlab@2.0.5 analyze unbound-collection --snapshot-dir snaps/
```

Fail the job if `find-leaks` reports any leak cluster that belongs to app code.

### 5.3 Vue cleanup rules (enforced by review and by 5.1)

- Every `addEventListener`, `setInterval`, `ResizeObserver`/`IntersectionObserver`, `matchMedia` listener and
  `store.$subscribe`/`$onAction` with `detached: true` needs cleanup in `onUnmounted` (or `onScopeDispose` in
  composables). Prefer `useEventListener`, `useIntervalFn` and `useResizeObserver` from `@vueuse/core@15`; they clean
  up automatically and tree-shake to a few hundred bytes each.
- Global singletons (clock tick, sync loop, `visibilitychange`) live in **one** Pinia store and start exactly once.
- Do not use `<KeepAlive>` on calendar views. If it is ever needed, set `:max`.
- Bound the range cache in Pinia (for example an LRU of 6 ranges). An ever-growing `Map` is the classic SPA leak.
- Use `shallowRef` for large event arrays, and do not put non-reactive objects (Date-heavy, Google payloads) in deep
  reactivity.
- Abort in-flight `fetch` with an `AbortController` on unmount or range change.

### 5.4 Backend: in-process heap growth (Vitest, every PR)

Run in-process against the app object (Hono `app.request`, no socket). Use a separate Vitest project, or a plain
script started with `node --expose-gc`:

```ts
// server/test/soak/heap.soak.ts  -> run: node --expose-gc --import tsx server/test/soak/heap.soak.ts
import assert from 'node:assert';
import { buildApp } from '../../src/app.js';
const app = buildApp(testConfig, new MockGoogleProvider(tmpDir));
const hit = async () => {
  await app.request('/api/events?from=2026-10-01&to=2026-11-01');
  const r = await app.request('/api/tasklists', { method: 'POST', body: JSON.stringify(sample), headers: { 'content-type': 'application/json' } });
  const { id } = await r.json();
  await app.request(`/api/tasklists/${id}`, { method: 'DELETE' });
};
for (let i = 0; i < 2_000; i++) await hit();             // warm-up
global.gc!(); const h0 = process.memoryUsage().heapUsed;
for (let i = 0; i < 20_000; i++) await hit();
global.gc!(); const h1 = process.memoryUsage().heapUsed;
assert.ok(h1 - h0 < 2 * 1024 * 1024, `heap grew ${(h1 - h0) / 1e6} MB`);
```

### 5.5 Backend: out-of-process RSS soak (nightly, autocannon)

```js
// scripts/soak.mjs  -> node scripts/soak.mjs   (server built, PROVIDER=mock)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import autocannon from 'autocannon';                     // autocannon@8.0.0
const srv = spawn('node', ['--max-old-space-size=96', 'server/dist/index.js'], { env: { ...process.env, PORT: '3999', SEED: 'true' }, stdio: 'inherit' });
await new Promise(r => setTimeout(r, 1500));
const rss = () => +/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${srv.pid}/status`, 'utf8'))[1] / 1024;
const samples = [];
for (let round = 0; round < 10; round++) {
  await autocannon({ url: 'http://127.0.0.1:3999/api/events?from=2026-10-01&to=2026-11-01', connections: 10, duration: 30 });
  await new Promise(r => setTimeout(r, 3000));
  samples.push(rss()); console.log(`round ${round}: ${samples.at(-1).toFixed(1)} MB`);
}
srv.kill();
const growth = samples.at(-1) - samples[2];             // ignore warm-up rounds
if (growth > 10) { console.error(`RSS grew ${growth.toFixed(1)} MB after warm-up`); process.exit(1); }
```

In production, start Node with `--heapsnapshot-signal=SIGUSR2`. Then
`docker kill -s USR2 calendar` writes a `.heapsnapshot` into the working directory, which you can open in Chrome
DevTools or feed to `memlab find-leaks`. No `--inspect` port needs to be exposed. For an interactive session in dev,
use `node --inspect=0.0.0.0:9229` and `chrome://inspect`.

### 5.6 Bundle budgets (every PR)

Use `size-limit@14.2.0` + `@size-limit/file@14.2.0`. `web/.size-limit.json`:

```json
[
  { "name": "initial JS", "path": "dist/assets/index-*.js", "limit": "75 kB", "gzip": true },
  { "name": "all JS",     "path": "dist/assets/*.js",       "limit": "110 kB", "gzip": true },
  { "name": "CSS",        "path": "dist/assets/*.css",      "limit": "15 kB", "gzip": true }
]
```

Run `pnpm -F web build && pnpm -F web exec size-limit`. The budgets assume Vue + router + Pinia + date-fns + hand-rolled
M3, about 45 to 60 KB gz. Tighten them after the first real build.

### 5.7 Lighthouse, mobile profile (nightly)

`@lhci/cli` 0.15.1 was last released 2025-06 and is stuck on Lighthouse 12.6
([unlighthouse](https://unlighthouse.dev/learn-lighthouse/lhci-vs-unlighthouse)). Lighthouse 13 removed budgets.
Call `lighthouse@13.5.0` directly (it needs Node 22.19 or later), using Playwright's Chromium, and assert with `jq`:

```sh
export CHROME_PATH=$(node -e "console.log(require('playwright').chromium.executablePath())")
npx lighthouse@13.5.0 http://localhost:4173/ --form-factor=mobile --throttling-method=simulate \
  --only-categories=performance,accessibility,best-practices --output=json --output-path=lh.json \
  --chrome-flags="--headless=new --no-sandbox"
jq -e '.categories.performance.score >= 0.9
   and .audits["largest-contentful-paint"].numericValue < 2500
   and .audits["total-blocking-time"].numericValue < 200
   and .audits["cumulative-layout-shift"].numericValue < 0.1' lh.json
```

---

## Decision

| Layer | Choice (exact) |
|---|---|
| Runtime | **Node 24.21.0 LTS**. Docker `node:24.21.0-alpine3.24`. Move to Node 26 LTS after 2026-10-28. |
| Package manager | **pnpm 12.11.2**, with `pnpm-workspace.yaml` (`packages: [server, web, e2e]`, `catalog:` for shared versions). Docker build uses `pnpm deploy --prod --filter @calendar/server`. |
| Language | `typescript@~6.0.3`. Not 7.x until vue-tsc supports the TS 7.1 API. `vue-tsc@3.3.13`. |
| Server | `hono@4.13.13`, `@hono/node-server@2.1.4`. Tests use `app.request()` with `vitest@5.0.3`. Dev uses `tsx`. |
| Google | `@googleapis/calendar@20.1.0`, `google-auth-library@11.2.0`, optional `@googleapis/tasks@17.0.1`. **Not** `googleapis` (+110 MB RSS, +241 MB disk). |
| Web | `vue@3.5.43`, `vue-router@5.4.0`, `pinia@4.0.3`, `date-fns@4.4.0`, `@vueuse/core@15.0.0`. Build with `vite@8.3.4` + `@vitejs/plugin-vue@6.0.10`. |
| UI | Hand-rolled M3 Expressive components on CSS tokens. `@material/material-color-utilities@0.4.0` generates the tokens at build time; runtime dynamic color is a lazy chunk. Icons via `unplugin-icons@24.0.0` + `@iconify-json/material-symbols@1.2.95`. System fonts. No component library. |
| Calendar | Custom month/week/day views (date-fns). No vue-cal, Schedule-X or FullCalendar. |
| PWA | `vite-plugin-pwa@2.0.0` (generateSW, `registerType: 'prompt'`), `@vite-pwa/assets-generator@2.0.0`. Add an iOS Add-to-Home-Screen hint and a stored `beforeinstallprompt` for Android. Call `navigator.storage.persist()` after install. |
| Unit tests | `vitest@5.0.3`, `@vue/test-utils@2.5.1`, `jsdom@30.1.2`. |
| E2E | `@playwright/test@1.64.0`, `playwright-bdd@9.2.1`, image `mcr.microsoft.com/playwright:v1.64.0-noble`. |
| Perf and leak gates | Every PR: CDP heap/DOM growth spec (5.1), in-process heap soak (5.4), `size-limit@14.2.0` budgets (5.6). Nightly: memlab 2.0.5 retainer report (5.2), autocannon 8.0.0 RSS soak (5.5), `lighthouse@13.5.0` mobile (5.7). |
| Container limits | `mem_limit: 192m`, `NODE_OPTIONS=--max-old-space-size=96 --heapsnapshot-signal=SIGUSR2`. |
| Rejected | Bun runtime (revisit once 1.4.x is proven; Hono makes the switch one file). Bun as package manager only. Fastify (more dependencies and RSS for no gain here). Vuetify, Quasar, PrimeVue and @material/web (+44 to 112 KB gz; @material/web is in maintenance mode). |

## Migration from current scaffold

The current scaffold is Node 22.11 + npm workspaces + Fastify 5 + Vue 3 + Vite 5 + Pinia 2 + vite-plugin-pwa 0.20.

1. **Node:** install Node 24.21.0 into `~/.local/opt/node-v24.21.0-linux-x64` (no sudo). Update `.nvmrc`,
   `engines: { node: ">=24.11" }` and the Dockerfile base. This also allows deleting the `light-my-request` override
   in the root `package.json`.
2. **pnpm:** run `npm i -g pnpm@12.11.2`, or use the standalone binary in `~/.local/bin`. Then:
   - Add `pnpm-workspace.yaml`.
   - Add `"packageManager": "pnpm@12.11.2"`.
   - Delete `package-lock.json` and `node_modules`, then run `pnpm install`.
   - Replace `npm run -w X` with `pnpm -F @calendar/X` in the scripts and `scripts/deploy.sh`.
   - Expect phantom-dependency errors; fix them by adding the missing dependencies explicitly.
3. **Server:**
   - Replace `fastify` and `@fastify/static` with `hono` and `@hono/node-server`.
   - `buildApp()` returns `Hono`.
   - Routes become `app.get('/api/...', c => c.json(...))`.
   - The error handler becomes `app.onError`.
   - SPA fallback: `serveStatic({ root: webDist })` plus `app.get('*', serveStatic({ path: 'index.html' }))`, excluding `/api`.
   - In tests, `fastify.inject({ method, url, payload })` becomes `app.request(url, { method, body: JSON.stringify(payload), headers })`.
   - In the BRIEF wording, "Fastify" and `inject` are overridden by this Decision. The REST contract
     is unchanged.
4. **Google:** in `GoogleProvider`, import `{ calendar_v3, calendar } from '@googleapis/calendar'` and
   `{ OAuth2Client } from 'google-auth-library'`. Never import `googleapis`.
5. **Web:** update the dependencies:
   - Bump `vite` 5 to 8.3.4, `@vitejs/plugin-vue` to 6.0.10, `vitest` 2 to 5.0.3, `jsdom` to 30.1.2, `vue-router` 4 to 5.4.0, `pinia` 2 to 4.0.3, `vite-plugin-pwa` 0.20 to 2.0.0, `typescript` to ~6.0.3 and `vue-tsc` to 3.3.13.
   - Remove the `/// <reference types="vitest" />` triple-slash in `vite.config.ts`; use `vitest/config`'s `defineConfig`.
   - Read the vue-router 5 and Pinia 3/4 migration notes. The public API is mostly unchanged, but the router now ships
     the file-based routing plugin optionally.
6. **E2E:** the BRIEF pins Playwright **1.48.2** (2024; Chromium 130). That is two years old and lacks WebKit 26/27
   fidelity for iOS checks.
   - Use **`@playwright/test@1.64.0` with `mcr.microsoft.com/playwright:v1.64.0-noble`**. Pull it with
     `docker pull mcr.microsoft.com/playwright:v1.64.0-noble`.
   - `v1.63.0-noble` is already pulled locally and is acceptable if pulling is undesirable; then pin
     `@playwright/test@1.63.0`.
   - After switching, remove the 1.48.2 image (2.15 GB) to free disk.
   - The library version and the image tag must match exactly.
7. **Docker:** use a multi-stage build:
   1. `node:24-alpine` + pnpm builds web and server.
   2. `pnpm deploy --prod --filter @calendar/server /out`.
   3. Final stage `node:24.21.0-alpine3.24` copies `/out` and `web/dist`, runs as `USER node`, with
      `CMD ["node","dist/index.js"]` and a `HEALTHCHECK` with `wget -qO- localhost:3000/api/health`.

   Expected image: about 62 MB base + about 10 MB app. With `googleapis` it would be about 300 MB.
8. **CI gates:** add `test:leak` (Playwright `perf` project), `test:soak` (5.4), `size` (size-limit) and `perf:lh`
   (nightly) scripts. Run at most 2 heavy jobs at once, as the BRIEF says.
