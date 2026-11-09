/** Architecture rules for `pnpm quality` (see CONTRIBUTING.md "Quality gates"). */
const ROUTES = '^server/src/(api|routes)/';
const STORES = '^server/src/(services/[^/]*Store\\.ts|auth/peopleStore\\.ts|providers/)';
const SERVICES = '^server/src/services/(?![^/]*Store\\.ts)';

module.exports = {
  forbidden: [
    {
      name: 'service-not-to-route',
      comment: 'Layers: routes -> services -> stores/providers. A service never imports a route module.',
      severity: 'error',
      from: { path: '^server/src/(services|providers|lib|auth)/' },
      to: { path: ROUTES },
    },
    {
      name: 'store-not-to-service',
      comment: 'Layers: routes -> services -> stores/providers. A store or provider never imports a service.',
      severity: 'error',
      from: { path: STORES },
      to: { path: SERVICES },
    },
    {
      name: 'store-not-to-route',
      comment: 'A store or provider never imports a route module.',
      severity: 'error',
      from: { path: STORES },
      to: { path: ROUTES },
    },
    {
      name: 'web-not-to-server',
      comment: 'Web and server share code only through shared/.',
      severity: 'error',
      from: { path: '^web/' },
      to: { path: '^server/' },
    },
    {
      name: 'server-not-to-web',
      comment: 'Web and server share code only through shared/.',
      severity: 'error',
      from: { path: '^server/' },
      to: { path: '^web/' },
    },
    {
      name: 'feature-via-index-only',
      comment: 'A feature module is reached through its index.ts (public entry) from outside the feature.',
      severity: 'error',
      from: { pathNot: '^web/src/features/([^/]+)/' },
      to: { path: '^web/src/features/[^/]+/', pathNot: '^web/src/features/[^/]+/index\\.ts$' },
    },
    {
      name: 'feature-not-to-feature-internals',
      comment: 'Feature modules import each other only through their index.ts.',
      severity: 'error',
      from: { path: '^web/src/features/([^/]+)/' },
      to: { path: '^web/src/features/[^/]+/', pathNot: ['^web/src/features/$1/', '^web/src/features/[^/]+/index\\.ts$'] },
    },
    {
      name: 'plan-rule-only-in-scheduler',
      comment: 'A calendar plan sets the hidden flag (ADR 0037); only the scheduler reads the plan rule, so no reader can start evaluating plans again.',
      severity: 'error',
      from: { pathNot: '^server/src/services/calendarPlanScheduler\\.ts$' },
      to: { path: '^server/src/lib/planEdges\\.ts$' },
    },
    {
      name: 'plan-helpers-only-in-plan-ui',
      comment: 'The web plan helpers describe a plan for the plan UI and the calendars store; they never decide visibility (ADR 0037).',
      severity: 'error',
      from: { pathNot: '^web/src/(components/settings/planSummary\\.ts|components/shell/FilterBar\\.vue|features/calendar/|stores/calendars\\.ts)' },
      to: { path: '^web/src/lib/calendarPlan\\.ts$' },
    },
    {
      name: 'ui-not-to-device-db',
      comment: 'The device copy and outbox (ADR 0023/0025) are reached through stores/device.ts and stores/outbox.ts. UI code never opens IndexedDB (idb, lib/deviceDb.ts) itself; settings use stores/prefs.ts.',
      severity: 'error',
      from: { path: '^web/src/(components|views|features)/' },
      to: { path: ['node_modules/idb/', '^web/src/lib/deviceDb\\.ts$'] },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment: 'Every module is imported by something, except entry points.',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '^web/src/(main|sw)\\.ts$',
          '^server/src/index\\.ts$',
          '\\.d\\.ts$',
          '^shared/(index|prefs|colors|limits|ink)\\.js$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'], mainFields: ['module', 'main', 'types'] },
  },
};
