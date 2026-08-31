<template>
  <image
    class="replay-play-icon"
    :src="playing ? PAUSE_SRC : PLAY_SRC"
    mode="aspectFit"
  />
</template>

<script setup lang="ts">
defineProps<{
  playing: boolean;
}>();

/** 与 VoiceToggleIcon 同系扁平 SVG，避免各端 emoji 彩色 3D 样式 */
const PLAY_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path fill="#e2e8f0" d="M8 5.8v12.4c0 .9 1 .4 1.5-.2l7.2-6c.5-.5.5-1.3 0-1.8l-7.2-6c-.5-.6-1.5-1.1-1.5-.2z"/></svg>`,
  );

const PAUSE_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path fill="#e2e8f0" d="M7.5 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6 0h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>`,
  );
</script>

<style scoped lang="scss">
.replay-play-icon {
  width: 44rpx;
  height: 44rpx;
  display: block;
}
</style>
