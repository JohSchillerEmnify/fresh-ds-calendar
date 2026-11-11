/** Shows a birthday once when two sources hold it (features birthdays, contact-birthdays). */
export function dedupeBirthdays<T extends object>(items: T[]): T[];
export function birthdayContactKey(resourceName: string, kind: string, date: string): string;
export function birthdayTitleKey(title: string, date: string): string;
/** The day a yearly date falls on in `year` (29 February: the last day of February in years without one). */
export function yearlyDate(year: number, month: number, day: number): string;
/** The age a birthday with a known birth year turns on `date`. */
export function ageOn(birthYear: number, date: string): number;
