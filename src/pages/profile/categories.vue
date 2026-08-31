<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <text class="page-hint">{{
          scope === "mine" ? "我创建的牌局分类" : "全部已发布牌局分类"
        }}</text>
        <text v-if="loading" class="hint">加载中…</text>
        <text v-else-if="loadError" class="hint">{{ loadError }}</text>
        <view v-else-if="!groups.length" class="empty">
          <text class="empty-txt">暂无分类，敬请期待</text>
        </view>
        <view
          v-for="g in groups"
          :key="g.key"
          class="list-row"
          @tap="onTapGroup(g)"
        >
          <view class="list-main">
            <text class="list-label">{{ g.label }}</text>
            <text v-if="g.count" class="list-meta">{{ g.count }} 手</text>
          </view>
          <text class="list-chevron">›</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { apiAbsoluteUrl } from "@/config/api-origin";
import { AUTH_TOKEN_STORAGE_KEY } from "@/config/auth-api";

interface CategoryGroup {
  key: string;
  label: string;
  count?: number;
}

interface PublicCategoryItem {
  code: string;
  name: string;
  hand_count: number;
  publish_status: string;
}

const scope = ref<"all" | "mine">("all");
const groups = ref<CategoryGroup[]>([]);
const loading = ref(false);
const loadError = ref("");

onLoad((options) => {
  const s = (options?.scope as string) || "all";
  scope.value = s === "mine" ? "mine" : "all";
  uni.setNavigationBarTitle({
    title: scope.value === "mine" ? "我的牌局分类" : "所有牌局分类",
  });
  void loadGroups();
});

async function loadGroups() {
  loading.value = true;
  loadError.value = "";
  try {
    const token = uni.getStorageSync(AUTH_TOKEN_STORAGE_KEY) as string | undefined;
    const header: Record<string, string> = {};
    if (token?.trim()) {
      header.Authorization = `Bearer ${token.trim()}`;
    }
    const data = await new Promise<PublicCategoryItem[]>((resolve, reject) => {
      uni.request({
        url: apiAbsoluteUrl("/v3/commentary/lists"),
        method: "GET",
        header,
        success: (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve((res.data as PublicCategoryItem[]) || []);
            return;
          }
          reject(new Error(`HTTP ${res.statusCode}`));
        },
        fail: (err) => reject(err),
      });
    });
    // scope=mine 暂无用户自建分类；与 all 相同展示已发布列表
    groups.value = (data || []).map((c) => ({
      key: c.code,
      label: c.name || c.code,
      count: c.hand_count,
    }));
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : "加载失败";
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function onTapGroup(g: CategoryGroup) {
  // 进入讲解页，按分类列表随机一手（仅 k，首页会以 i=-1 拉该列表）
  uni.reLaunch({
    url: `/pages/index/index?k=${encodeURIComponent(g.key)}`,
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

.hint {
  display: block;
  font-size: 26rpx;
  color: #94a3b8;
  margin-bottom: 16rpx;
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
  padding: 28rpx 24rpx;
  margin-bottom: 12rpx;
  background: $panel;
  border: 1px solid $panel-border;
  border-radius: 16rpx;
}

.list-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.list-label {
  font-size: 30rpx;
  color: #e2e8f0;
}

.list-meta {
  font-size: 22rpx;
  color: #94a3b8;
}

.list-chevron {
  font-size: 36rpx;
  color: #64748b;
  margin-left: 16rpx;
}
</style>
