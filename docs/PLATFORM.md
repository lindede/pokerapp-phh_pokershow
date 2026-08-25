# 平台前端说明

完整架构见分析服务仓库 [`docs/PLATFORM.md`](../../pokerapp-phh_analysis_service/docs/PLATFORM.md)。

## 本地开发

1. 分析服务 `.env` 开启 `PLATFORM_ENABLED=true` 并配置 `DATABASE_URL`、`REDIS_URL`、微信密钥
2. 执行 `migrations/001_platform.sql`
3. `npm run dev:h5` — Vite 已代理 `/v3` 到 9000

## 页面

| 路径 | 说明 |
|------|------|
| `pages/profile/index` | 登录、@号、信用、H5 扫码 / 小程序确认 |
| `pages/admin/*` | 管理端（P4 待建） |

## 代码

- `src/config/auth-api.ts` — `/v3` 地址
- `src/composables/useAuth.ts` — Token、登录、轮询 Ticket
