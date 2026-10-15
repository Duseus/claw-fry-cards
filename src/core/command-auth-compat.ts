/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Command-auth SDK compat shim.
 *
 * OpenClaw 2026.10.3 移除了 `openclaw/plugin-sdk/command-auth` 这个聚合门面
 * （其全部导出早已在 9.4 被标记 @deprecated，官方指向 channel-ingress-runtime）。
 * 但该门面包装的组合器 `resolveSenderCommandAuthorization` 所依赖的**每一个**
 * 原语在 10.3 中仍作为公共 SDK 导出存活：
 *
 *   - `resolveDmGroupAccessWithLists`        → `plugin-sdk/channel-policy`
 *   - `resolveCommandAuthorizedFromAuthorizers` → `plugin-sdk/command-auth-native`
 *   - `shouldComputeCommandAuthorized`       → `plugin-sdk/command-detection`
 *   - `expandAllowFromWithAccessGroups`      → `plugin-sdk/access-groups`
 *
 * 因此本垫片按宿主代际二段解析：
 *   1. `plugin-sdk/command-auth` — 2026.5.4 ~ 9.x，直接透传原实现
 *   2. 10.x — 用上述保留原语**按原语义**重建同一组合器
 *
 * 之所以不用官方推荐的 `resolveChannelMessageIngress`：其入参是约 20 个结构化
 * 描述符字段（identity/conversation/event/adapter…），出参是六段投影，与本插件
 * 既有的扁平 8 字段调用点形状不兼容；而旧组合器语义单一（DM/群 allowlist →
 * commandAuthorized），用保留原语重建可做到逐行等价、零行为漂移。
 *
 * 用 createRequire 同步解析（网关的插件加载器不支持顶层 await，禁止 TLA）；
 * 首次调用时解析并缓存，调用点零改动。
 */

import { createRequire } from 'node:module';

import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

interface AuthorizerEntry {
  configured: boolean;
  allowed: boolean;
}

interface ResolveSenderCommandAuthorizationParams {
  cfg: OpenClawConfig;
  rawBody: string;
  isGroup: boolean;
  dmPolicy: string;
  configuredAllowFrom: string[];
  configuredGroupAllowFrom?: string[];
  senderId: string;
  isSenderAllowed: (senderId: string, allowFrom: string[]) => boolean;
  channel?: unknown;
  accountId?: string;
  resolveAccessGroupMembership?: unknown;
  readAllowFromStore: () => Promise<string[]>;
  shouldComputeCommandAuthorized: (rawBody: string, cfg: OpenClawConfig) => boolean;
  resolveCommandAuthorizedFromAuthorizers?: (params: {
    useAccessGroups: boolean;
    authorizers: AuthorizerEntry[];
  }) => boolean;
}

interface CommandAuthorizationResult {
  shouldComputeAuth: boolean;
  effectiveAllowFrom: string[];
  effectiveGroupAllowFrom: string[];
  senderAllowedForCommands: boolean;
  commandAuthorized: boolean | undefined;
}

interface LegacyCommandAuthSdk {
  resolveSenderCommandAuthorization: (
    params: ResolveSenderCommandAuthorizationParams,
  ) => Promise<CommandAuthorizationResult>;
}

interface RebuildPrimitives {
  resolveDmGroupAccessWithLists: (params: {
    isGroup: boolean;
    dmPolicy?: string | null;
    groupPolicy?: string | null;
    allowFrom?: Array<string | number> | null;
    groupAllowFrom?: Array<string | number> | null;
    storeAllowFrom?: Array<string | number> | null;
    groupAllowFromFallbackToAllowFrom?: boolean | null;
    isSenderAllowed: (allowFrom: string[]) => boolean;
  }) => {
    effectiveAllowFrom: string[];
    effectiveGroupAllowFrom: string[];
  };
  expandAllowFromWithAccessGroups: (params: {
    cfg: OpenClawConfig;
    allowFrom: string[];
    channel: unknown;
    accountId: string;
    senderId: string;
    isSenderAllowed: (senderId: string, allowFrom: string[]) => boolean;
    resolveMembership?: unknown;
  }) => Promise<string[]>;
  resolveCommandAuthorizedFromAuthorizers: (params: {
    useAccessGroups: boolean;
    authorizers: AuthorizerEntry[];
  }) => boolean;
}

const requireSdk = createRequire(import.meta.url);

/** 老宿主：整段门面仍在，直接透传。 */
function tryLoadLegacy(): LegacyCommandAuthSdk | null {
  try {
    const mod = requireSdk('openclaw/plugin-sdk/command-auth') as Partial<LegacyCommandAuthSdk>;
    if (typeof mod.resolveSenderCommandAuthorization === 'function') {
      return mod as LegacyCommandAuthSdk;
    }
  } catch {
    // 10.x：门面已移除，走重建路径。
  }
  return null;
}

/**
 * 10.x：用保留原语重建旧组合器。
 * 逻辑逐行对齐 9.4 `command-auth` 的原实现（含 access-group 展开分支与
 * "未配置 allowlist 即开放" 的 authorizer 语义）。
 */
function buildRebuilt(): LegacyCommandAuthSdk {
  // 原语分散在不同子路径；逐个同步解析（不做顶层 await）。
  const policySpecifier = 'openclaw/plugin-sdk/channel-policy';
  const nativeSpecifier = 'openclaw/plugin-sdk/command-auth-native';
  const accessGroupsSpecifier = 'openclaw/plugin-sdk/access-groups';

  const policy = requireSdk(policySpecifier) as Pick<RebuildPrimitives, 'resolveDmGroupAccessWithLists'>;
  const nativeMod = requireSdk(nativeSpecifier) as Pick<RebuildPrimitives, 'resolveCommandAuthorizedFromAuthorizers'>;
  const accessGroups = requireSdk(accessGroupsSpecifier) as {
    expandAllowFromWithAccessGroups: RebuildPrimitives['expandAllowFromWithAccessGroups'];
  };

  return {
    async resolveSenderCommandAuthorization(
      params: ResolveSenderCommandAuthorizationParams,
    ): Promise<CommandAuthorizationResult> {
      const shouldComputeAuth = params.shouldComputeCommandAuthorized(params.rawBody, params.cfg);

      // 仅非群、且 dmPolicy 非 allowlist/open 时才读 pairing store（与 9.4 一致）。
      const storeAllowFrom =
        !params.isGroup && params.dmPolicy !== 'allowlist' && params.dmPolicy !== 'open'
          ? await params.readAllowFromStore().catch(() => [])
          : [];

      let configuredAllowFrom = params.configuredAllowFrom;
      let configuredGroupAllowFrom = params.configuredGroupAllowFrom ?? [];
      let dmStoreAllowFrom = storeAllowFrom;

      // access-group 展开分支：仅在调用方传了 channel 时生效。
      // 飞书调用点不传 channel，故实际走不到；保留以对齐原语义。
      if (params.channel) {
        const accountId = params.accountId ?? 'default';
        const expand = (allowFrom: string[]) =>
          accessGroups.expandAllowFromWithAccessGroups({
            cfg: params.cfg,
            allowFrom,
            channel: params.channel,
            accountId,
            senderId: params.senderId,
            isSenderAllowed: params.isSenderAllowed,
            resolveMembership: params.resolveAccessGroupMembership,
          });
        [configuredAllowFrom, configuredGroupAllowFrom] = await Promise.all([
          expand(params.configuredAllowFrom),
          expand(params.configuredGroupAllowFrom ?? []),
        ]);
        if (!params.isGroup) {
          dmStoreAllowFrom = await expand(storeAllowFrom);
        }
      }

      const access = policy.resolveDmGroupAccessWithLists({
        isGroup: params.isGroup,
        dmPolicy: params.dmPolicy,
        groupPolicy: 'allowlist',
        allowFrom: configuredAllowFrom,
        groupAllowFrom: configuredGroupAllowFrom,
        storeAllowFrom: dmStoreAllowFrom,
        isSenderAllowed: (allowFrom) => params.isSenderAllowed(params.senderId, allowFrom),
      });

      const effectiveAllowFrom = access.effectiveAllowFrom;
      const effectiveGroupAllowFrom = access.effectiveGroupAllowFrom;

      const senderAllowedForCommands = params.isSenderAllowed(
        params.senderId,
        params.isGroup ? effectiveGroupAllowFrom : effectiveAllowFrom,
      );
      const ownerAllowedForCommands = params.isSenderAllowed(params.senderId, effectiveAllowFrom);
      const groupAllowedForCommands = params.isSenderAllowed(params.senderId, effectiveGroupAllowFrom);

      return {
        shouldComputeAuth,
        effectiveAllowFrom,
        effectiveGroupAllowFrom,
        senderAllowedForCommands,
        commandAuthorized: shouldComputeAuth
          ? (params.resolveCommandAuthorizedFromAuthorizers?.({
              useAccessGroups: true,
              authorizers: [
                { configured: effectiveAllowFrom.length > 0, allowed: ownerAllowedForCommands },
                {
                  configured: effectiveGroupAllowFrom.length > 0,
                  allowed: groupAllowedForCommands,
                },
              ],
            }) ??
            nativeMod.resolveCommandAuthorizedFromAuthorizers({
              useAccessGroups: true,
              authorizers: [
                { configured: effectiveAllowFrom.length > 0, allowed: ownerAllowedForCommands },
                {
                  configured: effectiveGroupAllowFrom.length > 0,
                  allowed: groupAllowedForCommands,
                },
              ],
            }) ??
            senderAllowedForCommands)
          : undefined,
      };
    },
  };
}

let cached: LegacyCommandAuthSdk | null = null;

function resolveSdk(): LegacyCommandAuthSdk {
  if (cached) return cached;
  cached = tryLoadLegacy() ?? buildRebuilt();
  return cached;
}

export function resolveSenderCommandAuthorization(
  ...args: Parameters<LegacyCommandAuthSdk['resolveSenderCommandAuthorization']>
): ReturnType<LegacyCommandAuthSdk['resolveSenderCommandAuthorization']> {
  return resolveSdk().resolveSenderCommandAuthorization(...args);
}
