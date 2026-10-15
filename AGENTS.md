# AGENTS.md

## Project

**claw-fry-cards** — OpenClaw 飞书/Lark **通道插件**（id: `claw-fry-cards`），基于官方 [larksuite/openclaw-lark](https://github.com/larksuite/openclaw-lark)（MIT）做 OpenClaw 2.0 SDK 适配，并内置 fry 风格 CardKit v2.0 流式卡片引擎（🍤 虾条卡片）。

- TypeScript, ESM, Node >= 22, 构建用 tsdown，测试用 vitest，安装依赖需 `npm install --legacy-peer-deps`（官方 fork 的 peer 依赖约束）。
- 入口 `index.ts`：`definePluginEntry`（来自 `openclaw/plugin-sdk/plugin-entry`）注册通道 + 38 项工具契约 + hooks + CLI 诊断命令。
- 版本线：main 为**插件自身 3.x** 通道插件（唯一维护线，当前 v3.1.0+）；形态自 2.0 起固定为通道插件。**1.0（钩子伴侣插件形态）保留在 `v1.0.0` 标签**，自 2026-09-13 起冻结，仅为历史降级保留，新装不要checkout。前身 claw-lark-cards 仓库已废弃合并至此。

## Commands

```bash
npm install --legacy-peer-deps
npm test              # vitest run
npm run typecheck     # tsc --noEmit
npm run build         # tsdown → dist/（index.mjs + monitor-<hash>.mjs 分 chunk）
npm run lint          # eslint src/ index.ts secret-contract-api.ts
```

## Architecture

```
index.ts                 插件入口：register() 注册通道/工具/hooks/CLI；re-export 对外 API
src/card/                卡片引擎（fry 风格核心）
  builder.ts               卡片 JSON 构建（含统一面板 header）
  cardkit.ts               CardKit 开放 API 封装（create/element.content/update）
  streaming-card-controller.ts  流式卡控制器（统一面板指标读 transcript SQLite）
  flush-controller.ts      节流刷新（timer + mutex + reflush-on-conflict）
  reply-dispatcher.ts      回复分发（streaming/static/auto 场景路由）
  tool-use-display.ts / tool-use-trace-store.ts   工具步骤展示与追踪
  reasoning-utils.ts       原生 reasoning 处理
src/channel/             feishu 通道实现（websocket 长连接、账号、探针）
src/messaging/           收发消息、媒体、converters（interactive 卡片消息解析）
src/tools/               oapi（bitable/calendar/chat/drive/im/sheets/task/wiki）+ mcp 文档工具 + oauth
src/commands/            feishu-diagnose 诊断 CLI
src/core/                LarkClient（@larksuiteoapi/node-sdk 封装）、logger、targets、安全检查
  channel-message-compat.ts  channel-message 垫片（channel-outbound→channel-message→channel-runtime）
  command-auth-compat.ts     command-auth 垫片（10.x 重建组合器；≤9.x 透传）
  session-store-compat.ts    session-store 垫片（getSessionEntry；≤9.x 回落旧全量存储对）
  sdk-compat.ts              readReactionParams 签名适配（2026.3.14 起变更）
skills/                  官方技能目录（openclaw.plugin.json 声明）
```

## Key constraints

- **插件 id 已从 `openclaw-lark` 更名为 `claw-fry-cards`**（package.json / openclaw.plugin.json / index.ts 三处一致）；用户配置键 `plugins.entries.claw-fry-cards`，通道配置 `channels.feishu` 不变。
- 流式卡片开关按宿主代际：2026.9.4+ 宿主 `streaming: { mode: "partial" }`（`replyMode` 已废弃）；旧宿主 `streaming: true` + `replyMode`。插件端两代兼容（2.0.2 起）。
- **`streaming`/`replyMode` 必须写在 `channels.feishu`（通道账号配置）下**，不是 `plugins.entries.claw-fry-cards.config`——插件 configSchema 只声明 `panel`，写到 plugin config 里的 `feishu` 块会被静默忽略（网关不报错不警告），回复模式解析退化为 `static`（纯文本无卡片）。判定证据看日志 `reply-dispatcher` 的 `reply mode resolved` 探针行。真实事故：2026-10-08 Docker 部署配置错位排查半天才定位。TODO：后续版本可在插件启动时对 plugin config 中未识别键打 warning（网关 schema 校验目前是 loose 的）。
- 统一面板指标来源是 agent transcript SQLite（`~/.openclaw/agents/<agent>/agent/openclaw-agent.sqlite`）；读取失败时静默省略指标段，不报错。
- 宿主兼容下限 OpenClaw **2026.5.4**（2.0.5 起 channel-message 垫片回落 channel-runtime；无垫片的 2.0.4 为 ≥2026.5.12），见 `docs/compat-test-report.md`；SDK 子路径导出以宿主 package.json 的 exports 为准，裸的 `openclaw/plugin-sdk` 在宿主 ≥2026.8.1 已移除。
- **宿主 2026.10.3 断崖与三类破坏**（3.1.0 适配）：① 子路径移除（`channel-message`、`command-auth` 等 9 个）；② **子路径仍在但具名导出被删**（`session-store-runtime` 的 `loadSessionStore`/`resolveSessionStoreEntry`）——这类**子路径比对查不到**，import 期直接 SyntaxError 且 `try/catch` 救不了，**升级评估必须逐符号核对值导入，不能只比子路径**。三个垫片：`src/core/channel-message-compat.ts`（channel-outbound→channel-message→channel-runtime 三代回落）、`src/core/command-auth-compat.ts`（10.x 用存活原语按原语义重建组合器；≤9.x 透传）、`src/core/session-store-compat.ts`（`getSessionEntry`；≤9.x 回落旧全量存储对）。三者均用 `createRequire` 同步解析、禁 TLA。10.x 真机 E2E 尚未跑。
- 构建产物分 chunk（`index.mjs` + `secret-contract-api.mjs` + `monitor-<hash>.mjs`），部署时需全部拷贝并清理旧 hash 残留；`secret-contract-api.mjs` 是插件根目录发现 shim（`secret-contract-api.js`）的 re-export 目标（密钥字段解析依赖），漏拷会导致通道无法认证。
- 本地安装：`openclaw plugins install . --force --accept-capabilities`；安装源目录不能 world-writable（777 会被 `blocked plugin candidate` 拒绝）。
- 版本号用三位 semver（1.0.0 / 2.0.0 / 3.0.0…），发版打 `v<版本>` 标签。
- Commit messages: body should use bullet list format (unnumbered `- item`).
