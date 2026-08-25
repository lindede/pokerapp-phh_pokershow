<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <view class="panel panel-profile">
          <template v-if="isLoggedIn && user">
            <text class="profile-id">{{ user.display_id }}</text>
            <text class="profile-credit">信用 {{ user.credit_balance }}</text>
            <text v-if="user.nickname" class="profile-nick">{{ user.nickname }}</text>
            <button class="profile-btn profile-btn--ghost" @tap="onRefresh">刷新</button>
            <button class="profile-btn profile-btn--ghost" @tap="onLogout">退出登录</button>
            <view class="redeem-row">
              <input
                class="redeem-input"
                v-model="voucherCode"
                placeholder="输入卡密 PKS-XXXX-..."
              />
              <button class="profile-btn profile-btn--secondary" @tap="onRedeem">
                兑换信用
              </button>
            </view>
          </template>
          <template v-else>
            <text class="profile-title">我的</text>
            <text class="profile-hint">登录后获得 @号 与信用，复盘等功能将消耗信用。</text>
            <!-- #ifdef MP-WEIXIN -->
            <button
              class="profile-btn profile-btn--primary"
              :loading="loading"
              @tap="onWxLogin"
            >
              微信一键登录
            </button>
            <button class="profile-btn profile-btn--secondary" @tap="onScanConfirmWeb">
              扫码确认电脑登录
            </button>
            <!-- #endif -->
            <!-- #ifdef H5 -->
            <button
              class="profile-btn profile-btn--primary"
              :loading="loading"
              @tap="onH5Login"
            >
              获取扫码登录
            </button>
            <text v-if="webTicket" class="profile-ticket">Ticket: {{ webTicket }}</text>
            <text v-if="webQrUrl" class="profile-hint">{{ webQrUrl }}</text>
            <!-- #endif -->
          </template>
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
import { onMounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppTabBar from "@/components/AppTabBar.vue";
import { useAuth } from "@/composables/useAuth";

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
  redeemVoucher,
} = useAuth();

const webTicket = ref("");
const webQrUrl = ref("");
const voucherCode = ref("");

onMounted(() => {
  if (isLoggedIn.value) {
    fetchProfile();
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

async function onWxLogin() {
  await loginWxMini();
}

async function onLogout() {
  logout();
}

async function onRefresh() {
  await refreshBalance();
  await fetchProfile();
}

async function onH5Login() {
  const t = await requestWebTicket();
  if (!t) {
    uni.showToast({ title: "无法创建登录票", icon: "none" });
    return;
  }
  webTicket.value = t.ticket;
  webQrUrl.value = t.qr_url;
  uni.showToast({ title: "请用小程序扫码确认", icon: "none", duration: 2500 });
  const ok = await pollWebTicket(t.ticket);
  if (!ok) uni.showToast({ title: "登录超时", icon: "none" });
}

async function onRedeem() {
  await redeemVoucher(voucherCode.value);
  voucherCode.value = "";
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

.profile-id {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #86efac;
  margin-bottom: 12rpx;
}

.profile-credit {
  display: block;
  font-size: 32rpx;
  color: #fbbf24;
  margin-bottom: 8rpx;
}

.profile-nick {
  display: block;
  font-size: 28rpx;
  color: #94a3b8;
  margin-bottom: 24rpx;
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

.redeem-row {
  margin-top: 20rpx;
}

.redeem-input {
  width: 100%;
  padding: 16rpx;
  margin-bottom: 12rpx;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 12rpx;
  color: #f8fafc;
  font-size: 26rpx;
  box-sizing: border-box;
}
</style>
