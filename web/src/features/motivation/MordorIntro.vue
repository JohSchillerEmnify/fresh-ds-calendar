<script setup lang="ts">
import { computed } from 'vue';
import { useAnimationLevel } from '@/motion/level';
import MordorScene from './MordorScene.vue';
import { onceFlag } from './session';

/** Mordor scene; the eye opens with a flare once per session (Full only). Replaces the butterfly. */
const level = useAnimationLevel();
const intro = computed(() => level.value === 'full' && onceFlag('eye-open'));
</script>
<template><MordorScene :intro="intro" /></template>
