/**
 * Theme document format `calendar-theme/1` (ARCHITECTURE "Theme engine and AI themes"): the validator and the SVG
 * sanitising rules, shared by the server and the web app. Plain ESM so both can import it without a build step.
 */
import schema from './theme.schema.json' with { type: 'json' };

export const THEME_SCHEMA_ID = schema.$id;
export const themeSchema = schema;
export const MAX_THEMES = 20;
/** Largest theme file the import accepts, in bytes. */
export const MAX_THEME_BYTES = 200 * 1024;

const MAX_ERRORS = 20;

/** Dotted path of a field, or `The theme` for the document itself. */
const label = (path) => (path.length ? path.join('.') : 'The theme');
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Checks `value` against the subset of JSON Schema the theme schema uses; pushes one readable message per problem. */
function check(value, sch, path, errors) {
  if (sch.$ref) sch = sch.$ref.split('/').slice(1).reduce((n, k) => n[k], schema);
  const name = label(path);
  if ('const' in sch) {
    if (value !== sch.const) errors.push(`${name} must be "${sch.const}"`);
  } else if (sch.enum) {
    if (!sch.enum.includes(value)) errors.push(`${name} must be one of ${sch.enum.join(', ')}`);
  } else if (sch.type === 'string') {
    if (typeof value !== 'string') errors.push(`${name} must be text`);
    else if (sch.minLength && value.length < sch.minLength) errors.push(`${name} must not be empty`);
    else if (sch.maxLength && value.length > sch.maxLength) errors.push(`${name} must be at most ${sch.maxLength} characters`);
    else if (sch.pattern && !new RegExp(sch.pattern).test(value)) errors.push(`${name} must be ${sch['x-hint'] ?? `in the form ${sch.pattern}`}`);
  } else if (sch.type === 'object') {
    if (!isObject(value)) return void errors.push(`${name} must be an object`);
    for (const k of sch.required ?? []) if (!(k in value)) errors.push(`${label([...path, k])} is required`);
    for (const [k, v] of Object.entries(value)) {
      if (sch.properties?.[k]) check(v, sch.properties[k], [...path, k], errors);
      else if (sch.additionalProperties === false) errors.push(`${label([...path, k])} is not a known field`);
    }
  }
}

/** Rules the schema cannot say: the scene is a built-in or an SVG, and each SVG is really an SVG. */
function checkScene(scene, errors) {
  if (!isObject(scene)) return;
  const { builtin, svg } = scene;
  if (builtin === undefined && svg === undefined) errors.push('scene needs either builtin or svg');
  else if (builtin !== undefined && svg !== undefined) errors.push('scene can have builtin or svg, not both');
  if (!isObject(svg)) return;
  if (svg.light === undefined && svg.dark === undefined) errors.push('scene.svg needs light or dark');
  for (const k of ['light', 'dark']) {
    if (typeof svg[k] === 'string' && !/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg[k])) errors.push(`scene.svg.${k} must be an SVG picture (starting with <svg)`);
  }
}

/** @returns {{ ok: true, doc: object } | { ok: false, errors: string[] }} */
export function validateTheme(input) {
  const errors = [];
  check(input, schema, [], errors);
  if (!errors.length) checkScene(input.scene, errors);
  return errors.length ? { ok: false, errors: errors.slice(0, MAX_ERRORS) } : { ok: true, doc: input };
}

const FORBIDDEN_TAGS = ['script', 'foreignObject', 'image', 'style', 'iframe', 'object', 'embed', 'animate', 'set', 'animateMotion', 'animateTransform'];
const hooked = new WeakSet();

/**
 * Builds the SVG sanitiser around a DOMPurify instance (the browser's, or one bound to a jsdom window on the server).
 * Allow-list: the DOMPurify SVG profile without script, style, image, foreignObject or animation elements; no event
 * attributes; `href` only to `#fragment`; `url()` only to `#fragment`.
 *
 * @returns {(svg: string) => { svg: string, removed: boolean }}
 */
export function createSvgSanitizer(purify) {
  let removed = false;
  if (!hooked.has(purify)) {
    hooked.add(purify);
    purify.addHook('uponSanitizeAttribute', (_node, data) => {
      const external = /^(xlink:)?href$/i.test(data.attrName) ? !/^\s*#/.test(data.attrValue) : /url\(\s*(?!['"]?#)/i.test(data.attrValue);
      if (external) { data.keepAttr = false; data.forceKeepAttr = false; removed = true; }
    });
  }
  return (svg) => {
    removed = false;
    let out = purify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: FORBIDDEN_TAGS, FORBID_ATTR: ['style'] });
    out = String(out).trim();
    // an image document needs the namespace, which the HTML parser drops
    if (/^<svg[\s>]/i.test(out) && !/^<svg[^>]*\sxmlns=/i.test(out)) out = out.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    // DOMPurify always lists its own <body> wrapper as removed
    return { svg: out, removed: removed || purify.removed.some((r) => r.element?.nodeName !== 'BODY') };
  };
}

/**
 * Sanitises the scene SVGs of a validated theme.
 *
 * @returns {{ ok: true, doc: object, removed: boolean } | { ok: false, errors: string[] }}
 */
export function sanitizeTheme(sanitize, doc) {
  const svg = doc.scene?.svg;
  if (!svg) return { ok: true, doc, removed: false };
  const clean = {};
  const errors = [];
  let removed = false;
  for (const k of ['light', 'dark']) {
    if (svg[k] === undefined) continue;
    const r = sanitize(svg[k]);
    removed ||= r.removed;
    if (/^<svg[\s>]/i.test(r.svg)) clean[k] = r.svg;
    else errors.push(`scene.svg.${k} has no usable picture left after removing unsafe parts`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: { ...doc, scene: { svg: clean } }, removed };
}
