/** Custom Cucumber parameter types (spec/STEPS.md "Parameter types"). */
import { defineParameterType } from 'playwright-bdd';
import { WEEKDAYS, type Weekday } from './support/dates.js';

export type View = 'year' | 'month' | 'week' | 'day';
export type Scheme = 'light' | 'dark';

defineParameterType({ name: 'date', regexp: /\d{4}-\d{2}-\d{2}/, transformer: (s) => s });
defineParameterType({ name: 'month', regexp: /\d{4}-\d{2}/, transformer: (s) => s });
defineParameterType({ name: 'time', regexp: /\d{2}:\d{2}/, transformer: (s) => s });
defineParameterType({ name: 'view', regexp: /year|month|week|day/, transformer: (s) => s as View });
defineParameterType({ name: 'scheme', regexp: /light|dark/, transformer: (s) => s as Scheme });
defineParameterType({
  name: 'weekday',
  regexp: new RegExp(`"(${WEEKDAYS.join('|')})"`),
  transformer: (s) => s as Weekday,
});
/** `A`, `A and B`, `A, B and C` -> string[] */
defineParameterType({
  name: 'datelist',
  regexp: /\d{4}-\d{2}-\d{2}(?:(?:, | and )\d{4}-\d{2}-\d{2})*/,
  transformer: (s) => s.split(/, | and /),
});
