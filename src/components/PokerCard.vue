<template>
  <view
    class="pc"
    :class="[size, { back: !parsed, red: parsed?.red, highlight }]"
  >
    <view v-if="parsed" class="pc-inner">
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
    size?: "lg" | "sm";
    /** 发公牌等场景高亮 */
    highlight?: boolean;
  }>(),
  { code: null, size: "lg", highlight: false },
);

const parsed = computed(() => parseCardCode(props.code ?? null));
</script>

<style lang="scss" scoped>
.pc {
  background: rgba(255, 255, 255, 0.96);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
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

.pc-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}

.pc-rank {
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.pc.red .pc-rank,
.pc.red .pc-suit {
  color: #dc2626;
}

.pc-suit {
  font-size: 34rpx;
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

.pc.sm .pc-inner {
  gap: 0;
}

.pc.sm .pc-rank {
  font-size: 16rpx;
}

.pc.sm .pc-suit {
  font-size: 18rpx;
}

.pc.sm .pc-q {
  font-size: 22rpx;
}

.pc.lg .pc-inner {
  gap: 2rpx;
}

.pc.lg .pc-rank {
  font-size: 22rpx;
}

.pc.lg .pc-suit {
  font-size: 26rpx;
}

.pc.lg .pc-q {
  font-size: 30rpx;
}
</style>
