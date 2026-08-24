<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <view class="panel panel-profile">
          <text class="profile-title">我的</text>
          <text class="profile-hint"
            >用户登录、战绩与个人设置将在此提供，功能筹备中。</text
          >
        </view>
      </view>
    </scroll-view>

    <view class="dock">
      <AppTabBar active="profile" />
      <view class="dock-safe"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppTabBar from "@/components/AppTabBar.vue";
</script>

<style scoped lang="scss">
$felt: #0f3d26;
$panel: rgba(255, 255, 255, 0.07);
$panel-border: rgba(255, 255, 255, 0.14);
$dock-bg: rgba(15, 61, 38, 0.96);

.page-root {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $felt;
  overflow: hidden;
}

.page-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.page-inner {
  padding: 24rpx 24rpx 0;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.panel {
  background: $panel;
  border: 1rpx solid $panel-border;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
}

.profile-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 16rpx;
}

.profile-hint {
  display: block;
  font-size: 28rpx;
  color: #94a3b8;
  line-height: 1.55;
}

.dock {
  flex-shrink: 0;
  background: $dock-bg;
  border-top: 1rpx solid rgba(255, 255, 255, 0.12);
  padding: 0 24rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.dock-safe {
  height: 8rpx;
}
</style>
