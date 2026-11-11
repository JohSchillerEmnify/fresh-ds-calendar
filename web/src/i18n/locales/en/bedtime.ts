/** English messages of bedtime mode: the night band, the reminder and the settings section. */
export default {
  reminder: 'Bedtime in {count} minute | Bedtime in {count} minutes',
  moon: 'Bedtime {time}',
  notification: 'Bedtime at {time}',
  sun: 'Wake-up {time}',
  settings: {
    on: { label: 'Bedtime mode', hint: 'Shows the night in the calendar views and reminds you before bedtime' },
    mode: { label: 'Bedtime is', fixed: 'Fixed times', dynamic: 'Based on my first appointment' },
    bedtime: 'Bedtime',
    wake: 'Wake-up',
    weekend: { label: 'Different on weekends', hint: 'For the nights before Saturday and Sunday' },
    weekendBedtime: 'Weekend bedtime',
    weekendWake: 'Weekend wake-up',
    dynamicHint: 'If your first appointment the next day is early, bedtime moves earlier to match. Otherwise the fixed times apply.',
    sleep: { label: 'Sleep duration', hours: '{count} hour | {count} hours' },
    lead: { label: 'Time before the first appointment', minutes: '{count} min', none: 'None' },
    reminder: { label: 'Remind me before bedtime', minutes: '{count} min', off: 'Off' },
  },
  runway: {
    header: '{left} until bed · {free} free',
    now: 'Now {time}',
    bed: 'Bed {time}',
    off: 'Bedtime is off — set it in the settings',
    passed: 'Bedtime was at {time}',
    openSettings: 'Open settings',
  },
};
