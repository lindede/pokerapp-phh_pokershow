<template>
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
</template>

<script setup lang="ts">
import {
  APP_TAB_ITEMS,
  type AppTabKey,
} from "@/config/app-tab-bar";

const props = defineProps<{
  active: AppTabKey;
}>();

function onTap(key: AppTabKey) {
  if (key === props.active) return;
  const target = APP_TAB_ITEMS.find((x) => x.key === key);
  if (!target) return;
  uni.reLaunch({ url: target.url });
}
</script>

<style scoped lang="scss">
.app-tab-bar {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  border-top: 1rpx solid rgba(255, 255, 255, 0.12);
  margin: 10rpx -24rpx 0;
}

.app-tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: 16rpx 8rpx;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.15);
}

.app-tab-item--active {
  background: rgba(34, 197, 94, 0.38);
}

.app-tab-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #94a3b8;
  line-height: 1.2;
}

.app-tab-item--active .app-tab-label {
  color: #f0fdf4;
}
</style>
