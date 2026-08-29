<template>
  <text class="adm-badge" :class="`adm-badge--${tone}`">{{ label }}</text>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    tone?: "default" | "success" | "warn" | "danger" | "info" | "muted";
  }>(),
  { tone: "default" },
);
</script>

<style scoped lang="scss">
.adm-badge {
  display: inline-block;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.35;
  vertical-align: middle;
}
.adm-badge--default {
  color: #cbd5e1;
  background: rgba(148, 163, 184, 0.16);
}
.adm-badge--muted {
  color: #64748b;
  background: rgba(100, 116, 139, 0.12);
}
.adm-badge--success {
  color: #86efac;
  background: rgba(34, 197, 94, 0.14);
}
.adm-badge--warn {
  color: #fde68a;
  background: rgba(251, 191, 36, 0.14);
}
.adm-badge--danger {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.14);
}
.adm-badge--info {
  color: #7dd3fc;
  background: rgba(56, 189, 248, 0.14);
}
</style>
