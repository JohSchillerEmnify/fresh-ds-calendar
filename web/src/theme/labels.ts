/**
 * Display names of the theme things that are stored or compared by their English name (presets, holidays, seeds, the
 * Google event colours). The English name stays the identity; only what a person reads goes through `t()`.
 */
import type { NamedColor } from '@/api/colors';
import { t, type MessageKey } from '@/i18n';
import type { CalendarPreset, PresetName } from './presets';

/** Catalogue key of each preset (and season / holiday) name. */
const PRESET_KEYS: Record<PresetName, MessageKey> = {
  Default: 'theme.preset.default', Neon: 'theme.preset.neon', Spring: 'theme.preset.spring', Easter: 'theme.preset.easter',
  Summer: 'theme.preset.summer', 'Summer holidays': 'theme.preset.summerHolidays', Fall: 'theme.preset.fall', Halloween: 'theme.preset.halloween',
  Christmas: 'theme.preset.christmas', 'New Year\'s Eve': 'theme.preset.newYearsEve', 'New Year': 'theme.preset.newYear', Winter: 'theme.preset.winter',
  Mordor: 'theme.preset.mordor',
};

/** The name of a preset, season or holiday in the active language. */
export function presetLabel(name: PresetName | CalendarPreset): string {
  return t(PRESET_KEYS[name]);
}

/** The name of a built-in preset in the active language; an imported theme keeps its own name. */
export function themeLabel(name: string): string {
  return name in PRESET_KEYS ? presetLabel(name as PresetName) : name;
}

const SEED_KEYS: Record<string, MessageKey> = {
  Blue: 'theme.seedColor.blue', Purple: 'theme.seedColor.purple', Teal: 'theme.seedColor.teal', Green: 'theme.seedColor.green',
  Orange: 'theme.seedColor.orange', Red: 'theme.seedColor.red', Pink: 'theme.seedColor.pink', Slate: 'theme.seedColor.slate',
};

/** The name of a seed colour preset in the active language. */
export function seedLabel(name: string): string {
  return SEED_KEYS[name] ? t(SEED_KEYS[name]) : name;
}

const GOOGLE_KEYS: Record<string, MessageKey> = {
  '1': 'theme.googleColor.lavender', '2': 'theme.googleColor.sage', '3': 'theme.googleColor.grape', '4': 'theme.googleColor.flamingo',
  '5': 'theme.googleColor.banana', '6': 'theme.googleColor.tangerine', '7': 'theme.googleColor.peacock', '8': 'theme.googleColor.graphite',
  '9': 'theme.googleColor.blueberry', '10': 'theme.googleColor.basil', '11': 'theme.googleColor.tomato',
};

/** The name of a Google event colour in the active language. */
export function googleColorLabel(c: NamedColor): string {
  return GOOGLE_KEYS[c.id] ? t(GOOGLE_KEYS[c.id]) : c.name;
}
