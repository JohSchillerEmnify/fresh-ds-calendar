import type { CalendarService } from './services/calendar.js';
import type { MotivationService } from './services/motivation.js';
import { addDays, localDateOf } from './lib/time.js';

type Cal = 'primary' | 'work';
interface Ev { d: number; t?: string; min?: number; days?: number; title: string; cal?: Cal; loc?: string; desc?: string; color?: string }

/** ~25 events from two weeks ago to four weeks ahead, relative to `today`. */
const EVENTS: Ev[] = [
  { d: -13, t: '09:30', min: 30, title: 'Sprint planning', cal: 'work' },
  { d: -12, t: '18:00', min: 90, title: 'Gym: legs', color: '10' },
  { d: -10, t: '19:30', min: 120, title: 'Dinner with Anna', loc: 'Trattoria Roma' },
  { d: -9, title: "Mia's birthday", days: 1, color: '4' },
  { d: -8, t: '10:00', min: 60, title: 'Design review', cal: 'work', loc: 'Room 4.2' },
  { d: -6, t: '08:15', min: 45, title: 'Dentist', loc: 'Dr. Weber, Hauptstr. 12', color: '7' },
  { d: -5, t: '14:00', min: 60, title: 'Quarterly numbers', cal: 'work' },
  { d: -3, t: '18:00', min: 90, title: 'Gym: upper body', color: '10' },
  { d: -2, t: '12:30', min: 60, title: 'Lunch with Tom' },
  { d: -1, t: '16:00', min: 30, title: 'Team retro', cal: 'work' },
  { d: 0, t: '09:00', min: 30, title: 'Standup', cal: 'work' },
  { d: 0, t: '11:00', min: 60, title: 'Project sync', cal: 'work', loc: 'Video call' },
  { d: 0, t: '18:30', min: 90, title: 'Gym: cardio', color: '10' },
  { d: 1, t: '09:00', min: 30, title: 'Standup', cal: 'work' },
  { d: 1, t: '15:00', min: 45, title: 'Call with the landlord' },
  { d: 2, t: '13:00', min: 60, title: 'Interview: frontend candidate', cal: 'work' },
  { d: 3, title: 'Team offsite', days: 2, cal: 'work', loc: 'Leipzig', color: '9' },
  { d: 4, t: '19:00', min: 150, title: 'Concert', loc: 'Admiralspalast', color: '3' },
  { d: 6, t: '10:30', min: 60, title: 'Brunch with parents', color: '5' },
  { d: 8, title: 'Weekend trip to the coast', days: 3, color: '7', loc: 'Rostock' },
  { d: 11, t: '16:30', min: 30, title: 'Car service', loc: 'Autohaus Nord' },
  { d: 14, title: "Lena's birthday", days: 1, color: '4' },
  { d: 16, t: '09:30', min: 120, title: 'Planning workshop', cal: 'work' },
  { d: 21, t: '20:00', min: 120, title: 'Board game night', color: '2' },
  { d: 25, t: '18:00', min: 60, title: 'Yoga class', color: '10' },
];

interface Tl { d: number; t?: string; est?: number; title: string; cat: string; tags?: string[]; items: [string, boolean][] }
const LISTS: Tl[] = [
  { d: 0, title: 'Groceries', cat: 'shopping', tags: ['weekly'], est: 45, items: [['Oat milk', true], ['Bread', true], ['Tomatoes', false], ['Pasta', false], ['Coffee beans', false]] },
  { d: 1, t: '17:00', title: 'Weekend chores', cat: 'home', est: 90, items: [['Vacuum the flat', false], ['Laundry', true], ['Water the plants', false], ['Take out the bins', false]] },
  { d: -3, title: 'Tax paperwork', cat: 'todo', tags: ['admin'], items: [['Collect receipts', true], ['Fill in the form', false], ['Send it off', false]] },
  { d: -1, title: 'Prepare Friday demo', cat: 'work', tags: ['demo'], est: 60, items: [['Update slides', true], ['Test the walkthrough', false], ['Book the room', false]] },
  { d: 8, title: 'Packing list: coast trip', cat: 'todo', tags: ['trip'], items: [['Swimwear', false], ['Charger', false], ['Sunscreen', false], ['Book', false], ['Rain jacket', false], ['Tickets', true]] },
  { d: 5, title: 'Birthday party shopping', cat: 'shopping', tags: ['party'], items: [['Balloons', false], ['Cake', false], ['Candles', false]] },
  { d: -7, title: 'Clear the inbox', cat: 'work', items: [['Reply to HR', true], ['Expense report', true], ['Archive old threads', true]] },
];

export async function seedDemo(cal: CalendarService, motivation: MotivationService, nowMs: number, tz: string): Promise<void> {
  const today = localDateOf(nowMs, tz);
  for (const e of EVENTS) {
    const date = addDays(today, e.d);
    const base = { calendarId: e.cal ?? 'primary', title: e.title, ...(e.loc ? { location: e.loc } : {}), ...(e.color ? { colorId: e.color } : {}) };
    if (e.t) {
      const [h, m] = e.t.split(':').map(Number) as [number, number];
      const end = h * 60 + m + (e.min ?? 60);
      const hh = (n: number) => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
      await cal.createEvent({ ...base, allDay: false, start: `${date}T${e.t}:00${offsetFor(date, e.t, tz)}`, end: `${date}T${hh(end)}:00${offsetFor(date, hh(end), tz)}` });
    } else {
      await cal.createEvent({ ...base, allDay: true, start: date, end: addDays(date, e.days ?? 1) });
    }
  }
  for (const l of LISTS) {
    await cal.createTaskList({
      title: l.title, date: addDays(today, l.d), time: l.t ?? null, categoryId: l.cat, tags: l.tags ?? [], estimateMinutes: l.est ?? null,
      items: l.items.map(([title, done]) => ({ title, done })),
    });
  }
  // History: a 6 day streak ending yesterday, a growing plant and a few sunflowers.
  motivation.setState({
    checkIns: [-14, -13, -12, -5, -4, -3, -2, -1].map((n) => addDays(today, n)),
    plant: { growth: 190, lastWatered: addDays(today, -1), todayPoints: 0 },
  });
}

import { formatInZone, zonedToUtc } from './lib/time.js';
function offsetFor(date: string, time: string, tz: string): string {
  return formatInZone(zonedToUtc(date, time, tz), tz).slice(-6);
}
