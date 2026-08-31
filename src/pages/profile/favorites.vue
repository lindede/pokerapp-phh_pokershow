<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <text class="page-hint">收藏的牌局，点击进入讲解</text>
        <view v-if="!items.length" class="empty">
          <text class="empty-txt">暂无收藏</text>
        </view>
        <view
          v-for="item in items"
          :key="item.id"
          class="list-row"
          @tap="onTapItem(item)"
        >
          <text class="list-label">{{ item.title }}</text>
          <text class="list-chevron">›</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface FavoriteItem {
  id: string;
  datasetKey: string;
  title: string;
}

const items = ref<FavoriteItem[]>([]);

function onTapItem(item: FavoriteItem) {
  uni.reLaunch({
    url: `/pages/index/index?k=${encodeURIComponent(item.datasetKey)}&id=${encodeURIComponent(item.id)}`,
  });
}
</script>

<style scoped lang="scss">
$felt: #0f3d26;
$panel: rgba(255, 255, 255, 0.07);
$panel-border: rgba(255, 255, 255, 0.14);

.page-root {
  min-height: 100vh;
  background: $felt;
}

.page-inner {
  padding: 24rpx;
}

.page-hint {
  display: block;
  font-size: 26rpx;
  color: #94a3b8;
  margin-bottom: 20rpx;
}

.empty {
  padding: 80rpx 24rpx;
  text-align: center;
}

.empty-txt {
  font-size: 28rpx;
  color: #64748b;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $panel;
  border: 1rpx solid $panel-border;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 16rpx;
}

.list-row:active {
  background: rgba(255, 255, 255, 0.1);
}

.list-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #e2e8f0;
}

.list-chevron {
  font-size: 36rpx;
  color: #64748b;
  line-height: 1;
}
</style>
