<template>
  <image
    class="voice-icon-img"
    :src="open ? VOICE_ON_SRC : VOICE_OFF_SRC"
    mode="aspectFit"
  />
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
}>();

/** SVG data URI：各端矢量一致，不依赖系统 emoji / CSS 三角拼图标 */
const VOICE_ON_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path fill="#e2e8f0" d="M3.5 9h2.8L11 4.8v14.4L6.3 15H3.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/><path stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round" d="M15.2 9.2a3.6 3.6 0 0 1 0 5.6"/></svg>`,
  );

const VOICE_OFF_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path fill="#e2e8f0" d="M3.5 9h2.8L11 4.8v14.4L6.3 15H3.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/><path stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round" d="M4.2 4.2l15.6 15.6"/></svg>`,
  );
</script>

<style scoped lang="scss">
.voice-icon-img {
  width: 44rpx;
  height: 44rpx;
  display: block;
}
</style>
