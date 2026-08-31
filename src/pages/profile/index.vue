<template>
  <view class="page-root">
    <scroll-view
      class="page-scroll"
      scroll-y
      :show-scrollbar="false"
      :style="scrollViewStyle"
    >
      <view class="page-inner">
        <view class="panel panel-profile">
          <template v-if="isLoggedIn && user">
            <view class="profile-head-row">
              <view class="profile-head-main">
                <text class="profile-id">{{ user.display_id }}</text>
                <view class="profile-credit-row">
                  <text class="profile-credit">信用 {{ user.credit_balance }}</text>
                  <view class="credit-add-btn" @tap="onGoRedeem">
                    <text class="credit-add-btn-txt">+信用</text>
                  </view>
                </view>
                <text v-if="creditExpireLabel" class="profile-expire">{{ creditExpireLabel }}</text>
                <text v-if="user.nickname" class="profile-nick">{{ user.nickname }}</text>
              </view>
              <view class="profile-logout-btn" @tap="onLogout">
                <text class="profile-logout-btn-txt">退出</text>
              </view>
            </view>
            <!-- #ifdef MP-WEIXIN -->
            <button class="profile-btn profile-btn--secondary" @tap="onScanConfirmWeb">
              扫码确认电脑登录
            </button>
            <!-- #endif -->
          </template>
          <template v-else>
            <!-- #ifdef H5 -->
            <text class="profile-hint">微信小程序(GTO技术学习)扫码登录解锁更多功能</text>
            <!-- #endif -->
            <!-- #ifndef H5 -->
            <text class="profile-hint">登录后获得 @号 与信用，复盘等功能将消耗信用。</text>
            <!-- #endif -->
            <!-- #ifdef MP-WEIXIN -->
            <button
              class="profile-btn profile-btn--primary"
              :loading="loading"
              @tap="onWxLogin"
            >
              微信一键登录
            </button>
            <!-- #endif -->
            <!-- #ifdef H5 -->
            <button
              class="profile-btn profile-btn--primary"
              :loading="loading || h5LoginWaiting"
              @tap="onH5Login"
            >
              获取扫码登录
            </button>
            <view v-if="webQrDataUrl" class="web-login-qr-box">
              <image
                class="web-login-qr-img"
                :src="webQrDataUrl"
                mode="aspectFit"
              />
              <text class="web-login-qr-hint">
                {{
                  h5LoginWaiting
                    ? "等待小程序扫码确认…"
                    : "请用微信小程序「扫码确认电脑登录」扫描上方二维码"
                }}
              </text>
            </view>
            <!-- #endif -->
          </template>
        </view>

        <!-- 列表区：所有分组在同一块功能区域内，组间留空 -->
        <view class="list-section">
          <view
            v-for="group in menuGroups"
            :key="group.id"
            class="list-group"
          >
            <view class="list-group-card">
              <view
                v-for="(item, idx) in group.items"
                :key="item.key"
                class="list-row"
                :class="{ 'list-row--last': idx === group.items.length - 1 }"
                @tap="onMenuTap(item)"
              >
                <ProfileMenuIcon :type="item.icon" />
                <text class="list-label">{{ item.label }}</text>
                <text class="list-chevron">›</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <AppTabBar active="profile" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabBar from "@/components/AppTabBar.vue";
import ProfileMenuIcon from "@/components/ProfileMenuIcon.vue";
import {
  PROFILE_MENU_GROUPS,
  type ProfileMenuItem,
} from "@/config/profile-menu";
import { APP_TAB_BAR_HEIGHT_RPX } from "@/config/app-tab-bar";
import { useAuth } from "@/composables/useAuth";
// #ifdef H5
import QRCode from "qrcode";
// #endif

const menuGroups = PROFILE_MENU_GROUPS;

const {
  user,
  loading,
  isLoggedIn,
  loginWxMini,
  logout,
  fetchProfile,
  refreshBalance,
  pollWebTicket,
  confirmWebTicketForMini,
  requestWebTicket,
} = useAuth();

const creditExpireLabel = computed(() => {
  const raw = user.value?.credits_expire_at;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const effective = user.value?.effective_balance;
  if (typeof effective === "number" && effective <= 0 && (user.value?.credit_balance ?? 0) > 0) {
    return `已于 ${y}-${m}-${day} 到期`;
  }
  return `有效至 ${y}-${m}-${day}`;
});

const webTicket = ref("");
const webQrDataUrl = ref("");
const h5LoginWaiting = ref(false);

/** 小程序 scroll-view 须明确高度（px） */
const scrollHeightPx = ref(0);
const scrollViewStyle = computed(() =>
  scrollHeightPx.value > 0 ? { height: `${scrollHeightPx.value}px` } : {},
);

function updateScrollHeight() {
  const sys = uni.getSystemInfoSync();
  const dockPx = ((APP_TAB_BAR_HEIGHT_RPX + 24) * sys.windowWidth) / 750;
  const safeBottom = sys.safeAreaInsets?.bottom ?? 0;
  scrollHeightPx.value = Math.max(
    240,
    Math.floor(sys.windowHeight - dockPx - safeBottom),
  );
}

updateScrollHeight();

onMounted(() => {
  updateScrollHeight();
  if (isLoggedIn.value) {
    fetchProfile();
  }
});

onShow(() => {
  updateScrollHeight();
  if (isLoggedIn.value) {
    void refreshBalance();
    void fetchProfile();
  }
});

onLoad((options) => {
  const ticket = (options?.web_ticket as string) || "";
  if (!ticket) return;
  webTicket.value = ticket;
  pollWebTicket(ticket).then((ok) => {
    if (ok) uni.showToast({ title: "登录成功", icon: "success" });
  });
});

function onMenuTap(item: ProfileMenuItem) {
  switch (item.key) {
    case "categories_all":
      uni.navigateTo({ url: "/pages/profile/categories?scope=all" });
      break;
    case "categories_mine":
      uni.navigateTo({ url: "/pages/profile/categories?scope=mine" });
      break;
    case "favorites":
      uni.navigateTo({ url: "/pages/profile/favorites" });
      break;
    case "review":
      uni.navigateTo({ url: "/pages/profile/reviews" });
      break;
  }
}

async function onWxLogin() {
  await loginWxMini();
}

function onLogout() {
  logout();
}

function onGoRedeem() {
  uni.navigateTo({ url: "/pages/profile/redeem" });
}

async function onH5Login() {
  webQrDataUrl.value = "";
  webTicket.value = "";
  const t = await requestWebTicket();
  if (!t) {
    uni.showToast({ title: "无法创建登录票，请确认 API/Redis", icon: "none" });
    return;
  }
  webTicket.value = t.ticket;
  // #ifdef H5
  try {
    webQrDataUrl.value = await QRCode.toDataURL(t.ticket, {
      width: 280,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  } catch {
    uni.showToast({ title: "二维码生成失败", icon: "none" });
    return;
  }
  // #endif
  h5LoginWaiting.value = true;
  const ok = await pollWebTicket(t.ticket);
  h5LoginWaiting.value = false;
  if (ok) {
    webQrDataUrl.value = "";
    webTicket.value = "";
    uni.showToast({ title: "登录成功", icon: "success" });
  } else {
    uni.showToast({ title: "登录超时，请重新获取", icon: "none" });
  }
}

function onScanConfirmWeb() {
  uni.scanCode({
    success: async (res) => {
      const raw = (res.result || "").trim();
      let ticket = "";
      if (raw.includes("web_ticket=")) {
        ticket = raw.split("web_ticket=")[1]?.split("&")[0] || "";
      } else if (/^[a-f0-9]{32}$/i.test(raw)) {
        ticket = raw;
      }
      if (!ticket) {
        uni.showToast({ title: "无效二维码", icon: "none" });
        return;
      }
      await confirmWebTicketForMini(ticket);
    },
  });
}
</script>

<style scoped lang="scss">
$felt: #0f3d26;
$panel: rgba(255, 255, 255, 0.07);
$panel-border: rgba(255, 255, 255, 0.14);
$tab-bar-h: 128rpx;

.page-root {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: $felt;
  overflow: hidden;
  box-sizing: border-box;
  /* #ifdef MP-WEIXIN */
  min-height: 100vh;
  /* #endif */
}

.page-scroll {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  /* #ifdef MP-WEIXIN */
  min-height: 60vh;
  /* #endif */
  /* #ifndef MP-WEIXIN */
  height: 0;
  min-height: 0;
  /* #endif */
}

.page-inner {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 24rpx 24rpx 0;
  padding-bottom: calc(160rpx + #{$tab-bar-h} + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.panel {
  background: $panel;
  border: 1rpx solid $panel-border;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  margin-bottom: 24rpx;
  flex-shrink: 0;
}

.list-section {
  width: 100%;
  box-sizing: border-box;
}

.list-group + .list-group {
  margin-top: 20rpx;
}

.list-group {
  flex-shrink: 0;
}

.list-group-card {
  background: $panel;
  border: 1rpx solid $panel-border;
  border-radius: 20rpx;
  overflow: hidden;
}

.list-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
}

.list-row:active {
  background: rgba(255, 255, 255, 0.05);
}

.list-row--last {
  border-bottom: none;
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
  font-size: 34rpx;
  font-weight: 300;
  color: #64748b;
  line-height: 1;
}

.profile-head-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 8rpx;
}

.profile-head-main {
  flex: 1;
  min-width: 0;
}

.profile-id {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #86efac;
  margin-bottom: 8rpx;
}

.profile-credit-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 4rpx;
}

.profile-credit {
  font-size: 30rpx;
  color: #fbbf24;
}

.profile-expire {
  display: block;
  font-size: 22rpx;
  color: #94a3b8;
  margin-bottom: 6rpx;
}

.credit-add-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: rgba(34, 197, 94, 0.16);
  border: 1rpx solid rgba(134, 239, 172, 0.35);
}

.credit-add-btn:active {
  background: rgba(34, 197, 94, 0.28);
}

.credit-add-btn-txt {
  font-size: 18rpx;
  font-weight: 600;
  color: #86efac;
  line-height: 1;
  letter-spacing: 0.02em;
}

.profile-logout-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}

.profile-logout-btn:active {
  background: rgba(255, 255, 255, 0.14);
}

.profile-logout-btn-txt {
  font-size: 22rpx;
  color: #cbd5e1;
  line-height: 1;
}

.profile-nick {
  display: block;
  font-size: 28rpx;
  color: #94a3b8;
}

.profile-hint {
  display: block;
  font-size: 28rpx;
  color: #94a3b8;
  line-height: 1.55;
  margin-bottom: 24rpx;
  word-break: break-all;
}

.profile-ticket {
  display: block;
  font-size: 22rpx;
  color: #64748b;
  margin-top: 12rpx;
  font-family: monospace;
}

.web-login-qr-box {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.web-login-qr-img {
  width: 280rpx;
  height: 280rpx;
  padding: 16rpx;
  background: #fff;
  border-radius: 16rpx;
  box-sizing: border-box;
}

.web-login-qr-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #94a3b8;
  text-align: center;
}

.profile-btn {
  margin-top: 16rpx;
  font-size: 28rpx;
  border-radius: 16rpx;
}

.profile-btn--primary {
  background: #22c55e;
  color: #052e16;
}

.profile-btn--secondary {
  background: rgba(56, 189, 248, 0.2);
  color: #e0f2fe;
}

.profile-btn--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}
</style>
