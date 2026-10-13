import { describe, expect, it } from 'vitest';
import { splitVersion } from '@/pwa/version';

describe('splitVersion', () => {
  it('splits the number from the git sha', () => {
    expect(splitVersion('0.4.2+abc1234')).toEqual({ version: '0.4.2', sha: 'abc1234' });
    expect(splitVersion('0.4.2-preview+abc1234')).toEqual({ version: '0.4.2-preview', sha: 'abc1234' });
  });
  it('has no sha when the build version carries none', () => {
    expect(splitVersion('0.1.0')).toEqual({ version: '0.1.0', sha: '' });
  });
});

describe('isPreviewBuild', () => {
  it('treats only preview builds as self-reloading', async () => {
    const { isPreviewBuild } = await import('@/pwa/update');
    expect(isPreviewBuild('0.3.0-preview+f1e8b92')).toBe(true);
    expect(isPreviewBuild('0.3.0+f1e8b92')).toBe(false);
    expect(isPreviewBuild('0.3.0')).toBe(false);
  });
});
