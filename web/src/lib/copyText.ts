/**
 * Copy text to the clipboard. The async Clipboard API exists only in secure contexts (https or localhost); the
 * self-hosted app is served over plain http on the LAN, so there the text is selected in its field and copied with the
 * legacy copy command.
 */
export async function copyText(text: string, field: HTMLTextAreaElement | null): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall through to the legacy copy */ }
  }
  if (!field) return false;
  field.focus();
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}
