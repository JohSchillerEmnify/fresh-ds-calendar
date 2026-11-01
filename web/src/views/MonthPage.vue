<script setup lang="ts">
/** The month route: the sideways `MonthView`, or the `MonthScroller` list when "Month view scrolls" is up and down. */
import MonthScroller from '@/views/MonthScroller.vue';
import MonthView from '@/views/MonthView.vue';
import { usePrefsStore } from '@/stores/prefs';

const labs = usePrefsStore();
</script>

<template>
  <MonthView v-if="labs.monthScroll === 'sideways'" />
  <MonthScroller v-else :mode="labs.monthScroll" />
</template>
