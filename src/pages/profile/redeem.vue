<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <view class="guide panel">
          <text class="guide-title">兑换信用</text>
          <text class="guide-text">
            复盘等功能会消耗信用。购买卡密后，在下方输入 PKS- 开头的兑换码即可到账。
          </text>
          <text class="guide-balance">当前信用：{{ creditBalance }}</text>
        </view>

        <view class="form panel">
          <text class="form-label">卡密</text>
          <input
            class="redeem-input"
            v-model="voucherCode"
            placeholder="输入卡密 PKS-XXXX-..."
            confirm-type="done"
            @confirm="onRedeem"
          />
          <button
            class="redeem-btn"
            :loading="loading"
            :disabled="loading"
            @tap="onRedeem"
          >
            确认兑换
          </button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useAuth } from "@/composables/useAuth";

const { user, loading, isLoggedIn, fetchProfile, refreshBalance, redeemVoucher } =
  useAuth();

const voucherCode = ref("");

const creditBalance = computed(() => user.value?.credit_balance ?? 0);

onShow(() => {
  if (!isLoggedIn.value) {
    uni.showToast({ title: "请先登录", icon: "none" });
    setTimeout(() => uni.navigateBack(), 400);
    return;
  }
  void refreshBalance();
  void fetchProfile();
});

async function onRedeem() {
  const ok = await redeemVoucher(voucherCode.value);
  if (ok) voucherCode.value = "";
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

.panel {
  background: $panel;
  border: 1rpx solid $panel-border;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
}

.guide-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 16rpx;
}

.guide-text {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  color: #94a3b8;
  margin-bottom: 20rpx;
}

.guide-balance {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #fbbf24;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #94a3b8;
  margin-bottom: 12rpx;
}

.redeem-input {
  width: 100%;
  height: 88rpx;
  min-height: 88rpx;
  padding: 0 24rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 12rpx;
  color: #f8fafc;
  font-size: 28rpx;
  line-height: 88rpx;
}

.redeem-btn {
  font-size: 28rpx;
  border-radius: 16rpx;
  background: #22c55e;
  color: #052e16;
}
</style>
