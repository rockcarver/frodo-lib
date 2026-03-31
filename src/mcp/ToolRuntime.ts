/**
 * Provides a manifest-driven MCP tool runtime for executing Frodo capability
 * descriptors with request-scoped Frodo instances.
 *
 * @remarks
 * This module intentionally decouples tool selection from invocation:
 * - The registry discovers raw capabilities.
 * - The manifest collapses them into a reduced tool surface.
 * - This runtime resolves incoming tool calls back to exact descriptors and
 *   executes them against an isolated Frodo instance per request.
 *
 * The default instance resolver is service-account/admin-account aware and uses
 * the established Frodo factory helpers (`createInstance*`).
 */

import { Frodo, frodo } from '../lib/FrodoLib';
import { FrodoError } from '../ops/FrodoError';
import { StateInterface } from '../shared/State';
import {
  McpCapabilityDescriptor,
  McpCapabilityOperationType,
} from './CapabilityTypes';
import {
  McpGenericTool,
  McpSpecialTool,
  McpToolManifest,
} from './ToolManifest';

/**
 * Credentials payload for a service-account request context.
 */
export type McpRuntimeServiceAccountAuth = {
  /** Discriminator for service-account auth mode. */
  mode: 'service-account';
  /** AM host base URL. */
  host: string;
  /** Service account UUID. */
  serviceAccountId: string;
  /** Service account JWK, provided as JSON string or object. */
  serviceAccountJwk: string | Record<string, unknown>;
  /** Optional realm override. */
  realm?: string;
  /** Optional deployment type override. */
  deploymentType?: string;
  /** Optional insecure-connection toggle. */
  allowInsecureConnection?: boolean;
  /** Optional debug toggle. */
  debug?: boolean;
  /** Optional curlirize toggle. */
  curlirize?: boolean;
};

/**
 * Credentials payload for an admin-account request context.
 */
export type McpRuntimeAdminAccountAuth = {
  /** Discriminator for admin-account auth mode. */
  mode: 'admin-account';
  /** AM host base URL. */
  host: string;
  /** Admin username. */
  username: string;
  /** Admin password. */
  password: string;
  /** Optional realm override. */
  realm?: string;
  /** Optional deployment type override. */
  deploymentType?: string;
  /** Optional insecure-connection toggle. */
  allowInsecureConnection?: boolean;
  /** Optional debug toggle. */
  debug?: boolean;
  /** Optional curlirize toggle. */
  curlirize?: boolean;
};

/**
 * Full frodo state payload for direct state-based instance creation.
 */
export type McpRuntimeStateAuth = {
  /** Discriminator for direct state-config auth mode. */
  mode: 'state-config';
  /** Full state configuration passed into `frodo.createInstance`. */
  config: StateInterface;
};

/**
 * Union of supported runtime auth modes.
 */
export type McpRuntimeAuth =
  | McpRuntimeServiceAccountAuth
  | McpRuntimeAdminAccountAuth
  | McpRuntimeStateAuth;

/**
 * Execution-scoped context used to create an isolated Frodo instance.
 */
export type McpRuntimeRequestContext = {
  /** Optional caller-supplied correlation id for audit/log stitching. */
  requestId?: string;
  /** Auth mode and credential payload for this request. */
  auth: McpRuntimeAuth;
};

/**
 * Generic-tool execution arguments.
 */
export type McpGenericExecutionArguments = {
  /** Domain key, e.g. `authn`. */
  domain: string;
  /** Object type label, e.g. `Journey`. */
  objectType: string;
  /** Optional positional args forwarded to the underlying Frodo method. */
  positionalArgs?: unknown[];
  /** Optional named args forwarded as a single object argument. */
  namedArgs?: Record<string, unknown>;
};

/**
 * Special-tool execution arguments.
 */
export type McpSpecialExecutionArguments = {
  /** Optional positional args forwarded to the underlying Frodo method. */
  positionalArgs?: unknown[];
  /** Optional named args forwarded as a single object argument. */
  namedArgs?: Record<string, unknown>;
};

/**
 * Envelope for runtime tool execution.
 */
export type McpToolExecutionRequest = {
  /** MCP tool name from the manifest. */
  toolName: string;
  /**
   * Tool arguments.
   * - Generic tools require `domain` and `objectType`.
   * - Special tools accept `positionalArgs` and/or `namedArgs`.
   * - Discovery tool ignores arguments.
   */
  arguments?:
    | McpGenericExecutionArguments
    | McpSpecialExecutionArguments
    | Record<string, unknown>;
  /** Request-scoped context used to create an isolated Frodo instance. */
  context: McpRuntimeRequestContext;
};

/**
 * Result envelope returned by all runtime executions.
 */
export type McpToolExecutionResult = {
  /** Tool name that was executed. */
  toolName: string;
  /** Descriptor id backing the execution, if applicable. */
  descriptorId?: string;
  /** Underlying method result payload. */
  data: unknown;
};

/**
 * Optional runtime customization hooks.
 */
export type McpToolRuntimeOptions = {
  /**
   * Optional root Frodo instance used by the default resolver.
   * Defaults to the library singleton `frodo`.
   */
  frodoRoot?: Frodo;
  /**
   * Optional custom resolver that returns a request-scoped Frodo instance.
   * When omitted, {@link resolveRequestScopedFrodo} is used.
   */
  resolveFrodoForRequest?: (
    context: McpRuntimeRequestContext,
    frodoRoot: Frodo
  ) => Frodo | Promise<Frodo>;
};

/**
 * Manifest-backed runtime object.
 */
export type McpToolRuntime = {
  /** Reduced manifest used for tool registration and discovery. */
  manifest: McpToolManifest;
  /**
   * Executes one tool invocation against a request-scoped Frodo instance.
   *
   * @param request Tool execution request.
   * @returns Normalized execution result envelope.
   */
  executeTool(
    request: McpToolExecutionRequest
  ): Promise<McpToolExecutionResult>;
};

/**
 * Creates a manifest-backed MCP runtime with descriptor indexes for efficient
 * execution dispatch.
 *
 * @param manifest Reduced tool manifest created by `buildToolManifest`.
 * @param capabilities Capability descriptors that back the manifest.
 * @param options Optional runtime customization hooks.
 * @returns Runtime object capable of executing manifest tool calls.
 */
export function createToolRuntime(
  manifest: McpToolManifest,
  capabilities: McpCapabilityDescriptor[],
  options: McpToolRuntimeOptions = {}
): McpToolRuntime {
  const byId = new Map<string, McpCapabilityDescriptor>(
    capabilities.map((c) => [c.id, c])
  );
  const genericDescriptorIndex = buildGenericDescriptorIndex(
    manifest.genericTools,
    byId
  );
  const specialToolIndex = new Map<string, McpSpecialTool>(
    manifest.specialTools.map((t) => [t.toolName, t])
  );
  const frodoRoot = options.frodoRoot ?? frodo;

  /**
   * Executes one manifest tool request and returns a normalized result envelope.
   *
   * @param request Tool execution request.
   * @returns Result envelope with tool name, descriptor id, and raw method data.
   */
  const executeTool = async (
    request: McpToolExecutionRequest
  ): Promise<McpToolExecutionResult> => {
    if (!request?.toolName) {
      throw new FrodoError('MCP runtime error: missing toolName in request.');
    }

    if (request.toolName === manifest.discoveryTool.toolName) {
      return {
        toolName: request.toolName,
        data: manifest.discoveryTool,
      };
    }

    const scopedFrodo = await resolveScopedFrodoInstance(
      request.context,
      frodoRoot,
      options.resolveFrodoForRequest
    );

    const genericTool = manifest.genericTools.find(
      (t) => t.toolName === request.toolName
    );
    if (genericTool) {
      const args = parseGenericArguments(request.arguments);
      const key = buildGenericDescriptorIndexKey(
        genericTool.operationType,
        args.domain,
        args.objectType
      );
      const descriptor = genericDescriptorIndex.get(key);
      if (!descriptor) {
        throw new FrodoError(
          `MCP runtime error: tool '${request.toolName}' does not support domain '${args.domain}' and objectType '${args.objectType}'.`
        );
      }
      const methodResult = await invokeDescriptorMethod(
        scopedFrodo,
        descriptor,
        toInvocationArgs(args)
      );
      return {
        toolName: request.toolName,
        descriptorId: descriptor.id,
        data: methodResult,
      };
    }

    const specialTool = specialToolIndex.get(request.toolName);
    if (specialTool) {
      const methodResult = await invokeDescriptorMethod(
        scopedFrodo,
        specialTool.descriptor,
        toInvocationArgs(request.arguments)
      );
      return {
        toolName: request.toolName,
        descriptorId: specialTool.descriptor.id,
        data: methodResult,
      };
    }

    throw new FrodoError(
      `MCP runtime error: unknown tool '${request.toolName}'.`
    );
  };

  return {
    manifest,
    executeTool,
  };
}

/**
 * Creates a request-scoped Frodo instance using standard factory helpers and
 * the provided auth mode.
 *
 * @param context Request-scoped runtime context.
 * @param frodoRoot Root frodo instance exposing `createInstance*` helpers.
 * @returns New request-scoped Frodo instance.
 */
export function resolveRequestScopedFrodo(
  context: McpRuntimeRequestContext,
  frodoRoot: Frodo = frodo
): Frodo {
  if (!context?.auth) {
    throw new FrodoError('MCP runtime error: missing auth context.');
  }

  switch (context.auth.mode) {
    case 'state-config':
      return frodoRoot.createInstance(context.auth.config);
    case 'service-account': {
      const jwkStr =
        typeof context.auth.serviceAccountJwk === 'string'
          ? context.auth.serviceAccountJwk
          : JSON.stringify(context.auth.serviceAccountJwk);
      return frodoRoot.createInstanceWithServiceAccount(
        context.auth.host,
        context.auth.serviceAccountId,
        jwkStr,
        context.auth.realm,
        context.auth.deploymentType,
        context.auth.allowInsecureConnection,
        context.auth.debug,
        context.auth.curlirize
      );
    }
    case 'admin-account':
      return frodoRoot.createInstanceWithAdminAccount(
        context.auth.host,
        context.auth.username,
        context.auth.password,
        context.auth.realm,
        context.auth.deploymentType,
        context.auth.allowInsecureConnection,
        context.auth.debug,
        context.auth.curlirize
      );
    default:
      throw new FrodoError(
        `MCP runtime error: unsupported auth mode '${String((context.auth as { mode?: unknown }).mode)}'.`
      );
  }
}

/**
 * Builds a lookup map from `(operationType, domain, objectType)` to the exact
 * generic descriptor that should execute that combination.
 *
 * @param genericTools Generic manifest tools.
 * @param descriptorById Full descriptor map keyed by id.
 * @returns Descriptor lookup map.
 */
function buildGenericDescriptorIndex(
  genericTools: McpGenericTool[],
  descriptorById: Map<string, McpCapabilityDescriptor>
): Map<string, McpCapabilityDescriptor> {
  const index = new Map<string, McpCapabilityDescriptor>();
  for (const tool of genericTools) {
    for (const entry of tool.supportedObjectTypes) {
      const descriptor = descriptorById.get(entry.descriptorId);
      if (!descriptor) {
        throw new FrodoError(
          `MCP runtime error: manifest references unknown descriptor id '${entry.descriptorId}'.`
        );
      }
      const key = buildGenericDescriptorIndexKey(
        tool.operationType,
        entry.domain,
        entry.objectType
      );
      index.set(key, descriptor);
    }
  }
  return index;
}

/**
 * Produces a stable index key for generic tool descriptor lookup.
 *
 * @param operationType Operation type bucket.
 * @param domain Domain key.
 * @param objectType Object type label.
 * @returns Stable case-sensitive lookup key.
 */
function buildGenericDescriptorIndexKey(
  operationType: McpCapabilityOperationType,
  domain: string,
  objectType: string
): string {
  return `${operationType}::${domain}::${objectType}`;
}

/**
 * Resolves the Frodo instance for an execution request using either a custom
 * resolver or the default built-in resolver.
 *
 * @param context Request-scoped runtime context.
 * @param frodoRoot Root frodo instance exposing factory helpers.
 * @param customResolver Optional custom instance resolver.
 * @returns Request-scoped Frodo instance.
 */
async function resolveScopedFrodoInstance(
  context: McpRuntimeRequestContext,
  frodoRoot: Frodo,
  customResolver?: (
    context: McpRuntimeRequestContext,
    frodoRoot: Frodo
  ) => Frodo | Promise<Frodo>
): Promise<Frodo> {
  if (customResolver) {
    return await customResolver(context, frodoRoot);
  }
  return resolveRequestScopedFrodo(context, frodoRoot);
}

/**
 * Validates and normalizes generic-tool arguments.
 *
 * @param raw Raw arguments payload from an execution request.
 * @returns Parsed generic execution arguments.
 */
function parseGenericArguments(raw: unknown): McpGenericExecutionArguments {
  const args = raw as McpGenericExecutionArguments | undefined;
  if (!args || typeof args !== 'object') {
    throw new FrodoError(
      'MCP runtime error: generic tools require an arguments object.'
    );
  }
  if (!args.domain || typeof args.domain !== 'string') {
    throw new FrodoError(
      'MCP runtime error: generic tools require a string domain argument.'
    );
  }
  if (!args.objectType || typeof args.objectType !== 'string') {
    throw new FrodoError(
      'MCP runtime error: generic tools require a string objectType argument.'
    );
  }
  return args;
}

/**
 * Converts execution arguments into positional call arguments for invoking a
 * Frodo method.
 *
 * @remarks
 * Precedence:
 * 1. `positionalArgs` when provided.
 * 2. `[namedArgs]` when provided.
 * 3. `[]` otherwise.
 *
 * @param raw Raw arguments payload.
 * @returns Positional invocation arguments.
 */
function toInvocationArgs(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const maybeArgs = raw as {
    positionalArgs?: unknown[];
    namedArgs?: Record<string, unknown>;
  };
  if (Array.isArray(maybeArgs.positionalArgs)) {
    return maybeArgs.positionalArgs;
  }
  if (maybeArgs.namedArgs && typeof maybeArgs.namedArgs === 'object') {
    return [maybeArgs.namedArgs];
  }
  return [];
}

/**
 * Resolves and executes the exact method referenced by a capability descriptor.
 *
 * @param instance Request-scoped Frodo instance.
 * @param descriptor Capability descriptor containing method path metadata.
 * @param args Positional arguments to pass to the resolved method.
 * @returns The resolved method result.
 */
async function invokeDescriptorMethod(
  instance: Frodo,
  descriptor: McpCapabilityDescriptor,
  args: unknown[]
): Promise<unknown> {
  const method = resolveDescriptorMethod(instance, descriptor);
  try {
    return await Promise.resolve(method(...args));
  } catch (error) {
    // Preserve full error context when wrapping invocation failures
    const methodPath = descriptor.modulePath
      .concat(descriptor.methodName)
      .join('.');
    throw new FrodoError(
      `MCP runtime error: failed invoking '${descriptor.id}' (${methodPath})`,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Resolves a descriptor's target method from a Frodo instance.
 *
 * @param instance Request-scoped Frodo instance.
 * @param descriptor Capability descriptor with module path and method name.
 * @returns Bound callable method.
 */
function resolveDescriptorMethod(
  instance: Frodo,
  descriptor: McpCapabilityDescriptor
): (...args: unknown[]) => unknown {
  let node: unknown = instance;
  for (const segment of descriptor.modulePath) {
    if (!node || (typeof node !== 'object' && typeof node !== 'function')) {
      throw new FrodoError(
        `MCP runtime error: invalid path for descriptor '${descriptor.id}' at segment '${segment}'.`
      );
    }
    const next = (node as Record<string, unknown>)[segment];
    if (next === undefined) {
      throw new FrodoError(
        `MCP runtime error: descriptor path segment '${segment}' does not exist for '${descriptor.id}'.`
      );
    }
    node = next;
  }

  if (!node || (typeof node !== 'object' && typeof node !== 'function')) {
    throw new FrodoError(
      `MCP runtime error: invalid method container for descriptor '${descriptor.id}'.`
    );
  }

  const method = (node as Record<string, unknown>)[descriptor.methodName];
  if (typeof method !== 'function') {
    throw new FrodoError(
      `MCP runtime error: method '${descriptor.methodName}' was not found for descriptor '${descriptor.id}'.`
    );
  }
  return (method as (...args: unknown[]) => unknown).bind(node);
}
