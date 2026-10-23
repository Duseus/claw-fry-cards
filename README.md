<div align="center">

# 🕊️ claw-lark-cards — OpenClaw 飞书通道原生流式卡片插件

**OpenClaw 飞书 / Lark 通道插件：CardKit v2.0 流式消息 · Hermes 风格顶级卡片 · 实时工具步骤追踪 · 一键停止按钮 · 自适应长文本保护 · 统一指标面板 · 峰谷价标识**

[![Release](https://img.shields.io/github/v/release/Duseus/claw-lark-cards?label=%E7%89%88%E6%9C%AC&color=2563eb)](https://github.com/Duseus/claw-lark-cards/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/Duseus/claw-lark-cards/ci.yml?branch=main&label=CI)](https://github.com/Duseus/claw-lark-cards/actions/workflows/ci.yml)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-%E2%89%A5%202026.5.4-2463eb)](https://openclaw.ai)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A5%2022-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/github/license/Duseus/claw-lark-cards?label=%E8%AE%B8%E5%8F%AF&color=f59e0b)](LICENSE)

[特性](#-特性) · [快速安装](#-快速安装) · [核心配置](#-配置指南) · [Hermes卡片模式](#-hermes-原生流式卡片体系hermescardstyle-默认强化) · [开发](#-本地开发与测试) · [致敬与致谢](#-致敬与致谢-credits--acknowledgments) · [许可证](#-许可证)

<img src="assets/card-demo.png" width="860" alt="卡片效果示例">

</div>

> **这是什么**：一个专为 **OpenClaw Agent** 深度打造的**飞书 / Lark 原生通道插件**（完全替代官方已停更的 `@larksuite/openclaw-lark` / `@openclaw/feishu`）。负责 OpenClaw Agent 的全功能飞书消息收发，并以 **CardKit v2.0 原生流式卡片 + Hermes 风格顶级状态面板** 呈现每一轮交互。  
> **项目背景与独立维护说明**：本项目基于社区优秀的开源项目 [techysy/claw-fry-cards](https://github.com/techysy/claw-fry-cards) 深度二次研发，由 **Duseus** 团队作为独立代码仓维护。在全面吸收 upstream 优秀卡片架构的基础上，补齐了 Hermes 级原生卡片视觉规范、流式实时命令执行透明化、一键物理停止生成按钮、自适应长卡片撑爆保护，以及针对 OpenClaw 2.0 (2026.10.x+) 底层 SQLite 转录的深度融合适配。

---

## 🙏 致敬与致谢 (Credits & Acknowledgments)

开源的繁荣源于巨人的肩膀与社区的不断接力，特此向以下上游项目与开发者致以崇高敬意：

1. **[techysy/claw-fry-cards](https://github.com/techysy/claw-fry-cards)**：
   - 感谢 **techysy** 开拓并实现了将 CardKit 2.0 流式消息、打字机动画、峰谷计费标识与折叠指标面板融为一体的经典架构；
   - 感谢上游在 2026.10.x SDK 兼容垫片上的扎实探索，本项目继承并拓展了其核心能力。
2. **[larksuite/openclaw-lark](https://github.com/larksuite/openclaw-lark)**：
   - 感谢飞书官方团队与早期社区贡献者构建的飞书通道底层通信桥梁。
3. **[@Mirr0ch1](https://github.com/Mirr0ch1)**：
   - 感谢其在早期为 OpenClaw 2.0 基础适配所奠定的重要基础。

---

## ✨ 核心亮点与深度改造

### 1. 🕊️ Hermes 原生流式卡片体系（`hermesCardStyle` 默认强化）

全面对齐 Hermes / Antigravity 工业级飞书流式交互规范，告别粗糙纯文本与散乱卡片：

- 🎨 **Card 2.0 顶级彩色状态条 Header**：
  - 💭 **处理中...**（流式思考生成中，采用清爽的 `blue` 蓝条，调用工具时动态指示 `⚡ {toolName}: {command/detail}`）；
  - ✅ **已完成**（正常收官，优雅的 `green` 绿条）；
  - ❌ **执行出错 / 已停止**（异常即时红条预警，错误原因一目了然）。
- 🛠️ **实时工具流水透明化与动态命令展示**：
  - 首创在思考流式阶段注入折叠进度条：`🧠 1 轮 · 🛠️ N 个工具 · ⏳ 0.0 秒`；
  - 实时解析工具入参与脚本命令，动态透视正在执行的操作细节（如 `Run command: git status`），等待不再两眼一抹黑！
- ⏹️ **流式物理停止按钮（一键打断）**：
  - 在生成中的卡片底部原生注入 **「⏹️ 停止生成」** 交互按钮；用户一键点击直接毫秒级中断本地会话执行，并即时弹出飞书 Toast 反馈！
- 🛡️ **自适应长文本截断保护（Anti-Runaway）**：
  - 对单个超长工具输出（如数千行编译日志或数据转储）进行智能折叠截断保护，彻底防止飞书单卡 30KB 撑爆导致的卡片报错退化！
- 📝 **极简 3 行流式小字底栏**：
  - **Line 1（状态与指标）**：`✅ 已完成 · 38.7s · ⚕glm-5.3-flash · 输入 31.8K 输出 1.6K 思考 859 · 31.8K/128K (25%)`；
  - **Line 2（实时环境）**：`☀️ 杭州 26.0/20.0°C · 湿度 88% · 空气质量 70 · 日出 06:03 日落 17:23`（异步静默极速直达）；
  - **Line 3（人文底蕴）**：`💬 「黄沙百战穿金甲，不破楼兰终不还。」—— 从军行七首·其四`。

### 2. ⚡ 原生 CardKit 打字机与零等待

- **派发即建卡**：用户消息到达 1 秒内建立响应卡片，杜绝网络与冷启动空白等待焦虑；
- **打字机流畅上屏**：依托飞书 CardKit 原生 `streaming_mode`，字符行云流水滚动更新；
- **代码块排版抗撕裂**：彻底修复代码块包裹中的换行转义与 `<br>` 破损问题，Markdown 原样高保真呈现。

### 3. 🎯 统一折叠指标面板与峰谷计费

- **一站式指标概览**：耗时、Tokens 消耗、上下文占用百分比、Cache 命中率、推理速度（tok/s）单行优雅汇总；
- **峰谷计费自动变身**：支持工作日峰谷段切换模型显示名（如 DeepSeek 峰段显示 `梁文锋⚡️` / 谷段显示 `梁文谷⚡️`），成本尽在掌握。

### 4. 🚀 OpenClaw 2.0 (2026.10.x+) 深度原生契合

- **直接对齐新架构**：全面适配 OpenClaw 2.0+ 的 SQLite 转录架构，指标直接读取 `openclaw-agent.sqlite`，彻底告别废弃的 `sessions.json`；
- **全链路兼容垫片**：内置 `@openclaw/plugin-sdk` 10.x 完整接口契约。

---

## 📦 快速安装

**环境要求**：
- OpenClaw ≥ 2026.5.4（强烈推荐 **2026.10.3+**）
- Node.js ≥ 22

### 方式一：一键脚本构建安装（推荐 · Agent 友好）

```bash
curl -fsSL https://raw.githubusercontent.com/Duseus/claw-lark-cards/main/install.sh | bash
```

脚本将自动克隆当前仓库源码、构建 ESM 产物并注册到 OpenClaw 网关。安装完成后重启网关生效：

```bash
openclaw gateway restart
```

### 方式二：源码克隆安装

```bash
# 1. 克隆 Duseus 独立代码仓库
git clone https://github.com/Duseus/claw-lark-cards.git
cd claw-lark-cards

# 2. 安装依赖并构建 ESM 产物
npm install --legacy-peer-deps
npm run build

# 3. 安装并注册到 OpenClaw
openclaw plugins install . --force --accept-capabilities

# 4. 重启网关生效
openclaw gateway restart
```

> ⚠️ **卸载旧版官方通道**：若系统之前装有旧版官方通道，请先执行 `openclaw plugins uninstall feishu --force`，防止插件版本冲突。

---

## ⚙️ 配置指南

在 `~/.openclaw/openclaw.json` 中配置飞书凭据与流式面板：

> 💡 **架构贴士**：为保持与现有配置及 Control UI 设置项的 100% 向上兼容，底层插件配置节点维持 `claw-fry-cards` 键名不变，存量配置无缝平滑迁移。

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "domain": "feishu",
      "connectionMode": "websocket",
      "appId": "cli_xxxxxxxx",
      "appSecret": "xxxxxxxx",
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "open",
      "groupAllowFrom": ["*"],
      "requireMention": true,
      "streaming": { "mode": "partial" }
    }
  },
  "plugins": {
    "entries": {
      "claw-fry-cards": {
        "enabled": true,
        "config": {
          "panel": {
            "hermesCardStyle": true,
            "unifiedPanelMinDuration": 5,
            "contextDisplayMode": "text",
            "peakValley": {
              "deepseek": {
                "peakName": "梁文锋⚡️",
                "valleyName": "梁文谷⚡️",
                "schedule": "deepseek"
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 🧪 本地开发与测试

```bash
# 安装开发依赖
npm install --legacy-peer-deps

# 编译 ESM 模块至 dist/
npm run build

# 自动化测试
npm test

# 严格类型检查
npm run typecheck
```

---

## 🔒 免责与安全说明

- 本项目由 **Duseus** 团队在遵循开源许可证的前提下独立维护演进；
- 请妥善保管飞书开放平台的 App ID 与 App Secret，严禁将私密凭据提交至公共版本控制系统中。

## 📄 许可证

本项目基于 [MIT](LICENSE) 许可证开源发布。
