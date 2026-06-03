<template>
  <view
    class="pc"
    :class="[size, { back: !parsed, red: parsed?.red, highlight }]"
  >
    <view v-if="parsed" class="pc-face">
      <text class="pc-rank">{{ parsed.rank }}</text>
      <text class="pc-suit">{{ parsed.suitChar }}</text>
    </view>
    <text v-else class="pc-q">?</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { parseCardCode } from "@/utils/cards";

const props = withDefaults(
  defineProps<{
    code?: string | null;
    size?: "lg" | "sm" | "xl";
    /** 发公牌等场景高亮 */
    highlight?: boolean;
  }>(),
  { code: null, size: "lg", highlight: false },
);

const parsed = computed(() => parseCardCode(props.code ?? null));
</script>

<style lang="scss" scoped>
.pc {
  position: relative;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
  overflow: hidden;
}

/* 公牌：5:7；小程序对 aspect-ratio 支持不稳定，用固定高宽 */
.pc.lg {
  flex: 1 1 0;
  min-width: 56rpx;
  max-width: 72rpx;
  width: 64rpx;
  height: 90rpx;
  border-radius: 10rpx;
  align-self: center;
  /* #ifdef H5 */
  width: auto;
  height: auto;
  aspect-ratio: 5 / 7;
  /* #endif */
}

.pc.sm {
  width: 48rpx;
  height: 68rpx;
  flex: none;
  border-radius: 8rpx;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
}

/* 宽屏玩家底牌 / 公牌 */
.pc.xl {
  flex: none;
  min-width: 96rpx;
  max-width: 124rpx;
  width: 120rpx;
  height: 168rpx;
  border-radius: 12rpx;
  align-self: center;
  /* #ifdef H5 */
  width: 120rpx;
  height: 168rpx;
  aspect-ratio: 5 / 7;
  /* #endif */
}

.pc-face {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pc-rank {
  position: absolute;
  top: 5rpx;
  left: 5rpx;
  font-size: 48rpx;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}

.pc.red .pc-rank,
.pc.red .pc-suit {
  color: #dc2626;
}

.pc-suit {
  position: absolute;
  bottom: 5rpx;
  right: 5rpx;
  font-size: 36rpx;
  line-height: 1;
  color: #0f172a;
}

.pc.back {
  background: rgba(226, 232, 240, 0.95);
}

.pc.highlight {
  box-shadow:
    0 0 0 3rpx #facc15,
    0 0 20rpx rgba(250, 204, 21, 0.65);
  transform: scale(1.08);
  z-index: 1;
}

.pc-q {
  font-size: 40rpx;
  font-weight: 600;
  color: #64748b;
}

.pc.sm .pc-rank {
  top: 3rpx;
  left: 3rpx;
  font-size: 30rpx;
}

.pc.sm .pc-suit {
  bottom: 2rpx;
  right: 2rpx;
  font-size: 26rpx;
}

.pc.sm .pc-q {
  font-size: 22rpx;
}

.pc.lg .pc-rank {
  top: 4rpx;
  left: 4rpx;
  font-size: 50rpx;
}

.pc.lg .pc-suit {
  bottom: 3rpx;
  right: 3rpx;
  font-size: 36rpx;
}

.pc.lg .pc-q {
  font-size: 30rpx;
}

.pc.xl .pc-rank {
  top: 4rpx;
  left: 4rpx;
  font-size: 92rpx;
}

.pc.xl .pc-suit {
  bottom: 2rpx;
  right: 2rpx;
  font-size: 58rpx;
}

.pc.xl .pc-q {
  font-size: 60rpx;
}
</style>
