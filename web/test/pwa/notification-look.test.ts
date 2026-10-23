import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { notificationLook } from '@/pwa/notificationLook';

const publicFile = (url: string) => path.join(import.meta.dirname, '../../public', url);
/** Width and height of a PNG, from its IHDR chunk. */
const pngSize = (file: string) => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

describe('notification look of a push (feature reminders)', () => {
  it('gives each kind its own badge and icon; only bedtime gets the moon', () => {
    expect(notificationLook('event')).toEqual({ badge: '/icons/badge-event-96.png', icon: '/icons/notification-event-192.png' });
    expect(notificationLook('tasklist')).toEqual({ badge: '/icons/badge-tasklist-96.png', icon: '/icons/notification-tasklist-192.png' });
    expect(notificationLook('summary')).toEqual({ badge: '/icons/badge-summary-96.png', icon: '/icons/notification-summary-192.png' });
    expect(notificationLook('bedtime')).toEqual({ badge: '/icons/badge-bedtime-96.png', icon: '/icons/notification-bedtime-192.png' });
  });

  it('shows a push without a known kind (a plan sent before kinds) as an event', () => {
    expect(notificationLook(undefined)).toEqual(notificationLook('event'));
    expect(notificationLook('weather')).toEqual(notificationLook('event'));
  });

  it('points at PNG files that exist in the sizes their names say', () => {
    for (const kind of ['event', 'tasklist', 'summary', 'bedtime']) {
      const { badge, icon } = notificationLook(kind);
      expect(existsSync(publicFile(badge)), badge).toBe(true);
      expect(pngSize(publicFile(badge))).toEqual([96, 96]);
      expect(pngSize(publicFile(icon))).toEqual([192, 192]);
    }
  });
});
