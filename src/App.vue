<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {});
onShow(() => {});
onHide(() => {});
</script>
<style lang="scss">
page {
  height: 100%;
  box-sizing: border-box;
  background-color: #0a2e1e;
  color: #f1f5f9;
  overflow: hidden;
}

/* #ifdef H5 */
html,
body,
#app {
  height: 100%;
  overflow: hidden;
}

uni-page-body,
.uni-page-body,
uni-page,
.uni-page-wrapper {
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box;
}
/* #endif */

html.launch-ls page {
  background-color: #0a0a0a !important;
}
</style>
