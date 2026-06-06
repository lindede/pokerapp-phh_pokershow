# 博弈秀（phh-pokershow）

德州扑克手牌解说与逐步回放前端。基于 **uni-app + Vue 3 + TypeScript**，一套代码支持 **H5**、**微信小程序** 等平台。

## 功能概览

- **手牌逐步回放**：按 `by_action` 时间线还原发牌、下注、弃牌、摊牌等动作
- **中文解说**：每步展示解说 headline / detail，步进时长随文案长度或语音时长调整
- **语音解说**：对接 `/v2/Commentary/voice/*`，支持逐步播放与开关
- **Hero 视角**：服务端 meta 含 `hero_seat_index` 时，Hero 常亮，他人发牌/弃牌快进
- **稳定分享**：`meta.id` 支持 `k=all&id=` 链接（H5 / 小程序分享与首屏打开）
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

H5 使用 hash 路由，参数可写在 `?` 或 `#/pages/index/index?` 后；微信小程序通过页面路径 query 传入（与分享链接一致）。

| 参数 | 说明 | 示例 |
|---|---|---|
| `k` | 列表名称（数据集 key）；**目前仅支持 `all`** | `all` |
| `id` | 稳定条目 id（`meta.id`）；与 `k` 同时存在时首屏走 `/v2/Commentary/data` | `175` |
| `i` | 手牌编号（`meta.i`）；`-1` 表示随机/当前局；无 `id` 时用 `k+i` 走 `/v1/CommentaryLite` | `2`、`-1` |
| `m=rv` | 录屏/嵌入模式：跳过介绍弹窗，固定 540px 竖屏 viewport | `m=rv` |
| `ls=1` | 横屏 16:9 布局（1280×720 viewport），优先于 `m=rv` 的宽度设置 | `ls=1` |

**首屏加载优先级**（H5 / 小程序相同）：

1. 同时有 `k` + `id` → `GET /v2/Commentary/data?k=&id=`
2. 同时有 `k` + `i` → `GET /v1/CommentaryLite?k=&i=`
3. 否则 → 默认 `k=all`、`i=-1`

示例：

```
# 稳定 id 打开（分享推荐）
http://localhost:5173/#/?k=all&id=175

# 按列表序号打开
http://localhost:5173/#/?k=all&i=-1
http://localhost:5173/#/?k=all&i=2

# 录屏 / 横屏
http://localhost:5173/#/?k=all&i=5&m=rv
http://localhost:5173/#/?k=all&i=5&m=rv&ls=1
```

`k` 目前固定为 `all`（旧版形如 `v1_NLH_BB100_...` 的名称已废弃）。

**说明**：应用内「上一局 / 下一局」仍用 `CommentaryLite` + `meta.i` 递增/递减；语音 list/data、胜率接口也仍绑定响应里的 `meta.i`。`id` 主要用于分享链接与带参首屏打开。

## 分享链接（微信小程序）

`onShareAppMessage` 优先使用稳定 id：

- 有 `meta.id` → `/pages/index/index?k=all&id=xxx`
- 无 `meta.id`（旧数据）→ `/pages/index/index?k=all&i=5`

## 后端 meta 字段

| 字段 | 含义 | 前端用途 |
|---|---|---|
| `meta.k` | 数据集 key | `state.datasetKey` |
| `meta.i` | 列表内手牌序号 | 下一局/语音/胜率请求 |
| `meta.id` | 稳定条目 id | 分享、`k+id` 首屏、`state.commentaryId` |
| `meta.hero_seat_index` | Hero 座位（0 起） | Hero 模式判定、黄框高亮；换局无此字段时清空 |

## 后端接口

### H5 开发

Vite 将 `/v1`、`/v2` 代理到本地后端，避免 CORS。代理目标由 `.env.development` 配置：

```env
VITE_COMMENTARY_DEV_PROXY_TARGET=http://127.0.0.1:9000
```

### 主要 API

| 路径 | 用途 |
|---|---|
| `GET /v1/CommentaryLite?k=&i=` | 手牌解说与 `by_action` 时间线（下一局、默认首屏） |
| `GET /v2/Commentary/data?k=&id=` | 按稳定 id 拉取手牌（分享链接、`k+id` 首屏） |
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

换局（下一局 / 新 payload）时，若新 meta **无** `hero_seat_index`，前端会清空 Hero 状态，避免仍按 Hero 16ms 快进。

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
2. 用微信开发者工具打开 **`dist/dev/mp-weixin`**（开发）或 **`dist/build/mp-weixin`**（生产）
3. 修改源码后需重新 build，并在开发者工具中 **编译**；若界面像旧版，可 **清缓存 → 全部清除** 后再编译
4. AppID 见 `src/manifest.json` → `mp-weixin.appid`
5. 正式环境需在小程序后台配置合法 request 域名；手机预览/正式版需 **上传** 后才会更新（与本地 `dist` 无关）

H5 与小程序共用同一套源码；小程序不会自动热更新 `dist`，务必指向上述目录而非项目根目录。

## 开发说明

- 接口失败时会回退到 `src/mock/sample-commentary.ts` 中的示例手牌（H5 非微信端）
- PC 浏览器 H5 提供手动横竖屏布局切换；手机端随系统旋转
- 录屏场景（`m=rv` + WebVideoCreator）使用 `commentaryVoiceRecording.ts` 注入 capture 音频

## License

Private / 内部项目。如需对外发布请补充授权说明。
