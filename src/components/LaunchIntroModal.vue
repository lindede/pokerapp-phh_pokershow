<template>
  <view v-if="visible" class="intro-mask" @tap="close">
    <view class="intro-dialog" @tap.stop>
      <text class="intro-title">博弈技术学习</text>
      <view class="intro-body">
        <text v-if="isMpWeixin" class="intro-text">{{ introBodyText }}</text>
        <template v-else>
          <text class="intro-link" @tap.stop="openPluribusLink">Pluribus AI</text>
          <text class="intro-text">{{ introBodyText }}</text>
        </template>
      </view>
      <view class="intro-btn" @tap="close">
        <text class="intro-btn-txt">知道了</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

const PLURIBUS_URL = "https://zhuanlan.zhihu.com/p/97870891";
const introBodyText =
  "博弈技术学习分析，通过复盘方式逐步分析 Pluribus AI 在博弈中使用的 GTO 策略和剥削策略";
const isMpWeixin = process.env.UNI_PLATFORM === "mp-weixin";

const props = withDefaults(
  defineProps<{
    /** m=rv 等场景：不展示介绍弹窗 */
    skip?: boolean;
  }>(),
  { skip: false },
);

const visible = ref(false);

function openPluribusLink() {
  if (isMpWeixin) return;
  // #ifdef H5
  window.open(PLURIBUS_URL, "_blank");
  // #endif
  // #ifndef H5
  uni.setClipboardData({
    data: PLURIBUS_URL,
    success: () => {
      uni.showToast({ title: "链接已复制，请在浏览器打开", icon: "none" });
    },
  });
  // #endif
}

function close() {
  visible.value = false;
}

onMounted(() => {
  if (props.skip) return;
  setTimeout(() => {
    visible.value = true;
  }, 300);
});
</script>

<style lang="scss" scoped>
.intro-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  background: rgba(0, 0, 0, 0.55);
  box-sizing: border-box;
}

.intro-dialog {
  width: 100%;
  max-width: 680rpx;
  padding: 40rpx 36rpx 32rpx;
  border-radius: 20rpx;
  background: #1e293b;
  box-sizing: border-box;
}

.intro-title {
  display: block;
  margin-bottom: 24rpx;
  font-size: 40rpx;
  font-weight: 600;
  color: #f8fafc;
  text-align: center;
}

.intro-body {
  line-height: 1.7;
}

.intro-link {
  font-size: 34rpx;
  color: #38bdf8;
  text-decoration: underline;
}

.intro-text {
  font-size: 34rpx;
  color: #e2e8f0;
}

.intro-btn {
  margin-top: 32rpx;
  padding: 18rpx 0;
  border-radius: 12rpx;
  background: #14532d;
  text-align: center;
}

.intro-btn-txt {
  font-size: 36rpx;
  color: #f8fafc;
}
</style>
