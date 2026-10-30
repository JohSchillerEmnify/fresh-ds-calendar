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
          '^shared/(index|prefs)\\.js$',
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
