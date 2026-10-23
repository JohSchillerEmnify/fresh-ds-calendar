/**
 * Compile-time constants of the web app, shared by the build (vite.config.ts) and the component goldens
 * (vitest.goldens.config.ts) so both compile the components the same way.
 */
export function appDefines(version: string): Record<string, string | boolean> {
  return {
    __APP_VERSION__: JSON.stringify(version),
    // vue-i18n feature flags (docs "Optimization"): Composition API only, no plugin install, no devtools hooks
    __VUE_I18N_FULL_INSTALL__: false,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  };
}
