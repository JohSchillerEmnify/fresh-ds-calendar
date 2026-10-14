import { afterEach, describe, expect, it } from 'vitest';
import { isIos, isIosSafari, isStandalone } from '@/pwa/install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('iOS detection', () => {
  it('detects iPhone Safari and Chrome on iOS', () => {
    expect(isIos(IPHONE, 5)).toBe(true);
    expect(isIos(IPHONE_CHROME, 5)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
  });
  it('detects an iPad that reports a Mac user agent, but not a real Mac', () => {
    expect(isIos(MAC, 5)).toBe(true);
    expect(isIos(MAC, 0)).toBe(false);
  });
  it('does not treat Android as iOS', () => {
    expect(isIos(ANDROID, 5)).toBe(false);
  });
});

describe('standalone detection', () => {
  afterEach(() => { delete (navigator as { standalone?: boolean }).standalone; });
  it('is false in a browser tab and true with navigator.standalone', () => {
    expect(isStandalone()).toBe(false);
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(isStandalone()).toBe(true);
  });
});
