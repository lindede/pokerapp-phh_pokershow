<template>
  <view class="page">
    <view class="head">
      <view class="head-main">
        <text class="title">解说制品</text>
        <text class="sub">{{ slugLabel }} · {{ shortKey }}</text>
        <text v-if="spotCode" class="sub">spot {{ spotCode }}</text>
      </view>
      <button class="btn btn--ghost btn--sm" @tap="reload" :loading="loading">刷新</button>
    </view>

    <text v-if="error" class="err">{{ error }}</text>
    <text v-else-if="!loading && !pkg?.has_package" class="hint"
      >尚未找到制品目录（可能未生成解说）</text
    >
    <text v-else-if="pkg?.package_dir" class="path" selectable>{{ pkg.package_dir }}</text>

    <scroll-view v-if="fileTabs.length" class="tabs" scroll-x>
      <text
        v-for="f in fileTabs"
        :key="f.name"
        class="tab"
        :class="{ on: activeFile === f.name, miss: !f.exists }"
        @tap="activeFile = f.name"
      >
        {{ f.name }}{{ f.exists ? "" : " ·缺" }}
      </text>
    </scroll-view>

    <scroll-view class="body" scroll-y>
      <text v-if="loading" class="hint">加载中…</text>
      <text v-else-if="activeMeta && !activeMeta.exists" class="hint">文件不存在</text>
      <view v-else-if="activeMeta" class="meta-bar">
        <text class="meta">{{ formatSize(activeMeta.size) }}</text>
        <text v-if="activeMeta.truncated" class="meta warn">已截断</text>
        <text class="adm-copy" @tap="copyActive">复制全文</text>
      </view>
      <!-- #ifdef H5 -->
      <textarea
        v-if="activeMeta?.exists"
        class="code-area"
        :value="activeText || '（空）'"
        readonly
        :auto-height="false"
        :maxlength="-1"
      />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <text v-if="activeMeta?.exists" class="code" selectable>{{ activeText || "（空）" }}</text>
      <!-- #endif -->
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { adminFetch } from "@/config/admin-api";

type ArtifactFile = {
  name: string;
  exists: boolean;
  size: number;
  truncated?: boolean;
  text?: string | null;
};

type ArtifactPkg = {
  phhs_key: string;
  slug: string;
  package_dir: string;
  has_package: boolean;
  files: ArtifactFile[];
};

const phhsKey = ref("");
const recordIndex = ref(0);
const heroSeat = ref(0);
const spotCode = ref("");
const loading = ref(false);
const error = ref("");
const pkg = ref<ArtifactPkg | null>(null);
const activeFile = ref("commentary.json");

const slugLabel = computed(() => {
  if (pkg.value?.slug) return pkg.value.slug;
  if (recordIndex.value && heroSeat.value) return `${recordIndex.value}-${heroSeat.value}`;
  return "—";
});

const shortKey = computed(() => {
  const k = phhsKey.value;
  if (k.length <= 42) return k;
  return `${k.slice(0, 20)}…${k.slice(-16)}`;
});

const fileTabs = computed(() => pkg.value?.files || []);

const activeMeta = computed(
  () => fileTabs.value.find((f) => f.name === activeFile.value) || null,
);

const activeText = computed(() => {
  const t = activeMeta.value?.text;
  return typeof t === "string" ? t : "";
});

function formatSize(n: number): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function copyActive() {
  const text = activeText.value || "";
  if (!text) {
    uni.showToast({ title: "无内容可复制", icon: "none" });
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      uni.setClipboardData({
        data: text,
        success: () => resolve(),
        fail: (e) => reject(e),
      });
    });
  } catch {
    uni.showToast({ title: "复制失败", icon: "none" });
  }
}

async function reload() {
  if (!phhsKey.value || !recordIndex.value || !heroSeat.value) {
    error.value = "缺少 phhs_key / i / hero_seat";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const q = [
      `phhs_key=${encodeURIComponent(phhsKey.value)}`,
      `i=${recordIndex.value}`,
      `hero_seat=${heroSeat.value}`,
    ].join("&");
    pkg.value = await adminFetch<ArtifactPkg>(`/v3/admin/hand-artifacts?${q}`);
    const prefer = ["commentary.json", "hand.phh", "meta.json", "llm_trace.json"];
    const files = pkg.value.files || [];
    const hit = prefer.find((n) => files.some((f) => f.name === n && f.exists));
    activeFile.value = hit || files[0]?.name || "commentary.json";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    pkg.value = null;
  } finally {
    loading.value = false;
  }
}

onLoad((query) => {
  phhsKey.value = String(query?.phhs_key || "").trim();
  recordIndex.value = Number(query?.i || 0);
  heroSeat.value = Number(query?.hero_seat || 0);
  spotCode.value = String(query?.spot || "").trim();
  void reload();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #0b1220;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 24rpx;
}
.head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.head-main {
  flex: 1;
  min-width: 0;
}
.title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #f8fafc;
}
.sub {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #94a3b8;
  word-break: break-all;
}
.path {
  display: block;
  margin-bottom: 12rpx;
  font-size: 20rpx;
  color: #64748b;
  font-family: ui-monospace, Consolas, monospace;
  word-break: break-all;
  user-select: text;
  -webkit-user-select: text;
}
.err {
  color: #f87171;
  font-size: 24rpx;
  margin-bottom: 12rpx;
}
.hint {
  color: #94a3b8;
  font-size: 24rpx;
  margin-bottom: 12rpx;
}
.tabs {
  white-space: nowrap;
  margin-bottom: 12rpx;
  max-width: 100%;
}
.tab {
  display: inline-block;
  margin-right: 12rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #94a3b8;
  background: rgba(30, 41, 59, 0.8);
  border: 1rpx solid rgba(148, 163, 184, 0.15);
}
.tab.on {
  color: #e2e8f0;
  background: rgba(34, 197, 94, 0.18);
  border-color: rgba(34, 197, 94, 0.45);
}
.tab.miss {
  opacity: 0.55;
}
.body {
  flex: 1;
  height: 0;
  min-height: 60vh;
  background: rgba(15, 23, 42, 0.85);
  border: 1rpx solid rgba(148, 163, 184, 0.12);
  border-radius: 14rpx;
  padding: 18rpx;
  box-sizing: border-box;
}
.meta-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}
.meta {
  font-size: 20rpx;
  color: #64748b;
}
.meta.warn {
  color: #fbbf24;
}
.adm-copy {
  margin-left: auto;
  font-size: 22rpx;
  color: #38bdf8;
}
.code {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 22rpx;
  line-height: 1.45;
  color: #cbd5e1;
  user-select: text;
  -webkit-user-select: text;
}
.code-area {
  display: block;
  width: 100%;
  min-height: 52vh;
  height: 52vh;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 22rpx;
  line-height: 1.45;
  color: #cbd5e1;
  user-select: text;
  -webkit-user-select: text;
}
.btn {
  margin: 0;
  border: none;
  border-radius: 10rpx;
  padding: 12rpx 20rpx;
  font-size: 24rpx;
  background: #16a34a;
  color: #fff;
}
.btn--ghost {
  background: transparent;
  color: #94a3b8;
  border: 1rpx solid rgba(148, 163, 184, 0.25);
}
.btn--sm {
  padding: 8rpx 16rpx;
  font-size: 22rpx;
}
</style>
