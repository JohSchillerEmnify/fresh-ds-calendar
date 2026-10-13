export type Mood = 'happy' | 'thirsty' | 'dry' | 'droopy';
export type StageName = 'Seed' | 'Sprout' | 'Small plant' | 'Leafy' | 'Flowering';

/** Mirrors spec/API.md `Motivation`. */
export interface Motivation {
  streak: { current: number; best: number; lastCheckIn: string | null; checkedInToday: boolean };
  plant: {
    growth: number;
    stage: StageName;
    stageIndex: 0 | 1 | 2 | 3 | 4;
    nextStageAt: number | null;
    todayPoints: number;
    lastWatered: string | null;
    flowers: number;
    vitality: 100 | 75 | 50 | 25;
    mood: Mood;
    message: string;
  };
}

export interface CheckInResult {
  current: number;
  best: number;
  checkedInToday: true;
  newToday: boolean;
  motivation: Motivation;
}

export type ChangeKind = 'water' | 'grow' | 'bloom' | 'perk-up';
/** Most flowers the Sunflower field shows (phones show half: {@link SUNFLOWER_MAX_PHONE}); the server caps `plant.flowers` at the same number. */
export const SUNFLOWER_MAX = 30;
export const SUNFLOWER_MAX_PHONE = 15;
export type SceneName = 'sunflowers' | 'mordor' | 'none' | 'spring' | 'summer' | 'fall' | 'winter' | 'halloween';
