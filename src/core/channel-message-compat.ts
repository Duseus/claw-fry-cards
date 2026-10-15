/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Channel-message SDK compat shim.
 *
 * `createReplyPrefixContext` / `createTypingCallbacks` 三个宿主代际分别由不同
 * 子路径导出，按以下顺序回落（三者同名同签名，实现同源）：
 *
 *   1. `plugin-sdk/channel-outbound`    ← 2026.9.4+（10.x 唯一存活路径）
 *   2. `plugin-sdk/channel-message`     ← 2026.5.12 ~ 9.x
 *   3. `plugin-sdk/channel-runtime`     ← 2026.5.4 垫片回落
 *
 * OpenClaw 2026.10.3 移除了 `channel-message`（`channel-runtime` 更早移除），
 * 故首选改为 `channel-outbound`——该路径在 9.4 与 10.3 均存在，向后不回溯。
 *
 * 用 createRequire 同步解析（网关的插件加载器不支持顶层 await，禁止 TLA）；
 * 首次调用时解析并缓存，调用点零改动。
 */

import { createRequire } from 'node:module';

interface ChannelMessageSdk {
  createReplyPrefixContext: typeof import('openclaw/plugin-sdk/channel-outbound').createReplyPrefixContext;
  createTypingCallbacks: typeof import('openclaw/plugin-sdk/channel-outbound').createTypingCallbacks;
}

const requireSdk = createRequire(import.meta.url);

/**
 * 按宿主代际尝试的子路径，从新到旧。
 * 用变量承载以绕开 TS 对字面量动态 require 的静态解析（老路径不在 9.4+ 类型表里）。
 */
const SPECIFIERS = [
  'openclaw/plugin-sdk/channel-outbound',
  'openclaw/plugin-sdk/channel-message',
  'openclaw/plugin-sdk/channel-runtime',
] as const;

let cached: ChannelMessageSdk | null = null;

function resolveSdk(): ChannelMessageSdk {
  if (cached) return cached;
  const errors: string[] = [];
  for (const specifier of SPECIFIERS) {
    try {
      const mod = requireSdk(specifier) as Partial<ChannelMessageSdk>;
      if (typeof mod.createReplyPrefixContext === 'function' && typeof mod.createTypingCallbacks === 'function') {
        cached = mod as ChannelMessageSdk;
        return cached;
      }
      errors.push(`${specifier}: missing exports`);
    } catch (error) {
      errors.push(`${specifier}: ${(error as Error).message}`);
    }
  }
  throw new Error(`channel-message-compat: no usable host SDK found. Tried:\n  ${errors.join('\n  ')}`);
}

export function createReplyPrefixContext(
  ...args: Parameters<ChannelMessageSdk['createReplyPrefixContext']>
): ReturnType<ChannelMessageSdk['createReplyPrefixContext']> {
  return resolveSdk().createReplyPrefixContext(...args);
}

export function createTypingCallbacks(
  ...args: Parameters<ChannelMessageSdk['createTypingCallbacks']>
): ReturnType<ChannelMessageSdk['createTypingCallbacks']> {
  return resolveSdk().createTypingCallbacks(...args);
}
