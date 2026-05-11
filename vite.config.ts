import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    proxy: {
      // H5 开发走同源代理，避免浏览器跨域拦截 commentary2
      "/v1": {
        target: "http://127.0.0.1:9000",
        changeOrigin: true,
      },
    },
  },
});
