/** Form helpers: field lookup by table name, fill and read by control kind. */
import { expect, type Locator } from '@playwright/test';
import { chooseOption, selectedLabel } from './ui.js';

export type FieldKind = 'text' | 'checkbox' | 'choice';

export function field(scope: Locator, fields: Record<string, string>, name: string): Locator {
  const id = fields[name];
  if (!id) throw new Error(`Unknown form field "${name}" (known: ${Object.keys(fields).join(', ')})`);
  return scope.getByTestId(id);
}

/** Fill one field; select/radio/checkbox fields are handled by their kind. Not-visible fields are an error. */
export async function fillField(control: Locator, kind: FieldKind, value: string) {
  await expect(control, 'field must be visible to be filled').toBeVisible();
  if (kind === 'checkbox') await control.setChecked(value === 'yes');
  else if (kind === 'choice') await chooseOption(control, value);
  else await control.fill(value);
}

export async function readField(control: Locator, kind: FieldKind): Promise<string> {
  if (kind === 'checkbox') return (await control.isChecked()) ? 'yes' : 'no';
  if (kind === 'choice') return selectedLabel(control);
  return control.inputValue();
}

