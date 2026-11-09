/** Shows a birthday once when two calendars hold it (feature birthdays). */
export function dedupeBirthdays<T extends object>(items: T[]): T[];
