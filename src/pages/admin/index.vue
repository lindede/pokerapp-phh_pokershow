<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y>
      <view class="page-inner">
        <text class="title">数据管理</text>
        <view class="panel">
          <text class="label">Admin Token</text>
          <input class="input" v-model="adminToken" password placeholder="X-Admin-Token" />
          <button class="btn" @tap="saveToken">保存</button>
        </view>

        <view class="tabs">
          <text
            class="tab"
            :class="{ on: tab === 'content' }"
            @tap="tab = 'content'"
            >内容</text
          >
          <text class="tab" :class="{ on: tab === 'jobs' }" @tap="tab = 'jobs'">任务</text>
          <text class="tab" :class="{ on: tab === 'voucher' }" @tap="tab = 'voucher'"
            >卡密</text
          >
        </view>

        <view v-if="tab === 'content'" class="panel">
          <button class="btn" @tap="importDisk">从磁盘导入解说索引</button>
          <button class="btn btn--ghost" @tap="loadContent">刷新列表</button>
          <view v-for="c in contentItems" :key="c.id" class="row">
            <text class="row-id">{{ c.id }} · {{ c.status }}</text>
            <text class="row-key">{{ c.external_key.slice(0, 16) }}…</text>
            <view class="row-actions">
              <text class="link" @tap="setStatus(c.id, 'published')">上线</text>
              <text class="link" @tap="setStatus(c.id, 'archived')">下线</text>
            </view>
          </view>
        </view>

        <view v-if="tab === 'jobs'" class="panel">
          <button class="btn btn--ghost" @tap="loadJobs">刷新任务</button>
          <view v-for="j in jobs" :key="j.id" class="row">
            <text>#{{ j.id }} {{ j.job_type }} · {{ j.status }}</text>
            <text v-if="j.error_message" class="err">{{ j.error_message }}</text>
          </view>
        </view>

        <view v-if="tab === 'voucher'" class="panel">
          <input class="input" v-model="batchId" placeholder="批次 ID" />
          <input class="input" v-model="batchCount" type="number" placeholder="数量" />
          <input class="input" v-model="batchAmount" type="number" placeholder="面值" />
          <button class="btn" @tap="createBatch">生成卡密</button>
          <text v-for="(code, i) in batchCodes" :key="i" class="code-line">{{ code }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  adminFetch,
  getAdminToken,
  setAdminToken,
  type ContentItem,
  type JobItem,
} from "@/config/admin-api";

const tab = ref<"content" | "jobs" | "voucher">("content");
const adminToken = ref(getAdminToken());
const contentItems = ref<ContentItem[]>([]);
const jobs = ref<JobItem[]>([]);
const batchId = ref(`batch-${Date.now()}`);
const batchCount = ref("5");
const batchAmount = ref("100");
const batchCodes = ref<string[]>([]);

function saveToken() {
  setAdminToken(adminToken.value.trim());
  uni.showToast({ title: "已保存", icon: "success" });
}

async function loadContent() {
  contentItems.value = await adminFetch<ContentItem[]>("/v3/admin/content?limit=50");
}

async function importDisk() {
  await adminFetch("/v3/admin/content/sync-from-disk", { method: "POST" });
  uni.showToast({ title: "已创建导入任务", icon: "none" });
  await loadJobs();
}

async function setStatus(id: number, status: string) {
  await adminFetch(`/v3/admin/content/${id}/status`, {
    method: "PATCH",
    data: { status },
  });
  await loadContent();
}

async function loadJobs() {
  jobs.value = await adminFetch<JobItem[]>("/v3/admin/jobs?limit=30");
}

async function createBatch() {
  const res = await adminFetch<{ codes: string[] }>("/v3/admin/vouchers/batch", {
    method: "POST",
    data: {
      batch_id: batchId.value,
      count: Number(batchCount.value) || 5,
      credit_amount: Number(batchAmount.value) || 100,
    },
  });
  batchCodes.value = res.codes || [];
}

onMounted(() => {
  if (getAdminToken()) {
    loadContent();
    loadJobs();
  }
});
</script>

<style scoped lang="scss">
.page-root {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}
.page-inner {
  padding: 24rpx;
  max-width: 960px;
  margin: 0 auto;
}
.title {
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
  display: block;
}
.panel {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: #94a3b8;
}
.input {
  width: 100%;
  margin-bottom: 16rpx;
  padding: 16rpx;
  background: #1e293b;
  border-radius: 8rpx;
  color: #f8fafc;
  box-sizing: border-box;
}
.btn {
  margin-bottom: 12rpx;
  background: #22c55e;
  color: #052e16;
  font-size: 28rpx;
}
.btn--ghost {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}
.tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.tab {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  font-size: 26rpx;
}
.tab.on {
  background: #22c55e;
  color: #052e16;
}
.row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.row-key {
  font-size: 22rpx;
  color: #64748b;
  font-family: monospace;
}
.row-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 8rpx;
}
.link {
  color: #38bdf8;
  font-size: 26rpx;
}
.code-line {
  display: block;
  font-family: monospace;
  font-size: 24rpx;
  margin-top: 8rpx;
}
.err {
  color: #f87171;
  font-size: 22rpx;
}
</style>
