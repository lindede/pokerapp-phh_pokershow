<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <text class="page-hint">选择一局进入复盘</text>
        <view v-if="loading" class="empty">
          <text class="empty-txt">加载中…</text>
        </view>
        <view v-else-if="errorMessage" class="empty">
          <text class="empty-txt">{{ errorMessage }}</text>
        </view>
        <view v-else-if="!items.length" class="empty">
          <text class="empty-txt">暂无复盘局</text>
        </view>
        <view
          v-for="item in items"
          :key="item.artifact_id"
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
import { onMounted, ref } from "vue";
import {
  getReviewHandsListApiUrl,
} from "@/config/review-api";
import type { ReviewHandListItem } from "@/types/review";

const items = ref<ReviewHandListItem[]>([]);
const loading = ref(false);
const errorMessage = ref("");

onMounted(() => {
  fetchList();
});

function fetchList() {
  loading.value = true;
  errorMessage.value = "";
  uni.request({
    url: getReviewHandsListApiUrl(),
    method: "GET",
    success: (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const body = res.data as { items?: ReviewHandListItem[] };
        items.value = Array.isArray(body?.items) ? body.items : [];
      } else {
        errorMessage.value = "加载失败";
      }
    },
    fail: () => {
      errorMessage.value = "网络错误";
    },
    complete: () => {
      loading.value = false;
    },
  });
}

function onTapItem(item: ReviewHandListItem) {
  uni.navigateTo({
    url: `/pages/review/index?artifact=${encodeURIComponent(item.artifact_id)}`,
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
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: #e2e8f0;
}

.list-chevron {
  flex-shrink: 0;
  font-size: 36rpx;
  color: #64748b;
  line-height: 1;
}
</style>
