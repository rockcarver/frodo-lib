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
  McpDeploymentType,
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
  /** Optional realm override applied to request-scoped auth context. */
  realm?: string;
  /** Optional requested page size hint. */
  pageSize?: number;
  /** Optional requested page offset hint. */
  pageOffset?: number;
  /** Optional requested page token/cursor hint. */
  pageToken?: string;
  /** Optional hint to request exact totals when supported. */
  includeTotal?: boolean;
  /** Optional positional args forwarded to the underlying Frodo method. */
  positionalArgs?: unknown[];
  /** Optional named args forwarded as a single object argument. */
  namedArgs?: Record<string, unknown>;
};

/**
 * Pagination metadata returned for list/search style tool calls.
 */
export type McpExecutionPaginationMetadata = {
  /** Whether the result appears to be truncated/paginated. */
  isPartial: boolean;
  /** Number of rows returned when the payload is an array. */
  returnedCount?: number;
  /** Requested page size hint, if provided by caller. */
  requestedPageSize?: number;
  /** Requested page offset hint, if provided by caller. */
  requestedPageOffset?: number;
  /** Requested page token hint, if provided by caller. */
  requestedPageToken?: string;
  /** Whether caller requested exact totals. */
  includeTotalRequested?: boolean;
  /** Optional advisory warning for agent callers. */
  warning?: string;
};

/**
 * Scope metadata returned for realm-sensitive executions.
 */
export type McpExecutionScopeMetadata = {
  /** Realm explicitly requested by the caller, if any. */
  requestedRealm?: string;
  /** Realm ultimately applied to request-scoped auth context. */
  appliedRealm?: string;
  /** Whether payload contents suggest a realm mismatch. */
  scopeMismatch?: boolean;
  /** Optional warning message when scope mismatch is detected. */
  warning?: string;
};

/**
 * Optional execution metadata surfaced alongside tool results.
 */
export type McpToolExecutionMetadata = {
  /** Scope metadata for realm-sensitive calls. */
  scope?: McpExecutionScopeMetadata;
  /** Pagination metadata for list/search calls. */
  pagination?: McpExecutionPaginationMetadata;
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
  /** Optional execution metadata for scope and pagination diagnostics. */
  metadata?: McpToolExecutionMetadata;
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
  /**
   * Optional heuristic threshold used to flag potentially paginated array
   * responses when no explicit pagination controls were provided.
   *
   * Defaults to `1000`.
   */
  paginationWarningThreshold?: number;
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
  const paginationWarningThreshold = options.paginationWarningThreshold ?? 1000;

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

    const genericTool = manifest.genericTools.find(
      (t) => t.toolName === request.toolName
    );
    if (genericTool) {
      const args = parseGenericArguments(request.arguments);
      const contextForExecution = applyGenericScopeOverride(
        request.context,
        args
      );
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
      assertDeploymentCompatibility(descriptor, contextForExecution);
      const scopedFrodo = await resolveScopedFrodoInstance(
        contextForExecution,
        frodoRoot,
        options.resolveFrodoForRequest
      );
      const methodResult = await invokeDescriptorMethod(
        scopedFrodo,
        descriptor,
        toInvocationArgs(args)
      );
      const metadata = buildGenericExecutionMetadata(
        methodResult,
        args,
        descriptor.operationType,
        contextForExecution,
        paginationWarningThreshold
      );
      return {
        toolName: request.toolName,
        descriptorId: descriptor.id,
        data: methodResult,
        metadata,
      };
    }

    const specialTool = specialToolIndex.get(request.toolName);
    if (specialTool) {
      assertDeploymentCompatibility(specialTool.descriptor, request.context);
      const scopedFrodo = await resolveScopedFrodoInstance(
        request.context,
        frodoRoot,
        options.resolveFrodoForRequest
      );
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
 * Validates that the descriptor is supported for the request deployment type.
 *
 * @remarks
 * Compatibility metadata is expressed via `descriptor.deploymentTypes`.
 * - `any` means globally compatible
 * - empty/undefined means no explicit constraint (treated as compatible)
 *
 * If the request context does not include a deployment type, the check is
 * skipped to preserve backward compatibility for legacy callers.
 */
function assertDeploymentCompatibility(
  descriptor: McpCapabilityDescriptor,
  context: McpRuntimeRequestContext
): void {
  const deploymentType = resolveContextDeploymentType(context);
  if (!deploymentType) {
    return;
  }

  const supported = descriptor.deploymentTypes;
  if (!supported || supported.length === 0 || supported.includes('any')) {
    return;
  }

  if (supported.includes(deploymentType)) {
    return;
  }

  const supportedList = supported.join(', ');
  throw new FrodoError(
    `MCP runtime error: descriptor '${descriptor.id}' is not supported for deployment '${deploymentType}'. Supported deployments: ${supportedList}.`
  );
}

/**
 * Resolves and normalizes deployment type from request context.
 */
function resolveContextDeploymentType(
  context: McpRuntimeRequestContext
): McpDeploymentType | undefined {
  if (!context?.auth) {
    return undefined;
  }

  const rawType =
    context.auth.mode === 'state-config'
      ? context.auth.config?.deploymentType
      : context.auth.deploymentType;

  if (typeof rawType !== 'string') {
    return undefined;
  }

  const normalized = rawType.trim().toLowerCase();
  if (
    normalized === 'classic' ||
    normalized === 'cloud' ||
    normalized === 'forgeops' ||
    normalized === 'any'
  ) {
    return normalized;
  }

  return undefined;
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
  const scopedFrodo = customResolver
    ? await customResolver(context, frodoRoot)
    : resolveRequestScopedFrodo(context, frodoRoot);

  // Authenticate the scoped instance before any method is invoked. getTokens()
  // populates the instance-local state with a valid bearer token and raises a
  // clean authentication error here rather than letting a 401/403 surface deep
  // inside a library method call.
  try {
    await scopedFrodo.login.getTokens();
  } catch (error) {
    throw new FrodoError(
      'MCP runtime error: authentication failed for request-scoped Frodo instance.',
      error instanceof Error ? error : new Error(String(error))
    );
  }

  return scopedFrodo;
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
  if (args.realm !== undefined && typeof args.realm !== 'string') {
    throw new FrodoError(
      'MCP runtime error: generic tools require realm to be a string when provided.'
    );
  }
  if (
    args.pageSize !== undefined &&
    (!Number.isInteger(args.pageSize) || args.pageSize <= 0)
  ) {
    throw new FrodoError(
      'MCP runtime error: generic tools require pageSize to be a positive integer when provided.'
    );
  }
  if (
    args.pageOffset !== undefined &&
    (!Number.isInteger(args.pageOffset) || args.pageOffset < 0)
  ) {
    throw new FrodoError(
      'MCP runtime error: generic tools require pageOffset to be a non-negative integer when provided.'
    );
  }
  if (args.pageToken !== undefined && typeof args.pageToken !== 'string') {
    throw new FrodoError(
      'MCP runtime error: generic tools require pageToken to be a string when provided.'
    );
  }
  if (
    args.includeTotal !== undefined &&
    typeof args.includeTotal !== 'boolean'
  ) {
    throw new FrodoError(
      'MCP runtime error: generic tools require includeTotal to be a boolean when provided.'
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

/**
 * Applies generic-tool scope controls to the request context.
 *
 * @param context Original request context.
 * @param args Parsed generic-tool arguments.
 * @returns Context with realm override applied when provided.
 */
function applyGenericScopeOverride(
  context: McpRuntimeRequestContext,
  args: McpGenericExecutionArguments
): McpRuntimeRequestContext {
  if (!args.realm) {
    return context;
  }

  switch (context.auth.mode) {
    case 'state-config':
      return {
        ...context,
        auth: {
          mode: 'state-config',
          config: {
            ...context.auth.config,
            realm: args.realm,
          },
        },
      };
    case 'service-account':
      return {
        ...context,
        auth: {
          ...context.auth,
          realm: args.realm,
        },
      };
    case 'admin-account':
      return {
        ...context,
        auth: {
          ...context.auth,
          realm: args.realm,
        },
      };
    default:
      return context;
  }
}

/**
 * Builds standardized execution metadata for generic tool calls.
 */
function buildGenericExecutionMetadata(
  data: unknown,
  args: McpGenericExecutionArguments,
  operationType: McpCapabilityOperationType,
  context: McpRuntimeRequestContext,
  paginationWarningThreshold: number
): McpToolExecutionMetadata | undefined {
  const scope = buildScopeMetadata(data, args, context);
  const pagination = buildPaginationMetadata(
    data,
    args,
    operationType,
    paginationWarningThreshold
  );
  if (!scope && !pagination) {
    return undefined;
  }
  return {
    scope,
    pagination,
  };
}

/**
 * Produces scope diagnostics for realm-sensitive generic calls.
 */
function buildScopeMetadata(
  data: unknown,
  args: McpGenericExecutionArguments,
  context: McpRuntimeRequestContext
): McpExecutionScopeMetadata | undefined {
  const requestedRealm = args.realm;
  const appliedRealm = getRealmFromContext(context);

  if (!requestedRealm && !appliedRealm) {
    return undefined;
  }

  const metadata: McpExecutionScopeMetadata = {
    requestedRealm,
    appliedRealm,
  };

  const mismatchWarning = detectScopeMismatchWarning(data, requestedRealm);
  if (mismatchWarning) {
    metadata.scopeMismatch = true;
    metadata.warning = mismatchWarning;
  }

  return metadata;
}

/**
 * Produces pagination diagnostics for list/search style calls.
 */
function buildPaginationMetadata(
  data: unknown,
  args: McpGenericExecutionArguments,
  operationType: McpCapabilityOperationType,
  paginationWarningThreshold: number
): McpExecutionPaginationMetadata | undefined {
  if (operationType !== 'list' && operationType !== 'search') {
    return undefined;
  }

  const returnedCount = Array.isArray(data) ? data.length : undefined;
  const looksTruncatedByThreshold =
    returnedCount !== undefined &&
    returnedCount >= paginationWarningThreshold &&
    args.pageSize === undefined &&
    args.pageOffset === undefined &&
    args.pageToken === undefined;

  const metadata: McpExecutionPaginationMetadata = {
    isPartial: looksTruncatedByThreshold,
    returnedCount,
    requestedPageSize: args.pageSize,
    requestedPageOffset: args.pageOffset,
    requestedPageToken: args.pageToken,
    includeTotalRequested: args.includeTotal,
  };

  if (looksTruncatedByThreshold) {
    metadata.warning =
      'Result appears to be paginated/truncated at default page size. Provide explicit paging controls or use a count-capable operation for exact totals.';
  }

  return metadata;
}

/**
 * Reads the effective realm from a runtime request context.
 */
function getRealmFromContext(
  context: McpRuntimeRequestContext
): string | undefined {
  switch (context.auth.mode) {
    case 'state-config':
      return context.auth.config.realm;
    case 'service-account':
      return context.auth.realm;
    case 'admin-account':
      return context.auth.realm;
    default:
      return undefined;
  }
}

/**
 * Heuristically detects realm mismatch by inspecting payload realm fields.
 */
function detectScopeMismatchWarning(
  data: unknown,
  requestedRealm?: string
): string | undefined {
  if (!requestedRealm || !Array.isArray(data) || data.length === 0) {
    return undefined;
  }

  const requested = normalizeRealm(requestedRealm);
  const observed = new Set<string>();
  for (const entry of data.slice(0, 100)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const realmValue = (entry as Record<string, unknown>).realm;
    if (typeof realmValue === 'string' && realmValue.trim().length > 0) {
      observed.add(normalizeRealm(realmValue));
    }
  }

  if (observed.size > 0 && !observed.has(requested)) {
    return `Requested realm '${requestedRealm}' does not match observed payload realms (${[...observed].join(', ')}). Verify realm scoping for this operation.`;
  }
  return undefined;
}

/**
 * Normalizes realm inputs for stable comparison.
 */
function normalizeRealm(realm: string): string {
  const trimmed = realm.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
