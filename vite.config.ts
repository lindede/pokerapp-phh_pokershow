import { defineConfig, loadEnv } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devProxyTarget =
    env.VITE_COMMENTARY_DEV_PROXY_TARGET || "http://127.0.0.1:9000";

  return {
    plugins: [uni()],
    server: {
      proxy: {
        "/v1": {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
        },
        "/v2": {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
