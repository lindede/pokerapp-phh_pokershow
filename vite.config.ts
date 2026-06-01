import { defineConfig, loadEnv } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const commentaryDevProxyTarget =
    env.VITE_COMMENTARY_DEV_PROXY_TARGET || "http://127.0.0.1:9000";
  const voiceDevProxyTarget =
    env.VITE_VOICE_DEV_PROXY_TARGET || "https://www.pokershow.top";

  return {
    plugins: [uni()],
    server: {
      proxy: {
        // 语音接口：本地后端常未部署，开发默认走线上
        "/v2/Commentary/voice": {
          target: voiceDevProxyTarget,
          changeOrigin: true,
          secure: true,
        },
        // H5 开发走同源代理，避免浏览器跨域拦截 CommentaryLite 等 /v1 接口
        "/v1": {
          target: commentaryDevProxyTarget,
          changeOrigin: true,
          // 若把代理目标改成 https 且证书异常，可改为 false
          secure: true,
        },
        "/v2": {
          target: commentaryDevProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
