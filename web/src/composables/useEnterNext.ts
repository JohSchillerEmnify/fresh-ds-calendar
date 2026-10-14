/**
 * Enter-moves-to-the-next-field behaviour for form dialogs: Enter in a single-line field never submits the form,
 * it focuses the next text-like field (scrolled above the soft keyboard) or, on the last one, closes the keyboard.
 * Saving stays with the explicit Save button.
 */

/** Input types that take typed or picked text (checkboxes, radios and buttons are not Enter targets). */
const FIELD_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'number', 'password', 'date', 'time', 'datetime-local']);

/** Whether `el` is a single-line field that Enter should hand over from. */
const isSingleLine = (el: EventTarget | null): el is HTMLInputElement => el instanceof HTMLInputElement && FIELD_TYPES.has(el.type);

/** Whether `el` can receive focus as the next field. */
const isFocusable = (el: HTMLInputElement | HTMLTextAreaElement) => !el.disabled && !el.readOnly;

/** Keydown handler for a `<form>`: Enter in a single-line field focuses the next field instead of submitting. */
export function enterNext(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing || !isSingleLine(e.target)) return;
  // Stops the implicit form submission (also for Ctrl/Cmd+Enter: there is no save shortcut).
  e.preventDefault();
  const current = e.target;
  const fields = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')]
    .filter((el) => el === current || (isFocusable(el) && (el instanceof HTMLTextAreaElement || FIELD_TYPES.has(el.type))));
  const next = fields[fields.indexOf(current) + 1];
  if (!next) { current.blur(); return; }
  next.focus();
  next.scrollIntoView({ block: 'center' });
}
