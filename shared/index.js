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
/** Largest own picture (one SVG variant), in characters. */
export const MAX_PICTURE_BYTES = 100 * 1024;

const MAX_ERRORS = 20;

/** Dotted path of a field, or `The theme` for the document itself. */
const label = (path) => (path.length ? path.join('.') : 'The theme');
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * One validation problem: a machine-readable `code` and `params` (so the UI can translate it) next to the English
 * `message` (what the AI repair prompt uses). `params.field` is the dotted path, empty for the document itself.
 *
 * @typedef {{ code: string, params: Record<string, string | number>, message: string }} Issue
 */

/** Pushes one issue; the message is the English text that was always shown. */
const add = (issues, code, params, message) => void issues.push({ code, params, message });
const messages = (issues) => issues.map((i) => i.message);

/** Checks `value` against the subset of JSON Schema the theme schema uses; pushes one issue per problem. */
function check(value, sch, path, issues) {
  if (sch.$ref) sch = sch.$ref.split('/').slice(1).reduce((n, k) => n[k], schema);
  const name = label(path);
  const field = path.join('.');
  if ('const' in sch) {
    if (value !== sch.const) add(issues, 'const', { field, value: sch.const }, `${name} must be "${sch.const}"`);
  } else if (sch.enum) {
    if (!sch.enum.includes(value)) add(issues, 'enum', { field, options: sch.enum.join(', ') }, `${name} must be one of ${sch.enum.join(', ')}`);
  } else if (sch.type === 'string') {
    if (typeof value !== 'string') add(issues, 'text', { field }, `${name} must be text`);
    else if (sch.minLength && value.length < sch.minLength) add(issues, 'empty', { field }, `${name} must not be empty`);
    else if (sch.maxLength && value.length > sch.maxLength) add(issues, 'maxLength', { field, max: sch.maxLength }, `${name} must be at most ${sch.maxLength} characters`);
    // the only `x-hint` in the schema describes a hex colour, so a hint means `hexColour`
    else if (sch.pattern && !new RegExp(sch.pattern).test(value)) add(issues, sch['x-hint'] ? 'hexColour' : 'pattern', { field, pattern: sch.pattern }, `${name} must be ${sch['x-hint'] ?? `in the form ${sch.pattern}`}`);
  } else if (sch.type === 'integer') {
    if (!Number.isInteger(value)) add(issues, 'integer', { field }, `${name} must be a whole number`);
    else if (value < sch.minimum || value > sch.maximum) add(issues, 'range', { field, min: sch.minimum, max: sch.maximum }, `${name} must be between ${sch.minimum} and ${sch.maximum}`);
  } else if (sch.type === 'array') {
    if (!Array.isArray(value)) return void add(issues, 'list', { field }, `${name} must be a list`);
    if (sch.minItems && value.length < sch.minItems) add(issues, 'minItems', { field, min: sch.minItems }, `${name} must have at least ${sch.minItems} entries`);
    else if (sch.maxItems && value.length > sch.maxItems) add(issues, 'maxItems', { field, max: sch.maxItems }, `${name} must have at most ${sch.maxItems} entries`);
    value.forEach((v, i) => check(v, sch.items, [...path.slice(0, -1), `${path.at(-1)}[${i}]`], issues));
  } else if (sch.type === 'object') {
    if (!isObject(value)) return void add(issues, 'object', { field }, `${name} must be an object`);
    for (const k of sch.required ?? []) if (!(k in value)) add(issues, 'required', { field: [...path, k].join('.') }, `${label([...path, k])} is required`);
    for (const [k, v] of Object.entries(value)) {
      if (sch.properties?.[k]) check(v, sch.properties[k], [...path, k], issues);
      else if (sch.additionalProperties === false) add(issues, 'unknownField', { field: [...path, k].join('.') }, `${label([...path, k])} is not a known field`);
    }
  }
}

/** Rule the schema cannot say: the scene is either a built-in or a drawn gradient. */
function checkScene(scene, issues) {
  if (!isObject(scene)) return;
  const drawn = scene.gradient !== undefined;
  if (scene.builtin === undefined && !drawn) add(issues, 'sceneNeeds', {}, 'scene needs either builtin or gradient');
  else if (scene.builtin !== undefined && drawn) add(issues, 'sceneBoth', {}, 'scene can have builtin or gradient, not both');
  else if (scene.builtin !== undefined && (scene.decor !== undefined || scene.density !== undefined)) add(issues, 'sceneExtras', {}, 'scene.decor and scene.density go with gradient, not with builtin');
}

/**
 * Like {@link validateTheme}, but the problems are {@link Issue}s (code, params and the English message), which the UI
 * translates.
 *
 * @returns {{ ok: true, doc: object } | { ok: false, issues: Issue[] }}
 */
export function validateThemeIssues(input) {
  const issues = [];
  check(input, schema, [], issues);
  if (!issues.length) checkScene(input.scene, issues);
  return issues.length ? { ok: false, issues: issues.slice(0, MAX_ERRORS) } : { ok: true, doc: input };
}

/** @returns {{ ok: true, doc: object } | { ok: false, errors: string[] }} */
export function validateTheme(input) {
  const r = validateThemeIssues(input);
  return r.ok ? r : { ok: false, errors: messages(r.issues) };
}

const MAX_PICTURE_CHARS = 100 * 1024;

/**
 * Like {@link validatePicture}, but the problems are {@link Issue}s.
 *
 * @returns {{ ok: true, picture: object } | { ok: false, issues: Issue[] }}
 */
export function validatePictureIssues(input) {
  if (!isObject(input)) return { ok: false, issues: [{ code: 'pictureObject', params: {}, message: 'picture must be an object' }] };
  const issues = [];
  for (const k of Object.keys(input)) if (k !== 'light' && k !== 'dark') add(issues, 'pictureUnknownField', { field: `picture.${k}` }, `picture.${k} is not a known field`);
  if (input.light === undefined && input.dark === undefined) add(issues, 'pictureNeeds', {}, 'picture needs light or dark');
  for (const k of ['light', 'dark']) {
    const v = input[k];
    if (v === undefined) continue;
    const field = `picture.${k}`;
    if (typeof v !== 'string') add(issues, 'pictureText', { field }, `${field} must be text`);
    else if (v.length > MAX_PICTURE_CHARS) add(issues, 'pictureTooBig', { field, kb: MAX_PICTURE_CHARS / 1024 }, `${field} must be at most ${MAX_PICTURE_CHARS / 1024} KB`);
    else if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>/]/i.test(v)) add(issues, 'pictureNotSvg', { field }, `${field} must be an SVG picture (starting with <svg)`);
  }
  return issues.length ? { ok: false, issues } : { ok: true, picture: input };
}

/**
 * Checks the own top bar picture (SVG text, light and optional dark), kept apart from the theme document.
 *
 * @returns {{ ok: true, picture: object } | { ok: false, errors: string[] }}
 */
export function validatePicture(input) {
  const r = validatePictureIssues(input);
  return r.ok ? r : { ok: false, errors: messages(r.issues) };
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
    if (/^<svg[\s>/]/i.test(out) && !/^<svg[^>]*\sxmlns=/i.test(out)) out = out.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    // DOMPurify always lists its own <body> wrapper as removed
    return { svg: out, removed: removed || purify.removed.some((r) => r.element?.nodeName !== 'BODY') };
  };
}

/**
 * Like {@link sanitizePicture}, but the problems are {@link Issue}s.
 *
 * @returns {{ ok: true, picture: object, removed: boolean } | { ok: false, issues: Issue[] }}
 */
export function sanitizePictureIssues(sanitize, picture) {
  const clean = {};
  const issues = [];
  let removed = false;
  for (const k of ['light', 'dark']) {
    if (picture[k] === undefined) continue;
    const r = sanitize(picture[k]);
    removed ||= r.removed;
    if (/^<svg[\s>/]/i.test(r.svg)) clean[k] = r.svg;
    else add(issues, 'pictureEmpty', { field: `picture.${k}` }, `picture.${k} has no usable picture left after removing unsafe parts`);
  }
  return issues.length ? { ok: false, issues } : { ok: true, picture: clean, removed };
}

/**
 * Sanitises the SVGs of a validated picture.
 *
 * @returns {{ ok: true, picture: object, removed: boolean } | { ok: false, errors: string[] }}
 */
export function sanitizePicture(sanitize, picture) {
  const r = sanitizePictureIssues(sanitize, picture);
  return r.ok ? r : { ok: false, errors: messages(r.issues) };
}
