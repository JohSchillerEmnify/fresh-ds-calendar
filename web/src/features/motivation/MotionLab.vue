<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { setAnimationSetting, useAnimationLevel, type MotionLevel } from '@/motion/level';
import { RewardCheckbox, ProgressRing, useCelebrate, useDraggable, createSlotGrid, createCellGrid, springs } from '@/motion';
import { spawnBling, spawnConfetti, spawnDroplets, spawnSparkle } from '@/motion/effects';
import { setSoundsEnabled } from '@/motion/sound';
import StreakFlame from './StreakFlame.vue';
import StreakToast from './StreakToast.vue';
import Plant from './Plant.vue';
import PlantCard from './PlantCard.vue';
import TopBarScene from './TopBarScene.vue';
import { __resetOnce } from './session';
import type { ChangeKind, Mood, SceneName } from './types';

/** Dev playground (mounted at /lab by the shell, or standalone). No network. Not part of the product UI. */
const level = useAnimationLevel();
const scene = ref<SceneName>('sunflowers');
const dark = ref(false);
const sounds = ref(false);
watch(sounds, (v) => setSoundsEnabled(v));
watch(dark, (v) => document.documentElement.setAttribute('data-theme', v ? 'dark' : 'light'), { immediate: true });
const lv = ref<MotionLevel>('full');
watch(lv, (v) => setAnimationSetting(v));

const streak = ref(3);
const pulse = ref(0);
const message = ref<{ id: number; text: string } | null>(null);
const stage = ref<0 | 1 | 2 | 3 | 4>(2);
const mood = ref<Mood>('happy');
const flowers = ref(6);
const change = ref<{ id: number; kinds: ChangeKind[] } | null>(null);
const cardOpen = ref(false);
let seq = 0;
const fire = (...kinds: ChangeKind[]) => (change.value = { id: ++seq, kinds });
function checkIn() {
  streak.value++;
  pulse.value++;
  message.value = { id: ++seq, text: `Checked in, day ${streak.value}` };
}
function water() {
  if (mood.value !== 'happy') { mood.value = 'happy'; fire('water', 'perk-up'); } else fire('water');
}
function growStage() {
  stage.value = (((stage.value + 1) % 5) as 0 | 1 | 2 | 3 | 4);
  fire('water', 'grow');
}
function bloom() { flowers.value = Math.min(30, flowers.value + 1); fire('water', 'bloom'); }
const MOODS: Mood[] = ['happy', 'thirsty', 'dry', 'droopy'];
function nextMood() { mood.value = MOODS[(MOODS.indexOf(mood.value) + 1) % 4]; }
const sceneKey = ref(0);
function replayScene() { __resetOnce(); sceneKey.value++; }

// ---- task list card
const items = reactive([{ t: 'Milk', d: false }, { t: 'Eggs', d: false }, { t: 'Bread', d: true }]);
const card = ref<HTMLElement | null>(null);
const { celebrate } = useCelebrate(card);
const done = computed(() => items.filter((i) => i.d).length);
function tick(i: { d: boolean }, v: boolean) {
  const before = done.value;
  i.d = v;
  if (v && before < items.length && done.value === items.length) nextTick(celebrate);
}
function resetItems() { items.forEach((i, n) => (i.d = n === 2)); }

// ---- drag and drop: week-ish slot grid
const HOUR = 36;
const cols = ['Mon', 'Tue', 'Wed'];
const ev = reactive({ day: 1, min: 9 * 60, label: 'Dentist', failNext: false });
const grid = ref<HTMLElement | null>(null);
const evEl = ref<HTMLElement | null>(null);
const slotHit = createSlotGrid({ rect: () => grid.value?.getBoundingClientRect() ?? null, columns: 3, pxPerMinute: HOUR / 60, gutter: 30, startMinutes: 480 });
const hover = ref<{ column: number; minutes: number } | null>(null);
const log = ref('');
useDraggable(evEl, {
  hitTest: slotHit,
  onTarget: (t) => (hover.value = (t?.key as { column: number; minutes: number }) ?? null),
  onDrop: async (t) => {
    const k = t.key as { column: number; minutes: number };
    const prev = { day: ev.day, min: ev.min };
    ev.day = k.column; ev.min = k.minutes;
    hover.value = null;
    await new Promise((r) => setTimeout(r, 250));
    if (ev.failNext) { ev.failNext = false; ev.day = prev.day; ev.min = prev.min; log.value = 'save failed, sprang back'; throw new Error('409'); }
    log.value = `saved ${cols[ev.day]} ${String(Math.floor(ev.min / 60)).padStart(2, '0')}:${String(ev.min % 60).padStart(2, '0')}`;
  },
});

// ---- month cells
const days = Array.from({ length: 14 }, (_, i) => i + 1);
const chipDay = ref(3);
const chip = ref<HTMLElement | null>(null);
const cellsRoot = ref<HTMLElement | null>(null);
useDraggable(chip, {
  hitTest: createCellGrid({ cells: () => [...(cellsRoot.value?.querySelectorAll('.lab-cell') ?? [])].map((el) => ({ el, key: Number((el as HTMLElement).dataset.day) })) }),
  onDrop: (t) => { chipDay.value = t.key as number; },
});
</script>

<template>
  <div class="lab" data-testid="motion-lab">
    <header class="bar">
      <TopBarScene :key="sceneKey" :scene="scene" :flowers="flowers" :mood="mood" :change="change" />
      <div class="bar-in">
        <StreakFlame :count="streak" :pulse="pulse" />
        <div class="pbtn-wrap">
          <button class="pbtn" data-testid="plant-button" :data-stage="stage" :data-mood="mood" @click="cardOpen = !cardOpen">
            <Plant :stage="stage" :mood="mood" :size="30" :change="change" />
          </button>
          <PlantCard v-if="cardOpen" :plant="{ growth: 70, stage: ['Seed','Sprout','Small plant','Leafy','Flowering'][stage] as any, stageIndex: stage, nextStageAt: 140, todayPoints: 12, lastWatered: null, flowers, vitality: 100, mood, message: 'Your plant is happy' }" :change="change" @close="cardOpen = false" />
        </div>
        <h1>October 2026</h1>
      </div>
    </header>
    <StreakToast :message="message" />

    <section class="ctl">
      <div class="row">
        <button v-for="s in ['sunflowers', 'mordor', 'none'] as SceneName[]" :key="s" :data-testid="`pick-${s}`" :aria-pressed="scene === s" @click="scene = s">{{ s }}</button>
        <button data-testid="replay" @click="replayScene">replay intro</button>
      </div>
      <div class="row">
        <label>anim <select v-model="lv" data-testid="level"><option>full</option><option>reduced</option><option>off</option></select></label>
        <label><input v-model="dark" type="checkbox" /> dark</label>
        <label><input v-model="sounds" type="checkbox" /> sound</label>
        <span class="muted">effective: {{ level }}</span>
      </div>
      <div class="row">
        <button data-testid="b-checkin" @click="checkIn">check-in</button>
        <button data-testid="b-water" @click="water">water</button>
        <button data-testid="b-grow" @click="growStage">grow</button>
        <button data-testid="b-bloom" @click="bloom">bloom</button>
        <button data-testid="b-mood" @click="nextMood">mood: {{ mood }}</button>
        <button data-testid="b-sparkle" @click="spawnSparkle({ x: 60, y: 300 })">sparkle</button>
        <button data-testid="b-confetti" @click="spawnConfetti({ x: 187, y: 360 })">confetti</button>
        <button data-testid="b-bling" @click="spawnBling({ x: 100, y: 300 })">bling</button>
        <button data-testid="b-drops" @click="spawnDroplets({ x: 100, y: 300 })">drops</button>
      </div>
    </section>

    <section ref="card" class="card" data-testid="lab-card">
      <div class="card-h"><b>Groceries</b><ProgressRing :done="done" :total="items.length" /> <span class="muted">{{ done }}/{{ items.length }}</span>
        <button class="small" @click="resetItems">reset</button></div>
      <RewardCheckbox v-for="i in items" :key="i.t" :model-value="i.d" :label="i.t" @update:model-value="(v) => tick(i, v)" />
      <p v-if="done === items.length" class="muted" data-testid="tasklist-complete-message">All done! 🎉</p>
    </section>

    <section class="card">
      <b>Drag the event (long-press on touch)</b>
      <label class="muted"><input v-model="ev.failNext" type="checkbox" data-testid="fail-next" /> next drop fails</label>
      <div ref="grid" class="grid" :style="{ height: HOUR * 5 + 'px' }" data-testid="lab-grid">
        <div v-for="(c, i) in cols" :key="c" class="gcol" :style="{ left: `calc(30px + ${i} * (100% - 30px) / 3)`, width: 'calc((100% - 30px) / 3)' }">{{ c }}</div>
        <div v-for="h in 5" :key="h" class="gline" :style="{ top: (h - 1) * HOUR + 'px' }">{{ 8 + h - 1 }}</div>
        <div
          v-if="hover"
          class="ind"
          :style="{ left: `calc(30px + ${hover.column} * (100% - 30px) / 3)`, width: 'calc((100% - 30px) / 3)', top: (hover.minutes - 8 * 60) * HOUR / 60 + 'px', height: HOUR + 'px' }"
        />
        <div
          ref="evEl"
          class="ev"
          data-testid="lab-event"
          :style="{ left: `calc(30px + ${ev.day} * (100% - 30px) / 3 + 2px)`, width: 'calc((100% - 30px) / 3 - 4px)', top: (ev.min - 8 * 60) * HOUR / 60 + 'px', height: HOUR + 'px' }"
        >{{ ev.label }}</div>
      </div>
      <p class="muted" data-testid="lab-log">{{ log }}</p>
    </section>

    <section class="card">
      <b>Month cells</b>
      <div ref="cellsRoot" class="cells">
        <div v-for="d in days" :key="d" class="lab-cell" :data-day="d">{{ d }}<div v-if="chipDay === d" :ref="(el) => (chip = el as HTMLElement | null)" class="chip" data-testid="lab-chip">Trip</div></div>
      </div>
    </section>
    <div style="height: 80px" />
  </div>
</template>

<style scoped>
.lab { max-width: 480px; margin: 0 auto; background: var(--md-sys-color-surface, #fef7ff); color: var(--md-sys-color-on-surface, #1d1b20); min-height: 100vh; font: 14px/1.4 system-ui, sans-serif; padding-bottom: 20px; }
.bar { position: sticky; top: 0; z-index: 20; height: 60px; background: var(--md-sys-color-surface-container, #f3edf7); overflow: visible; }
.bar > :first-child { z-index: 0; }
.bar-in { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; height: 100%; padding: 0 12px; }
.bar h1 { font: 600 1.15rem system-ui; margin: 0; }
.pbtn-wrap { position: relative; }
.pbtn { border: 0; background: transparent; padding: 4px; border-radius: 50%; }
.ctl { padding: 10px 12px; display: grid; gap: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
button { border: 1px solid var(--md-sys-color-outline-variant, #cac4d0); background: var(--md-sys-color-surface-container-low, #f7f2fa); color: inherit; border-radius: 999px; padding: 6px 12px; font: inherit; }
button[aria-pressed='true'] { background: var(--md-sys-color-secondary-container, #e8def8); }
.small { padding: 2px 10px; margin-left: auto; }
.muted { color: var(--md-sys-color-on-surface-variant, #49454f); font-size: 0.8rem; }
.card { margin: 10px 12px; padding: 12px 14px; border-radius: 20px; background: var(--md-sys-color-surface-container-low, #f7f2fa); display: grid; gap: 2px; touch-action: pan-y; }
.card-h { display: flex; align-items: center; gap: 8px; }
.grid { position: relative; margin-top: 6px; border-top: 1px solid var(--md-sys-color-outline-variant, #cac4d0); }
.gcol { position: absolute; top: -18px; text-align: center; font-size: 11px; color: var(--md-sys-color-on-surface-variant); }
.gline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--md-sys-color-outline-variant, #cac4d0); font-size: 10px; color: var(--md-sys-color-on-surface-variant); opacity: 0.8; }
.ind { position: absolute; border-radius: 8px; border: 2px dashed var(--md-sys-color-primary, #6750a4); opacity: 0.7; }
.ev { position: absolute; border-radius: 8px; background: var(--md-sys-color-primary-container, #eaddff); color: var(--md-sys-color-on-primary-container, #21005d); padding: 4px 8px; font-weight: 600; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.cells { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-top: 6px; }
.lab-cell { min-height: 46px; border-radius: 8px; background: var(--md-sys-color-surface-container-highest, #e6e0e9); padding: 2px 4px; font-size: 11px; }
.chip { margin-top: 2px; border-radius: 6px; background: var(--md-sys-color-tertiary-container, #ffd8e4); padding: 1px 4px; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
</style>
