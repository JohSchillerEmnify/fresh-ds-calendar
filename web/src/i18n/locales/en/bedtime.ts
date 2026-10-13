/** English messages of bedtime mode: the night band, the reminder and the settings section. */
export default {
  reminder: 'Bedtime in {count} minute | Bedtime in {count} minutes',
  moon: 'Bedtime {time}',
  sun: 'Wake-up {time}',
  settings: {
    on: { label: 'Bedtime mode', hint: 'Shows the night in the calendar views and reminds you before bedtime' },
    mode: { label: 'Bedtime is', fixed: 'Fixed times', dynamic: 'Based on my first appointment' },
    bedtime: 'Bedtime',
    wake: 'Wake-up',
    weekend: { label: 'Different on weekends', hint: 'For the nights before Saturday and Sunday' },
    weekendBedtime: 'Weekend bedtime',
    weekendWake: 'Weekend wake-up',
    dynamicHint: 'Your first appointment of the next day can only move bedtime earlier than the fixed times. Without a timed appointment the fixed times apply.',
    sleep: { label: 'Sleep duration', hours: '{count} hour | {count} hours' },
    lead: { label: 'Time before the first appointment', minutes: '{count} min', none: 'None' },
    reminder: { label: 'Remind me before bedtime', minutes: '{count} min', off: 'Off' },
  },
};
