<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
onLaunch(() => {
  console.log("App Launch");
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style lang="scss">
page {
  height: 100%;
  box-sizing: border-box;
  background-color: $uni-bg-color-page;
  color: $uni-text-color-primary;
}
</style>
