# 🧪 兼容性测试报告 — claw-fry-cards 对 OpenClaw 各版本宿主

- **版本**：claw-fry-cards 3.1.0（10.x 适配）· 2.0.4（npm 正式包）· 2.0.5-dev（兼容垫片）· 1.0（伴侣插件终版）
- **测试方法**：仿宿主沙箱（真实依赖树 + 递归 Proxy mock，见附录）× **真机**（Docker 2026.9.4 · 飞牛 fnOS 应用 2026.9.4）
- **环境**：Windows x64 · Node 24 · npm registry

## ✅ 结论速览

| 项 | 结论 |
|---|---|
| 兼容下限（无垫片，≤2.0.4）| OpenClaw **2026.5.12**（远低于官方插件时代的 2026.2.26 口径）|
| 兼容下限（2.0.5+ 垫片）| OpenClaw **2026.5.4** |
| 推荐宿主 | **2026.10.3**（真实生产容器 + 真实飞书凭据全链路 E2E 验证）；**2026.9.4** 亦受支持 |
| 断崖方向 | 裸导出 `./plugin-sdk` 在 2026.8.1 移除——新宿主跑不了旧插件（官方 openclaw-lark 失效原因），反向无此问题 |

## 🔻 2026.10.3 断崖与本插件适配（3.1.0）

宿主 10.3 的 `plugin-sdk` 子路径 **338 → 344，净增 6，但移除 9 个**（新增≠兼容，移除才是断崖）：

```
移除：/channel-message  /command-auth  /config-runtime  /channel-reply-pipeline
      /infra-runtime  /agent-harness-task-runtime  /discord  /channel-lifecycle  /telegram-account
```

本插件命中 2 个子路径移除（其余 7 项未使用），另有 **1 处「子路径仍在、具名导出消失」的隐性破坏**（子路径比对查不到）：

| # | 破坏点 | 类型 | 3.1.0 适配 |
|---|---|---|---|
| 1 | `plugin-sdk/channel-message` | 子路径移除 | 垫片首选改 `channel-outbound`（9.4+ 均在）|
| 2 | `plugin-sdk/command-auth` | 子路径移除 | 新垫片：10.x 用存活原语**按原语义重建**旧组合器；≤9.x 透传 |
| 3 | `plugin-sdk/session-store-runtime` 的 `loadSessionStore` / `resolveSessionStoreEntry` | **具名导出移除** | 新垫片：改用 9.4 起即有的 `getSessionEntry`；≤9.x 回落旧全量存储对 |

> ⚠️ **第 3 类是新的破坏形态**：子路径仍在，故 `package.json#exports` 比对显示「正常」；但具名导出已删，import 阶段直接 `SyntaxError: does not provide an export named`——**发生在模块实例化期，调用点的 `try/catch` 完全救不了**。9.4 的 d.ts 早已标注这是限时兼容桥（"Keep the compatibility projection through 2026-10-12"），10.3 如期移除。**后续做宿主升级评估时，必须逐符号核对值导入，不能只比子路径。**

适配覆盖度已用**全量值符号扫描**验证：插件 19 个子路径 / 25 个值导入符号在 10.3 中全部存在。

## 📊 兼容性矩阵（最终态）

## 📊 兼容性矩阵（最终态）

| OpenClaw 宿主 | 1.0 伴侣插件 | 2.0.4（npm 包）| 2.0.5+（垫片）| 备注 |
|---|---|---|---|---|
| 2026.5.4 | ✅ | ❌ 缺 `plugin-sdk/channel-message` 导出 | ✅ **垫片回落生效** | 负例/下限边界 |
| **2026.5.12** | ✅ | ✅ **实测下限** | ✅ | 下限定位：5.7 无该导出、5.12 起 |
| 2026.6.35 | ✅ | ✅ | ✅ | |
| 2026.7.1 | ✅ | ✅ | ✅ | 与 8.1 契约形状无漂移 |
| 2026.8.1+ | ✅ | ✅ | ✅ | 裸 `./plugin-sdk` 移除（内置插件不受影响）|
| **2026.9.4** | ✅ | ✅ | ✅ **推荐** | Docker + 飞牛 fnOS 真机 E2E 全链路 |
| **2026.10.3** | ❌ | ❌ 缺 `channel-message`/`command-auth` 等 | ✅ **推荐** | 子路径移除 + 具名导出移除，3.1.0 三垫片覆盖；**真实生产容器 + 真实飞书凭据全链路 E2E 通过**（见下）|

## 🔬 测试方法

### 仿宿主沙箱（加载级）

`npm install openclaw@<版本>` 装出真实宿主依赖树充当沙箱，插件构建产物放入后模拟加载器执行 `import` + `register(递归 Proxy mock)`——覆盖三类死法：裸包解析失败、子路径/命名导出缺失、宿主 API 方法缺失。配套 harness：[compat-test-harness.mjs](compat-test-harness.mjs)。

### 真机（运行级）

- **Docker**：`ghcr.io/openclaw/openclaw:latest`（2026.9.4）+ 插件，飞书 websocket 全链路；10.3 真实网关实测见下节
- **飞牛 fnOS 应用**：trim.openclaw 应用（Bun 包装层 + 原生网关），同为 2026.9.4——部署排障全程见 [nas-fnos-trip-report.md](nas-fnos-trip-report.md)、通用化指南见 [fnos-deploy-guide.md](fnos-deploy-guide.md)

**沙箱盲区（实证）**：插件兼容垫片首版使用顶层 await（TLA），沙箱（native import）全部通过，真实网关加载器直接 SyntaxError——**模块解析验证不能替代网关加载器语义，发版前必须过真实网关**（已改为 createRequire 同步解析）。

### 10.3 生产容器全链路实测（3.1.0，2026-10-15）

**环境**：`ghcr.io/openclaw/openclaw:2026.10.3` 真实容器，挂载原有 state 卷（真实飞书凭据 + 真实群），插件 3.1.0（npm 安装）。宿主由 2026.9.4 就地升级至 2026.10.3。

| 检查项 | 结果 |
|---|---|
| 宿主版本 | ✅ `OpenClaw 2026.10.3 (59cb447)` |
| 插件加载 | ✅ `claw-fry-cards 3.1.0` `enabled`，无加载错误 |
| 网关健康 | ✅ `Up (healthy)`，`/health` → `{"ok":true,"status":"live"}` |
| **飞书 websocket** | ✅ bot identity 解析成功，`client ready` + `ws client ready` |
| **入站消息** | ✅ 多群真实消息持续到达并被处理 |
| **出站回复** | ✅ `dispatch complete (queuedFinal=true, replies=1)` —— 真实消息走完「收→gate→agent→模型→回复」全链路 |
| **卡片引擎** | ✅ `progressCard.get` 调用成功（180ms）|
| channel-message 垫片 | ✅ 命中 `channel-outbound`（10.x 首选层）|
| command-auth 垫片 | ✅ 旧门面 `ERR_PACKAGE_PATH_NOT_EXPORTED` → 走重建路径；原语齐全 |
| session-store 垫片 | ✅ `getSessionEntry` 存在、`loadSessionStore`/`resolveSessionStoreEntry` 缺失 → 命中新路径 |
| 鉴权逻辑等价性 | ✅ 重建路径 vs 9.4 原实现：4 种用例（群/私聊 × 名单内/陌生人）结果**完全一致** |
| 配置保留 | ✅ `streaming.mode=partial`、panel 字段、飞书凭据均无损 |

**这是 10.x 分支代码首次在真实生产容器（真实飞书凭据）上运行并通过全链路验证。**

#### ⚠️ 升级到 10.x 的必查项：官方 feishu 插件抢占通道

宿主 2026.10.3 启动时会**自动安装并启用官方 `@openclaw/feishu` 通道插件**，与本插件抢占同一 `feishu` 通道：

```
[plugins] channel already registered: feishu (claw-fry-cards)
  source=.../node_modules/@openclaw/feishu/dist/index.js
```

- 实测对比：升级前 `plugins.entries` 仅 `['claw-fry-cards']`；升级后宿主自动写入 `'feishu'` 并置 `enabled`
- 本插件因先注册而保住通道，但官方插件仍 enabled 且尝试另起 websocket，状态混乱
- **修复**：`openclaw plugins disable feishu` → `plugins.entries.feishu = {"enabled":false}`，重启后冲突消失
- 这与本插件代码无关，属宿主自动启用行为；**每次宿主大版本升级后都需复查 `plugins.entries` 是否多出 `feishu`**

## 🎯 下限定位过程（2026.5.12 的由来）

2026.5.4 失败报缺 `./plugin-sdk/channel-message` 导出（必需子路径中唯一缺失项）→ `npm view openclaw@<版本> exports` 对中间稳定版二分 → 5.7 无、**5.12 起**有（5.7 与 5.12 之间无稳定版）→ 5.12 实测通过。

2.0.5 垫片后：`channel-message` 缺失时自动回落 `channel-runtime`（5.4 同名同签名，8.x 已移除故仅老宿主触发）——**下限从 5.12 下探至 5.4**。

## ✅ 已核对的关键接口

| 插件依赖的宿主 API | 2026.5.4 | 2026.5.12 | 2026.7.1 | 2026.9.4 |
|---|---|---|---|---|
| `api.on` / `logger` / `pluginConfig`（伴侣插件全依赖）| ✓ | ✓ | ✓ | ✓ |
| `registerChannel` / `registerTool` / `registerCommand` / `registerCli` / `registerInteractiveHandler` / `config` / `runtime`（通道插件依赖）| ✓ | ✓ | ✓ | ✓ |
| `ChannelPlugin` 契约必填项（id / meta / capabilities / config）| ✓ | ✓ | ✓ | ✓ |
| 垫片回落路径 `plugin-sdk/channel-runtime` | ✓ | ✓ | ✓（未触发）| ✗（不需要）|

## ⚠️ 范围与已知限制

1. **沙箱为加载级验证**：模块解析 + 注册 + 契约核对；卡片流转、飞书收发等运行级行为以 Docker/飞牛真机 E2E 为准（均已通过）
2. **统一面板指标**读 agent transcript SQLite：老宿主无此库时优雅降级（面板自动省略指标段，卡片与回复不受影响）
3. **fnOS 应用的差异全在 wrapper 层**（配置写入/preflight/进程管理，详见 [fnos-deploy-guide.md](fnos-deploy-guide.md) 坑 ①②③），不影响插件加载语义
4. claw-fry-cards 1.0 README 口径 ≥2026.2.26：实测覆盖至 5.4 通过，更早未测（其 API 面极小，风险低）

## 📎 附录：沙箱复现

```bash
mkdir sandbox && cd sandbox && npm init -y
npm install openclaw@2026.5.12 zod image-size @sinclair/typebox@0.34.49 @larksuiteoapi/node-sdk
# 插件 dist 放入 sandbox/plugin/dist 后：
node docs/compat-test-harness.mjs <sandbox>/plugin/dist/index.mjs withcfg
```
