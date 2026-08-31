<template>
  <view class="app-dock" :class="{ 'app-dock--ls': landscape }">
    <view v-if="$slots.default" class="app-dock-extra">
      <slot />
    </view>
    <!-- #ifdef H5 -->
    <text class="app-tab-icp" @tap.stop="openBeianLink">琼ICP备2026007033号</text>
    <!-- #endif -->
    <view class="app-tab-bar">
      <view
        v-for="item in APP_TAB_ITEMS"
        :key="item.key"
        class="app-tab-item"
        :class="{ 'app-tab-item--active': active === item.key }"
        @tap="onTap(item.key)"
      >
        <text class="app-tab-label">{{ item.label }}</text>
      </view>
    </view>
    <view class="app-dock-safe"></view>
  </view>
</template>

<script setup lang="ts">
import {
  APP_TAB_ITEMS,
  clearTabSwitchFlag,
  markTabSwitchNavigation,
  type AppTabKey,
} from "@/config/app-tab-bar";

const props = withDefaults(
  defineProps<{
    active: AppTabKey;
    /** 讲解页横屏底栏配色 */
    landscape?: boolean;
  }>(),
  { landscape: false },
);

const BEIAN_URL = "https://beian.miit.gov.cn";

function openBeianLink() {
  // #ifdef H5
  window.open(BEIAN_URL, "_blank");
  // #endif
}

function onTap(key: AppTabKey) {
  if (key === props.active) return;
  const target = APP_TAB_ITEMS.find((x) => x.key === key);
  if (!target) return;
  if (key === "commentary") markTabSwitchNavigation();
  else clearTabSwitchFlag();
  uni.reLaunch({ url: target.url });
}
</script>

<style scoped lang="scss">
$dock-bg: #0a2418;
$dock-max: 480px;

.app-dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: $dock-max;
  box-sizing: border-box;
  z-index: 20;
  background: $dock-bg;
  border-top: none;
  box-shadow: 0 -12rpx 28rpx rgba(0, 0, 0, 0.35);
  padding: 0;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.app-dock--ls {
  background: #0e0e0e;
  box-shadow: 0 -12rpx 28rpx rgba(0, 0, 0, 0.55);
}

.app-dock-extra {
  padding: 12rpx 24rpx 0;
  box-sizing: border-box;
}

.app-tab-icp {
  display: block;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  font-size: 22rpx;
  color: #64748b;
  line-height: 1.4;
  padding: 10rpx 24rpx 2rpx;
  text-decoration: underline;
}

.app-tab-bar {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.app-tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: 16rpx 8rpx;
  box-sizing: border-box;
  background: transparent;
}

.app-tab-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #94a3b8;
  line-height: 1.2;
}

.app-tab-item--active .app-tab-label {
  color: #86efac;
}

.app-dock-safe {
  height: 4rpx;
}
</style>
