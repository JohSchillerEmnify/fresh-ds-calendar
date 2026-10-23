/** Goldens of the task list view (`TaskListView`): a picked-up item dragged over two others sits in a gap between them. */
import { test } from 'vitest';
import TaskListView from '@/features/tasklists/TaskListView.vue';
import { golden, list } from './golden';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Dispatches a primary mouse pointer event the drag controller listens for. */
const fire = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));

/** Picks up "Bread" by its grip and holds it over the border between "Milk" and "Eggs"; returns the cancelling cleanup. */
async function holdBreadBetweenMilkAndEggs(container: HTMLElement): Promise<() => void> {
  const row = (title: string) => container.querySelector<HTMLElement>(`[data-testid="tasklist-item"][data-title="${title}"]`)!;
  const grip = row('Bread').querySelector<HTMLElement>('[data-item-grip]')!;
  const g = grip.getBoundingClientRect();
  const x = g.left + g.width / 2;
  fire(grip, 'pointerdown', x, g.top + g.height / 2);
  // the pointer rests in the lower half of "Eggs" - no: just over the upper half of "Eggs", the place right after "Milk"
  const eggs = row('Eggs').getBoundingClientRect();
  const y = eggs.top + 6;
  fire(window, 'pointermove', x, g.top + g.height / 2 - 12);
  for (let i = 1; i <= 10; i++) fire(window, 'pointermove', x, g.top + g.height / 2 + (y - g.top - g.height / 2) * (i / 10));
  // the lifted card follows the pointer by spring, the rows glide for 150 ms: let both come to rest
  await sleep(600);
  // rest means the lifted card's rect is the same over 12 frames in a row, however loaded the machine is
  let last = '', still = 0;
  for (let n = 0; n < 400 && still < 12; n++) {
    await frames();
    const b = row('Bread').getBoundingClientRect(), k = `${b.top}|${b.left}|${b.width}`;
    still = k === last ? still + 1 : 0;
    last = k;
  }
  // the compositor re-rasterises a will-change layer's text at its final scale at an arbitrary moment: do it now
  row('Bread').style.willChange = 'auto';
  await sleep(300);
  await frames();
  return () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

test('TaskListView: a picked-up item lies in a gap between the two items it was dragged over', () => golden('view-drag', [
  { key: 'dragging', component: TaskListView, props: { id: 'l1', list: list() }, w: 360 },
], undefined, holdBreadBetweenMilkAndEggs));
