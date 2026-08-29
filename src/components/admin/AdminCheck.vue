<template>
  <view
    class="adm-check"
    :class="{
      'adm-check--on': modelValue,
      'adm-check--indeterminate': indeterminate,
      'adm-check--disabled': disabled,
    }"
    @tap.stop="onTap"
  >
    <view class="adm-check-box">
      <text v-if="modelValue && !indeterminate" class="adm-check-icon">✓</text>
      <text v-else-if="indeterminate" class="adm-check-icon adm-check-icon--dash">−</text>
    </view>
    <view v-if="$slots.default" class="adm-check-label">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
  }>(),
  {
    indeterminate: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function onTap() {
  if (props.disabled) return;
  emit("update:modelValue", !props.modelValue);
}
</script>

<style scoped lang="scss">
.adm-check {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16rpx;
  min-height: 44rpx;
}
.adm-check--disabled {
  opacity: 0.45;
}
.adm-check-box {
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  margin-top: 2rpx;
  border-radius: 10rpx;
  border: 2rpx solid rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.adm-check--on .adm-check-box,
.adm-check--indeterminate .adm-check-box {
  border-color: #22c55e;
  background: #22c55e;
}
.adm-check-icon {
  font-size: 26rpx;
  font-weight: 700;
  color: #052e16;
  line-height: 1;
}
.adm-check-icon--dash {
  font-size: 32rpx;
  margin-top: -4rpx;
}
.adm-check-label {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: #e2e8f0;
  line-height: 1.45;
}
</style>
