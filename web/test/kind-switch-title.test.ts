/** The title carried over by the new-dialog kind switch counts as unsaved input and is clamped to the task list limit. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { TITLE_MAX } from '@calendar/shared/limits';
import EventDialog from '@/features/calendar/EventDialog.vue';
import TaskListDialog from '@/features/tasklists/TaskListDialog.vue';
import { freshPinia, mockFetch } from './helpers';

vi.hoisted(() => {
  globalThis.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof matchMedia;
});

/** Whether the open sheet lets a tap on the scrim close it (false = it holds unsaved input). */
const scrimCloses = (w: ReturnType<typeof mount>) => w.findComponent({ name: 'AdaptiveSheet' }).props('dismissOnScrim');

describe('a title carried by the kind switch', () => {
  beforeEach(() => { freshPinia(); mockFetch({}); });

  it('makes the event dialog dirty, an untitled one is not', async () => {
    const carried = mount(EventDialog, { props: { mode: 'create', date: '2026-10-12', title: 'Dentist' }, attachTo: document.body });
    const plain = mount(EventDialog, { props: { mode: 'create', date: '2026-10-12' }, attachTo: document.body });
    await flushPromises();
    expect(scrimCloses(carried)).toBe(false);
    expect(scrimCloses(plain)).toBe(true);
  });

  it('makes the task list dialog hold its input and clamps it to the title limit', async () => {
    const carried = mount(TaskListDialog, { props: { mode: 'create', date: '2026-10-12', title: 'x'.repeat(TITLE_MAX + 5) }, attachTo: document.body });
    await flushPromises();
    expect(scrimCloses(carried)).toBe(false);
    expect((document.querySelector('[data-testid=tasklist-title]') as HTMLInputElement).value).toHaveLength(TITLE_MAX);
  });
});
