import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

const ROOT = process.cwd();
const PROJECT_CONFIG_PATH = path.join(ROOT, "project.config.json");

function readProjectApiOrigin(): string {
  try {
    const raw = JSON.parse(fs.readFileSync(PROJECT_CONFIG_PATH, "utf8")) as {
      apiOrigin?: string;
    };
    return String(raw.apiOrigin || "")
      .trim()
      .replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/** 把 apiOrigin 写入产物 project.config.json，便于在微信开发者工具里直接看到/改 */
function syncApiOriginToMpProjectConfig(): Plugin {
  return {
    name: "phh-sync-api-origin-project-config",
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir;
      if (!outDir || !/[\\/]mp-weixin$/i.test(outDir.replace(/[\\/]+$/, ""))) {
        return;
      }
      const dest = path.join(outDir, "project.config.json");
      let cfg: Record<string, unknown> = {};
      try {
        if (fs.existsSync(dest)) {
          cfg = JSON.parse(fs.readFileSync(dest, "utf8")) as Record<
            string,
            unknown
          >;
        }
      } catch {
        cfg = {};
      }
      try {
        const rootCfg = JSON.parse(
          fs.readFileSync(PROJECT_CONFIG_PATH, "utf8"),
        ) as Record<string, unknown>;
        if (rootCfg.apiOrigin) cfg.apiOrigin = rootCfg.apiOrigin;
        if (rootCfg.description) cfg.description = rootCfg.description;
        if (rootCfg.setting && typeof rootCfg.setting === "object") {
          cfg.setting = {
            ...((cfg.setting as object) || {}),
            ...(rootCfg.setting as object),
          };
        }
      } catch {
        // ignore
      }
      fs.writeFileSync(dest, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, "");
  const projectApiOrigin = readProjectApiOrigin();
  if (projectApiOrigin) {
    process.env.VITE_API_ORIGIN = projectApiOrigin;
    env.VITE_API_ORIGIN = projectApiOrigin;
  }

  const devProxyTarget =
    env.VITE_COMMENTARY_DEV_PROXY_TARGET || "http://127.0.0.1:9000";

  return {
    plugins: [uni(), syncApiOriginToMpProjectConfig()],
    define: projectApiOrigin
      ? {
          "import.meta.env.VITE_API_ORIGIN": JSON.stringify(projectApiOrigin),
        }
      : undefined,
    server: {
      proxy: {
        // 实验室 LLM 跑测可达数分钟；避免 Vite 代理先断开
        "/v1": {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
          timeout: 1_200_000,
          proxyTimeout: 1_200_000,
        },
        "/v2": {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
          timeout: 1_200_000,
          proxyTimeout: 1_200_000,
        },
        "/v3": {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
          timeout: 1_200_000,
          proxyTimeout: 1_200_000,
        },
      },
    },
  };
});
