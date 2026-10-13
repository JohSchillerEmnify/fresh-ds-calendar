import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '@/lib/copyText';

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the Clipboard API in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('hi', null)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hi');
  });

  it('selects the field and uses the copy command over plain http', async () => {
    vi.stubGlobal('isSecureContext', false);
    const field = document.createElement('textarea');
    field.value = 'prompt text';
    document.body.append(field);
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    expect(await copyText('prompt text', field)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe('prompt text'.length);
    field.remove();
  });

  it('reports failure when there is nothing to copy from', async () => {
    vi.stubGlobal('isSecureContext', false);
    expect(await copyText('x', null)).toBe(false);
  });
});
