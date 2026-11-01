/** "Duplicate" / "Copy": an open, undated copy of a list appears in Open (feature tasks-archive, tasklist-editing); the original stays. */
import { ApiError } from '@/api/client';
import type { TaskList } from '@/api/types';
import { t } from '@/i18n';
import { neutralName } from '@/lib/items';
import { useOutboxStore } from '@/stores/outbox';
import { useUiStore } from '@/stores/ui';
import { copyOf } from './archive';

/** Creates the copy and tells the person; a refusal shows its message. */
export function duplicateList(l: TaskList, categoriesOn: boolean): void {
  const ui = useUiStore();
  try {
    useOutboxStore().createList(copyOf(l, categoriesOn));
    ui.notify(t('tasks.archive.copyCreated', { title: neutralName(l) }));
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('tasks.archive.copyFailed'));
  }
}
