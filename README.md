# 博弈秀（phh-pokershow）

德州扑克手牌解说与逐步回放前端。基于 **uni-app + Vue 3 + TypeScript**，一套代码支持 **H5**、**微信小程序** 等平台。

## 功能概览

- **手牌逐步回放**：按 `by_action` 时间线还原发牌、下注、弃牌、摊牌等动作
- **中文解说**：每步展示解说 headline / detail，步进时长随文案长度或语音时长调整
- **语音解说**：对接 `/v2/Commentary/voice/*`，支持逐步播放与开关
- **Hero 视角**：服务端 meta 含 `hero_seat_index` 时，Hero 常亮，他人发牌/弃牌快进
- **胜率曲线**：对接 `/v2/Commentary/additional/equity` 展示各步胜率
- **多布局模式**：竖屏、横屏（`ls=1`）、录屏嵌入（`m=rv`）等

## 技术栈

| 项 | 说明 |
|---|---|
| 框架 | [uni-app](https://uniapp.dcloud.net.cn/) 3.x |
| UI | Vue 3 Composition API |
| 构建 | Vite 5 |
| 语言 | TypeScript |
| 样式 | SCSS |

## 环境要求

- Node.js 18+（推荐 LTS）
- npm 9+

本地开发如需拉取真实手牌数据，需另行启动解说后端（默认 `http://127.0.0.1:9000`）。

## 快速开始

```bash
# 安装依赖
npm install

# H5 开发（默认端口见终端输出，通常 5173）
npm run dev

# 或指定监听所有网卡（局域网真机调试）
npm run dev:h5 -- --host 0.0.0.0
```

Windows 也可双击 `start_local_server.bat` 启动 H5 开发服务。

## 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` / `npm run dev:h5` | H5 开发 |
| `npm run dev:mp-weixin` | 微信小程序开发 |
| `npm run build:h5` | H5 生产构建，产物在 `dist/build/h5` |
| `npm run build:mp-weixin` | 微信小程序构建 |
| `npm run type-check` | TypeScript 类型检查 |

## URL 启动参数

H5 使用 hash 路由，参数可写在 `?` 或 `#/pages/index/index?` 后：

| 参数 | 说明 | 示例 |
|---|---|---|
| `k` | 列表名称（数据集 key）；**目前仅支持 `all`** | `all` |
| `i` | 手牌编号；`-1` 表示随机/当前局 | `2`、`-1` |
| `m=rv` | 录屏/嵌入模式：跳过介绍弹窗，固定 540px 竖屏 viewport | `m=rv` |
| `ls=1` | 横屏 16:9 布局（1280×720 viewport），优先于 `m=rv` 的宽度设置 | `ls=1` |

示例：

```
http://localhost:5173/#/?k=all&i=-1
http://localhost:5173/#/?k=all&i=2
http://localhost:5173/#/?k=all&i=5&m=rv
http://localhost:5173/#/?k=all&i=5&m=rv&ls=1
```

`k` 目前固定为 `all`（旧版形如 `v1_NLH_BB100_...` 的名称已废弃）。同时提供 `k`、`i` 时首屏直接请求对应手牌；否则默认 `k=all`、`i=-1`。

## 后端接口

### H5 开发

Vite 将 `/v1`、`/v2` 代理到本地后端，避免 CORS。代理目标由 `.env.development` 配置：

```env
VITE_COMMENTARY_DEV_PROXY_TARGET=http://127.0.0.1:9000
```

### 主要 API

| 路径 | 用途 |
|---|---|
| `GET /v1/CommentaryLite?k=&i=` | 手牌解说与 `by_action` 时间线 |
| `GET /v2/Commentary/voice/list?k=&i=` | 语音文件索引 |
| `GET /v2/Commentary/voice/data?k=&i=&f=` | 语音文件数据 |
| `GET /v2/Commentary/additional/equity?k=&i=` | 逐步胜率 |

- **H5 开发/生产**：请求同源 `/v1`、`/v2`（开发走 Vite 代理，生产需 Nginx 反代）
- **小程序**：直连 `https://www.pokershow.top`（见 `useCommentaryHand.ts` 条件编译）

## 回放时序

步进时长由 `src/utils/replayTiming.ts` 控制：

| 模式 | 发牌 / 弃牌 | 其他动作 |
|---|---|---|
| **Hero 模式**（meta 有 `hero_seat_index`） | ~16ms 快进 | 按文案长度，最短 2s |
| **非 Hero 模式** | 默认 1s；有语音则按语音时长 | 按文案长度，最短 2s |

Hero 模式下他人弃牌、发牌、摊牌等也会快进；非 Hero 模式下 `deal_hole`、`deal_board`、`fold` 固定 1 秒（有对应语音文件时由语音步进接管）。

## 项目结构

```
├── index.html              # H5 入口，抢先设置 rv/ls viewport
├── vite.config.ts          # Vite + uni 插件，/v1 /v2 开发代理
├── src/
│   ├── pages/index/        # 主页面（牌桌、回放控制、解说区）
│   ├── components/         # PokerCard、LaunchIntroModal 等
│   ├── composables/
│   │   └── useCommentaryHand.ts   # 手牌加载、回放、语音核心逻辑
│   ├── utils/
│   │   ├── commentary2Adapter.ts  # 服务端 JSON → 界面 payload
│   │   ├── replayByAction.ts      # 时间线 → 牌桌快照
│   │   ├── replayTiming.ts        # 步进时长
│   │   └── launchQuery.ts         # URL 启动参数
│   ├── types/              # TypeScript 类型定义
│   ├── config/             # API 配置（部分已迁移至 composable 条件编译）
│   └── mock/               # 本地示例数据（接口失败时兜底）
└── static/                 # 静态资源
```

## 生产部署（H5）

```bash
npm run build:h5
```

将 `dist/build/h5` 部署到静态服务器，并配置 Nginx（或其他）将 `/v1`、`/v2` 反向代理到解说后端。`.env.production` 中说明了与开发一致的同源策略。

## 微信小程序

1. `npm run dev:mp-weixin` 或 `npm run build:mp-weixin`
2. 用微信开发者工具打开 `dist/dev/mp-weixin` 或 `dist/build/mp-weixin`
3. AppID 见 `src/manifest.json` → `mp-weixin.appid`
4. 正式环境需在小程序后台配置合法 request 域名

## 开发说明

- 接口失败时会回退到 `src/mock/sample-commentary.ts` 中的示例手牌（H5 非微信端）
- PC 浏览器 H5 提供手动横竖屏布局切换；手机端随系统旋转
- 录屏场景（`m=rv` + WebVideoCreator）使用 `commentaryVoiceRecording.ts` 注入 capture 音频

## License

Private / 内部项目。如需对外发布请补充授权说明。
