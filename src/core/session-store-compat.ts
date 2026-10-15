/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Session-store SDK compat shim.
 *
 * OpenClaw 2026.10.3 移除了 `plugin-sdk/session-store-runtime` 的两个「全量存储」
 * 辅助函数——注意子路径本身仍在，是本插件子路径比对**查不到**的那类破坏
 * （具名导出消失，import 阶段 SyntaxError，try/catch 救不了）：
 *
 *   - `loadSessionStore(storePath)`           → 已移除
 *   - `resolveSessionStoreEntry({store,key})` → 已移除
 *
 * 9.4 的 d.ts 早已写明这是限时兼容桥：
 *   "Keep the compatibility projection through 2026-10-12, then remove it only
 *    after the minimum supported plugin version excludes that release."
 * 10.3 兑现了移除。官方替代（**9.4 起就已提供**）：
 *
 *   `getSessionEntry({ agentId, sessionKey, storePath })` → SessionEntry | undefined
 *
 * 故本垫片：
 *   - 提供 `readSessionEntry(params)`：新宿主直通 `getSessionEntry`；老宿主用
 *     `loadSessionStore` + `resolveSessionStoreEntry` 复现同一语义。
 *   - 复用两代都存在的 `resolveStorePath`，不代管。
 *
 * 用 createRequire 同步解析（网关的插件加载器不支持顶层 await，禁止 TLA）；
 * 首次调用时解析并缓存。
 */

import { createRequire } from 'node:module';

interface SessionEntryLike {
  verboseLevel?: unknown;
  [key: string]: unknown;
}

interface SessionStoreRuntimeSdk {
  resolveStorePath: (storePath: string | undefined, opts: { agentId: string }) => string;
  getSessionEntry?: (params: {
    agentId?: string;
    sessionKey: string;
    storePath?: string;
  }) => SessionEntryLike | undefined;
  loadSessionStore?: (storePath: string) => Record<string, SessionEntryLike>;
  resolveSessionStoreEntry?: (params: { store: Record<string, SessionEntryLike>; sessionKey: string }) => {
    existing: SessionEntryLike | undefined;
  };
}

const requireSdk = createRequire(import.meta.url);

let cached: SessionStoreRuntimeSdk | null = null;

function resolveSdk(): SessionStoreRuntimeSdk {
  if (cached) return cached;
  const mod = requireSdk('openclaw/plugin-sdk/session-store-runtime') as SessionStoreRuntimeSdk;
  if (typeof mod.resolveStorePath !== 'function') {
    throw new Error('session-store-compat: openclaw/plugin-sdk/session-store-runtime is missing resolveStorePath');
  }
  cached = mod;
  return cached;
}

/** 解析会话存储文件路径（两代同签名，直接转发）。 */
export function resolveStorePath(storePath: string | undefined, opts: { agentId: string }): string {
  return resolveSdk().resolveStorePath(storePath, opts);
}

/**
 * 读单个会话条目。
 *
 * 新宿主（10.x+）：`getSessionEntry` 直接按 identity 读取。
 * 老宿主（≤9.x）：`loadSessionStore` 载入全量存储后按 key 查找。
 *
 * 两者语义等价——原 `resolveSessionStoreEntry` 也只是在已载入的 store 上做
 * key 规范化查找，最终同样返回 `existing`。
 */
export function readSessionEntry(params: {
  agentId: string;
  sessionKey: string;
  storePath: string | undefined;
}): SessionEntryLike | undefined {
  const sdk = resolveSdk();

  if (typeof sdk.getSessionEntry === 'function') {
    return sdk.getSessionEntry({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      storePath: params.storePath,
    });
  }

  // 老宿主回落路径。
  if (typeof sdk.loadSessionStore === 'function' && typeof sdk.resolveSessionStoreEntry === 'function') {
    const store = sdk.loadSessionStore(resolveSdk().resolveStorePath(params.storePath, { agentId: params.agentId }));
    return sdk.resolveSessionStoreEntry({ store, sessionKey: params.sessionKey }).existing;
  }

  throw new Error('session-store-compat: host exposes neither getSessionEntry nor the legacy loadSessionStore pair');
}
