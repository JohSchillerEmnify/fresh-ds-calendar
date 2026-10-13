import { afterEach, describe, expect, it } from 'vitest';
import { validatePictureIssues, validateTheme, validateThemeIssues } from '@calendar/shared';
import { applyLanguage, hasKey } from '@/i18n';
import { EXAMPLE_THEME } from '@/theme/aiPrompt';
import { issueText } from '@/theme/issueText';

afterEach(async () => { await applyLanguage('en'); });

const bad = (patch: Record<string, unknown>) => {
  const r = validateThemeIssues({ ...JSON.parse(JSON.stringify(EXAMPLE_THEME)), ...patch });
  if (r.ok) throw new Error('expected problems');
  return r.issues;
};

describe('validator issues', () => {
  it('carry a code, params and the unchanged English message', () => {
    expect(bad({ radius: 29 })).toEqual([{ code: 'range', params: { field: 'radius', min: 0, max: 28 }, message: 'radius must be between 0 and 28' }]);
    expect(bad({ tint: 2.5 })[0]).toMatchObject({ code: 'integer', params: { field: 'tint' } });
    expect(bad({ icons: 'filled' })[0]!.code).toBe('enum');
    expect(bad({ bogus: 1 })[0]).toMatchObject({ code: 'unknownField', params: { field: 'bogus' } });
  });
  it('validateTheme still returns the English strings for the repair prompt', () => {
    const r = validateTheme({ ...JSON.parse(JSON.stringify(EXAMPLE_THEME)), radius: 29 });
    expect(r).toEqual({ ok: false, errors: ['radius must be between 0 and 28'] });
  });
  it('the document itself has an empty field path', () => {
    const r = validateThemeIssues('x');
    expect(r).toMatchObject({ ok: false, issues: [{ code: 'object', params: { field: '' }, message: 'The theme must be an object' }] });
  });
  it('picture problems have codes too', () => {
    const r = validatePictureIssues({ light: 5, extra: 1 });
    expect(r.ok ? [] : r.issues.map((i) => i.code)).toEqual(['pictureUnknownField', 'pictureText']);
  });
});

describe('issueText', () => {
  it('English text equals the validator message', () => {
    for (const i of bad({ radius: 29, tint: 2.5, icons: 'filled', bogus: 1 })) expect(issueText(i)).toBe(i.message);
  });
  it('translates by code', async () => {
    await applyLanguage('de');
    expect(issueText(bad({ radius: 29 })[0]!)).toBe('radius muss zwischen 0 und 28 liegen');
    const doc = validateThemeIssues('x');
    expect(doc.ok ? '' : issueText(doc.issues[0]!)).toBe('Das Design muss ein Objekt sein');
  });
  it('falls back to the English message for an unknown code', () => {
    expect(issueText({ code: 'nope', params: {}, message: 'English only' })).toBe('English only');
  });
  it('every code the validator can emit has a catalogue key', () => {
    const codes = ['const', 'enum', 'text', 'empty', 'maxLength', 'hexColour', 'pattern', 'integer', 'range', 'list', 'minItems', 'maxItems', 'object', 'required', 'unknownField', 'sceneNeeds', 'sceneBoth', 'sceneExtras', 'pictureObject', 'pictureUnknownField', 'pictureNeeds', 'pictureText', 'pictureTooBig', 'pictureNotSvg', 'pictureEmpty'];
    for (const c of codes) expect(hasKey(`theme.import.issue.${c}`), c).toBe(true);
  });
});
