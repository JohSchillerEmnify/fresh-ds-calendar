import path from 'node:path';
import type { CheckInResponse, Motivation, PlantMood, PlantStage } from '../api/types.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import type { Clock } from '../lib/clock.js';
import { diffDays, localDateOf } from '../lib/time.js';

export const DAILY_CAP = 30;
export const POINTS = { checkin: 10, create: 5, tick: 2 } as const;
export type AwardKind = keyof typeof POINTS;
export const STAGES: { name: PlantStage; at: number }[] = [
  { name: 'Seed', at: 0 }, { name: 'Sprout', at: 20 }, { name: 'Small plant', at: 60 }, { name: 'Leafy', at: 140 }, { name: 'Flowering', at: 280 },
];
export const MESSAGES: Record<PlantMood, string> = {
  happy: 'Your plant is happy',
  thirsty: 'Your plant is a little thirsty',
  dry: 'Your plant could use some water',
  droopy: 'Your plant is resting. Anything you do will perk it up.',
};

interface State {
  checkIns: string[];          // most recent 400 distinct dates
  current: number;
  best: number;
  lastCheckIn: string | null;
  growth: number;
  todayPoints: number;
  pointsDate: string | null;   // date todayPoints / ticked refer to
  ticked: string[];            // item ids that earned points on pointsDate
  lastWatered: string | null;
}

const empty = (): State => ({ checkIns: [], current: 0, best: 0, lastCheckIn: null, growth: 0, todayPoints: 0, pointsDate: null, ticked: [], lastWatered: null });

/** Pure plant view from state + today (unit-tested with fixed dates). */
export function plantView(growth: number, todayPoints: number, lastWatered: string | null, today: string): Motivation['plant'] {
  let stageIndex = 0;
  STAGES.forEach((s, i) => { if (growth >= s.at) stageIndex = i; });
  const d = lastWatered ? Math.max(0, diffDays(lastWatered, today)) : 0;
  const mood: PlantMood = d <= 1 ? 'happy' : d === 2 ? 'thirsty' : d === 3 ? 'dry' : 'droopy';
  const vitality = ({ happy: 100, thirsty: 75, dry: 50, droopy: 25 } as const)[mood];
  return {
    growth,
    stage: STAGES[stageIndex]!.name,
    stageIndex: stageIndex as 0 | 1 | 2 | 3 | 4,
    nextStageAt: STAGES[stageIndex + 1]?.at ?? null,
    todayPoints,
    lastWatered,
    flowers: Math.min(30, Math.floor(growth / 40)),
    vitality,
    mood,
    message: MESSAGES[mood],
  };
}

export function runs(dates: string[]): { current: number; best: number } {
  const sorted = [...new Set(dates)].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current: run, best };
}

export class MotivationService {
  private st!: State;
  /** Increments whenever points were awarded (drives the X-Motivation-Changed header). */
  rev = 0;
  private readonly file: string | null;

  constructor(dataDir: string | null, private readonly clock: Clock, private readonly tz: string) {
    this.file = dataDir ? path.join(dataDir, 'motivation.json') : null;
    this.reload();
  }

  /** Reads the file again (start, and after a backup restore replaced it). */
  reload(): void {
    this.st = { ...empty(), ...(this.file ? readJson<Partial<State>>(this.file) : null) };
  }

  today(): string {
    return localDateOf(this.clock.nowMs(), this.tz);
  }

  private save(): void {
    if (this.file) writeJsonAtomic(this.file, this.st);
  }

  private rollDay(today: string): void {
    if (this.st.pointsDate !== today) {
      this.st.pointsDate = today;
      this.st.todayPoints = 0;
      this.st.ticked = [];
    }
  }

  get(): Motivation {
    const today = this.today();
    const s = this.st;
    return {
      streak: { current: s.current, best: s.best, lastCheckIn: s.lastCheckIn, checkedInToday: s.lastCheckIn === today },
      plant: plantView(s.growth, s.pointsDate === today ? s.todayPoints : 0, s.lastWatered, today),
    };
  }

  /** Returns true when the action counted (plant watered), false for repeated ticks of the same item. */
  award(kind: AwardKind, key?: string): boolean {
    const today = this.today();
    this.rollDay(today);
    const s = this.st;
    if (kind === 'tick') {
      if (!key || s.ticked.includes(key)) return false;
      s.ticked.push(key);
    }
    const add = Math.max(0, Math.min(POINTS[kind], DAILY_CAP - s.todayPoints));
    s.todayPoints += add;
    s.growth += add;
    s.lastWatered = today;
    this.rev++;
    this.save();
    return true;
  }

  checkIn(): CheckInResponse {
    const today = this.today();
    const s = this.st;
    let newToday = false;
    if (s.lastCheckIn !== today) {
      newToday = true;
      s.current = s.lastCheckIn && diffDays(s.lastCheckIn, today) === 1 ? s.current + 1 : 1;
      s.best = Math.max(s.best, s.current);
      s.lastCheckIn = today;
      s.checkIns = [...s.checkIns, today].slice(-400);
      this.award('checkin');
    }
    return { current: s.current, best: s.best, checkedInToday: true, newToday, motivation: this.get() };
  }

  /** Test hook (API.md `/api/__test/motivation`). */
  setState(input: { checkIns?: string[]; plant?: { growth: number; lastWatered: string | null; todayPoints?: number } }): Motivation {
    const s = this.st;
    if (input.checkIns) {
      const dates = [...new Set(input.checkIns)].sort();
      const r = runs(dates);
      s.checkIns = dates.slice(-400);
      s.lastCheckIn = dates.at(-1) ?? null;
      s.current = r.current;
      s.best = r.best;
      if (!dates.length) { s.current = 0; s.best = 0; }
    }
    if (input.plant) {
      s.growth = input.plant.growth;
      s.lastWatered = input.plant.lastWatered;
      s.todayPoints = input.plant.todayPoints ?? 0;
      s.pointsDate = this.today();
      s.ticked = [];
    }
    this.save();
    return this.get();
  }

  reset(): void {
    this.st = empty();
    this.save();
  }
}
