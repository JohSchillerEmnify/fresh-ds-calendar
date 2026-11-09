/** Per-device remembered values (ink mode, colour, pen; desktop tray) keep their stored format and their fallbacks. */
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { useInkStore } from '@/stores/ink';
import { useUiStore } from '@/stores/ui';
import { freshPinia } from './helpers';

beforeEach(() => { localStorage.clear(); freshPinia(); });

describe('ink store on the device', () => {
  it('starts with ink, no colour and no pen, and writes nothing until a change', () => {
    const s = useInkStore();
    expect([s.mode, s.colour, s.penSeen]).toEqual(['ink', null, false]);
    expect(localStorage.length).toBe(0);
  });
  it('reads what an older version stored', () => {
    localStorage.setItem('cal.ink.mode', 'text');
    localStorage.setItem('cal.ink.colour', '#D32F2F');
    localStorage.setItem('cal.ink.pen', '1');
    const s = useInkStore();
    expect([s.mode, s.colour, s.penSeen]).toEqual(['text', '#D32F2F', true]);
  });
  it('falls back for values it does not know', () => {
    localStorage.setItem('cal.ink.mode', 'pencil');
    localStorage.setItem('cal.ink.colour', 'red');
    const s = useInkStore();
    expect([s.mode, s.colour]).toEqual(['ink', null]);
  });
  it('writes the same strings as before, and forgets the colour when it is cleared', () => {
    const s = useInkStore();
    s.setMode('text');
    s.setColour('#00ff00');
    s.notePen();
    expect([localStorage.getItem('cal.ink.mode'), localStorage.getItem('cal.ink.colour'), localStorage.getItem('cal.ink.pen')]).toEqual(['text', '#00ff00', '1']);
    s.setColour(null);
    expect(localStorage.getItem('cal.ink.colour')).toBeNull();
  });
});

describe('desktop tray on the device', () => {
  it('is open by default and writes nothing', () => {
    expect(useUiStore().trayCollapsedDesktop).toBe(false);
    expect(localStorage.getItem('cal.trayCollapsedDesktop')).toBeNull();
  });
  it('reads a stored 1 and writes 1 or 0', async () => {
    localStorage.setItem('cal.trayCollapsedDesktop', '1');
    const ui = useUiStore();
    expect(ui.trayCollapsedDesktop).toBe(true);
    ui.trayCollapsedDesktop = false;
    await nextTick();
    expect(localStorage.getItem('cal.trayCollapsedDesktop')).toBe('0');
    ui.trayCollapsedDesktop = true;
    await nextTick();
    expect(localStorage.getItem('cal.trayCollapsedDesktop')).toBe('1');
  });
});
