<template>
  <view class="menu-icon">
    <image class="menu-icon-img" :src="iconSrc" mode="aspectFit" />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  type: "categories" | "favorites" | "review" | "folders";
}>();

/** 与讲解页 VoiceToggleIcon 同系：扁平 SVG + 牌桌绿 accent */
const STROKE = "#86efac";

function svg(body: string): string {
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">${body}</svg>`,
    )
  );
}

const ICONS: Record<typeof props.type, string> = {
  categories: svg(
    `<rect x="4" y="4" width="7" height="7" rx="1.5" stroke="${STROKE}" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="${STROKE}" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="${STROKE}" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="${STROKE}" stroke-width="1.8"/>`,
  ),
  favorites: svg(
    `<path d="M12 4.2l1.9 3.8 4.2.6-3 3 0.7 4.2L12 14.4 7.2 16l0.7-4.2-3-3 4.2-0.6L12 4.2z" stroke="${STROKE}" stroke-width="1.8" stroke-linejoin="round"/>`,
  ),
  review: svg(
    `<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="${STROKE}" stroke-width="1.8"/><path d="M8 9h8M8 12.5h8M8 16h5" stroke="${STROKE}" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
  folders: svg(
    `<path d="M4 7.5V18a1.5 1.5 0 0 0 1.5 1.5H18a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5h-5.2L10.4 5.5H5.5A1.5 1.5 0 0 0 4 7v0.5z" stroke="${STROKE}" stroke-width="1.8" stroke-linejoin="round"/>`,
  ),
};

const iconSrc = computed(() => ICONS[props.type]);
</script>

<style scoped lang="scss">
.menu-icon {
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.menu-icon-img {
  width: 40rpx;
  height: 40rpx;
  display: block;
}
</style>
