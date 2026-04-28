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
import * as ManagedObjectApi from '../api/ManagedObjectApi';
import { StateInterface } from '../shared/State';
import {
  McpCapabilityDescriptor,
  McpCapabilityOperationType,
  McpCapabilityParameter,
  McpCapabilityParameterSchema,
  McpDeploymentType,
} from './CapabilityTypes';
import {
  McpDiscoveryEntry,
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
  /** Optional scope selector for ambiguous generic operations (e.g. `single` vs `bulk`). */
  scope?: string;
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
export type McpExecutionResultMetadata = {
  /** Top-level JSON shape returned by the tool call. */
  topLevelType:
    | 'array'
    | 'object'
    | 'string'
    | 'number'
    | 'boolean'
    | 'null'
    | 'undefined';
  /** Estimated serialized payload size in bytes. */
  payloadSizeBytes?: number;
  /** Human-readable payload size string. */
  payloadSizeHuman?: string;
  /** Number of items when the top-level payload is an array. */
  itemCount?: number;
  /** Top-level keys when the payload is an object. */
  objectKeys?: string[];
  /** Count summary for top-level arrays/records inside the payload. */
  fieldCounts?: Record<string, number>;
  /** Whether the payload is considered large for inline agent use. */
  isLarge?: boolean;
  /** Whether the payload was truncated by the transport layer. */
  isTruncated?: boolean;
  /** Optional advisory warning for large or truncated payloads. */
  warning?: string;
};

export type McpToolExecutionMetadata = {
  /** Scope metadata for realm-sensitive calls. */
  scope?: McpExecutionScopeMetadata;
  /** Pagination metadata for list/search calls. */
  pagination?: McpExecutionPaginationMetadata;
  /** Result summary metadata for agent reasoning and large-payload handling. */
  result?: McpExecutionResultMetadata;
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
  /**
   * Optional payload size threshold used to flag large inline responses and
   * produce actionable summary metadata for agents.
   *
   * Defaults to `65536` bytes.
   */
  resultWarningThresholdBytes?: number;
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
  const resultWarningThresholdBytes =
    options.resultWarningThresholdBytes ?? 65536;

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
      const descriptors = genericDescriptorIndex.get(key);
      if (!descriptors || descriptors.length === 0) {
        throw new FrodoError(
          buildUnsupportedGenericCombinationMessage(
            request.toolName,
            args.domain,
            args.objectType,
            manifest.discoveryTool
          )
        );
      }
      const descriptor = selectGenericDescriptor(
        request.toolName,
        args,
        descriptors
      );
      assertDeploymentCompatibility(descriptor, contextForExecution);
      const scopedFrodo = await resolveScopedFrodoInstance(
        contextForExecution,
        frodoRoot,
        options.resolveFrodoForRequest
      );
      const methodResult = await invokeGenericDescriptorMethod(
        scopedFrodo,
        descriptor,
        args
      );
      const metadata = buildGenericExecutionMetadata(
        methodResult,
        args,
        descriptor.operationType,
        contextForExecution,
        paginationWarningThreshold,
        resultWarningThresholdBytes
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
        toInvocationArgs(request.arguments, specialTool.descriptor)
      );
      const resultMetadata = buildResultMetadata(
        methodResult,
        specialTool.descriptor.operationType,
        resultWarningThresholdBytes
      );
      return {
        toolName: request.toolName,
        descriptorId: specialTool.descriptor.id,
        data: methodResult,
        ...(resultMetadata ? { metadata: { result: resultMetadata } } : {}),
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
): Map<string, McpCapabilityDescriptor[]> {
  const index = new Map<string, McpCapabilityDescriptor[]>();
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
      const existing = index.get(key) ?? [];
      existing.push(descriptor);
      index.set(key, existing);
    }
  }
  return index;
}

/**
 * Selects the exact generic descriptor to execute, including support for
 * explicit scope selectors when multiple descriptors share the same
 * `(operationType, domain, objectType)` tuple.
 */
function selectGenericDescriptor(
  toolName: string,
  args: McpGenericExecutionArguments,
  descriptors: McpCapabilityDescriptor[]
): McpCapabilityDescriptor {
  if (descriptors.length === 1) {
    return descriptors[0];
  }

  const requestedScope =
    typeof args.scope === 'string' && args.scope.trim().length > 0
      ? args.scope.trim()
      : undefined;
  if (requestedScope) {
    const scopedDescriptors = descriptors.filter(
      (descriptor) => descriptor.scope === requestedScope
    );
    if (scopedDescriptors.length === 1) {
      return scopedDescriptors[0];
    }
    if (scopedDescriptors.length === 0) {
      const supportedScopes = [
        ...new Set(
          descriptors
            .map((descriptor) => descriptor.scope)
            .filter(
              (scope): scope is NonNullable<typeof scope> => scope !== undefined
            )
        ),
      ];
      throw new FrodoError(
        `MCP runtime error: tool '${toolName}' does not support scope '${requestedScope}' for domain '${args.domain}' and objectType '${args.objectType}'. Supported scopes: ${supportedScopes.join(', ')}.`
      );
    }
  }

  if (args.namedArgs && typeof args.namedArgs === 'object') {
    const matchingDescriptor = descriptors.find((descriptor) =>
      matchesNamedArgumentShape(
        descriptor,
        args.namedArgs as Record<string, unknown>
      )
    );
    if (matchingDescriptor) {
      return matchingDescriptor;
    }
  }

  const supportedScopes = [
    ...new Set(
      descriptors
        .map((descriptor) => descriptor.scope)
        .filter(
          (scope): scope is NonNullable<typeof scope> => scope !== undefined
        )
    ),
  ];
  if (supportedScopes.length > 0) {
    throw new FrodoError(
      `MCP runtime error: tool '${toolName}' requires an explicit scope for domain '${args.domain}' and objectType '${args.objectType}'. Supported scopes: ${supportedScopes.join(', ')}.`
    );
  }

  return descriptors[0];
}

/**
 * Returns true when a descriptor's named-argument contract matches the caller's
 * provided named arguments.
 */
function matchesNamedArgumentShape(
  descriptor: McpCapabilityDescriptor,
  namedArgs: Record<string, unknown>
): boolean {
  if (!descriptor.parameters || descriptor.parameters.length === 0) {
    return false;
  }

  const allowed = new Set(
    descriptor.parameters.map((parameter) => parameter.name)
  );
  const providedKeys = Object.keys(namedArgs);
  if (providedKeys.some((key) => !allowed.has(key))) {
    return false;
  }

  return descriptor.parameters
    .filter((parameter) => parameter.required)
    .every((parameter) => namedArgs[parameter.name] !== undefined);
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
 * Invokes a generic descriptor, including MCP-specific paging adapters where the
 * public ops helper aggregates all pages instead of returning a single page.
 */
async function invokeGenericDescriptorMethod(
  scopedFrodo: Frodo,
  descriptor: McpCapabilityDescriptor,
  args: McpGenericExecutionArguments
): Promise<unknown> {
  if (descriptor.id === 'idm.managed.queryManagedObjects') {
    return invokeManagedObjectSearchPage(scopedFrodo, args, descriptor);
  }

  return invokeDescriptorMethod(
    scopedFrodo,
    descriptor,
    toInvocationArgs(args, descriptor)
  );
}

async function invokeManagedObjectSearchPage(
  scopedFrodo: Frodo,
  args: McpGenericExecutionArguments,
  descriptor: McpCapabilityDescriptor
): Promise<unknown> {
  const invocationArgs = toInvocationArgs(args, descriptor);
  const [type, filter = 'true', fields = ['*'], pageSize, pageCookie] =
    invocationArgs as [
      string,
      string | undefined,
      string[] | undefined,
      number | undefined,
      string | undefined,
    ];

  if (!type || typeof type !== 'string') {
    throw new FrodoError(
      "MCP runtime error: descriptor 'idm.managed.queryManagedObjects' requires namedArgs.type."
    );
  }
  if (!scopedFrodo.state) {
    throw new FrodoError(
      "MCP runtime error: request-scoped Frodo instance does not expose state for 'idm.managed.queryManagedObjects'."
    );
  }

  return ManagedObjectApi.queryManagedObjects({
    type,
    filter: filter ?? 'true',
    fields: Array.isArray(fields) && fields.length > 0 ? fields : ['*'],
    pageSize,
    pageCookie,
    state: scopedFrodo.state,
  });
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
  if (args.scope !== undefined && typeof args.scope !== 'string') {
    throw new FrodoError(
      'MCP runtime error: generic tools require scope to be a string when provided.'
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
function toInvocationArgs(
  raw: unknown,
  descriptor?: McpCapabilityDescriptor
): unknown[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const maybeArgs = raw as {
    positionalArgs?: unknown[];
    namedArgs?: Record<string, unknown>;
    pageSize?: number;
    pageOffset?: number;
    pageToken?: string;
    includeTotal?: boolean;
  };

  validateInvocationArguments(descriptor, maybeArgs);

  if (Array.isArray(maybeArgs.positionalArgs)) {
    return maybeArgs.positionalArgs;
  }
  if (maybeArgs.namedArgs && typeof maybeArgs.namedArgs === 'object') {
    if (descriptor?.parameters && descriptor.parameters.length > 0) {
      return descriptor.parameters
        .slice()
        .sort(
          (left, right) =>
            (left.position ?? Number.MAX_SAFE_INTEGER) -
            (right.position ?? Number.MAX_SAFE_INTEGER)
        )
        .map((parameter) => {
          const providedValue = resolveNamedOrGenericParameterValue(
            parameter,
            maybeArgs
          );
          if (providedValue !== undefined) {
            return providedValue;
          }
          if (parameter.defaultValue !== undefined) {
            return cloneDefaultParameterValue(parameter.defaultValue);
          }
          return undefined;
        });
    }
    return [maybeArgs.namedArgs];
  }
  return [];
}

/**
 * Validates invocation arguments against a descriptor's MCP-facing contract.
 */
function validateInvocationArguments(
  descriptor: McpCapabilityDescriptor | undefined,
  args: {
    positionalArgs?: unknown[];
    namedArgs?: Record<string, unknown>;
  }
): void {
  if (!descriptor) {
    return;
  }

  const hasPositional = Array.isArray(args.positionalArgs);
  const hasNamed = !!args.namedArgs && typeof args.namedArgs === 'object';
  const argumentMode = descriptor.argumentMode ?? 'mixed';
  const requiresNamedParameters =
    !!descriptor.parameters &&
    descriptor.parameters.some((parameter) => parameter.required);

  if (argumentMode === 'named' && hasPositional) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' requires namedArgs. Use frodo_discover for the exact parameter contract.`
    );
  }
  if (argumentMode === 'named' && !hasNamed && requiresNamedParameters) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' requires namedArgs. Allowed parameters: ${formatDescriptorParameters(descriptor)}.`
    );
  }
  if (argumentMode === 'none' && (hasPositional || hasNamed)) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' does not accept positionalArgs or namedArgs.`
    );
  }
  if (argumentMode === 'positional' && hasNamed) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' requires positionalArgs in the documented order.`
    );
  }

  if (
    !hasNamed ||
    !descriptor.parameters ||
    descriptor.parameters.length === 0
  ) {
    return;
  }

  const allowedNames = new Set(
    descriptor.parameters.map((parameter) => parameter.name)
  );
  const providedNames = Object.keys(args.namedArgs ?? {});
  const unknownNames = providedNames.filter((name) => !allowedNames.has(name));
  if (unknownNames.length > 0) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' does not accept named argument(s) ${unknownNames.join(', ')}. Allowed parameters: ${formatDescriptorParameters(descriptor)}.`
    );
  }

  const missingRequired = descriptor.parameters
    .filter((parameter) => parameter.required)
    .filter((parameter) => args.namedArgs?.[parameter.name] === undefined)
    .map((parameter) => parameter.name);
  if (missingRequired.length > 0) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' is missing required named argument(s): ${missingRequired.join(', ')}. Allowed parameters: ${formatDescriptorParameters(descriptor)}.`
    );
  }

  for (const parameter of descriptor.parameters) {
    const value = args.namedArgs?.[parameter.name];
    if (value === undefined) {
      continue;
    }
    validateNamedArgumentValue(descriptor.id, parameter, value);
  }
}

/**
 * Formats a descriptor's parameter contract for user-facing error messages.
 */
function resolveNamedOrGenericParameterValue(
  parameter: McpCapabilityParameter,
  args: {
    namedArgs?: Record<string, unknown>;
    pageSize?: number;
    pageOffset?: number;
    pageToken?: string;
    includeTotal?: boolean;
  }
): unknown {
  const providedValue = args.namedArgs?.[parameter.name];
  if (providedValue !== undefined) {
    return providedValue;
  }

  switch (parameter.name) {
    case 'pageSize':
      return args.pageSize;
    case 'pageOffset':
    case 'offset':
      return args.pageOffset;
    case 'pageToken':
    case 'pageCookie':
      return args.pageToken;
    case 'includeTotal':
      return args.includeTotal;
    default:
      return undefined;
  }
}

function formatDescriptorParameters(
  descriptor: McpCapabilityDescriptor
): string {
  if (!descriptor.parameters || descriptor.parameters.length === 0) {
    return 'none';
  }
  return descriptor.parameters.map(formatParameterContract).join('; ');
}

/**
 * Formats one named parameter contract, including schema/default/example hints.
 */
function formatParameterContract(parameter: McpCapabilityParameter): string {
  const details: string[] = [parameter.type];
  const schemaSummary = formatParameterSchema(
    parameter.schema ?? inferSchemaFromParameterType(parameter.type)
  );

  if (parameter.required) {
    details.push('required');
  }
  if (schemaSummary && schemaSummary !== parameter.type) {
    details.push(`schema=${schemaSummary}`);
  }
  if (parameter.defaultValue !== undefined) {
    details.push(`default=${formatValueForMessage(parameter.defaultValue)}`);
  }
  if (parameter.examples && parameter.examples.length > 0) {
    details.push(`example=${formatValueForMessage(parameter.examples[0])}`);
  }

  return `${parameter.name}${parameter.required ? '' : '?'} (${details.join(', ')})`;
}

/**
 * Validates a provided named argument against the descriptor's declared schema.
 */
function validateNamedArgumentValue(
  descriptorId: string,
  parameter: McpCapabilityParameter,
  value: unknown
): void {
  const schema =
    parameter.schema ?? inferSchemaFromParameterType(parameter.type);
  if (!schema) {
    return;
  }

  const problems = collectSchemaValidationProblems(value, schema);
  if (problems.length === 0) {
    return;
  }

  const expected = formatParameterSchema(schema) ?? parameter.type;
  const exampleText =
    parameter.examples && parameter.examples.length > 0
      ? ` Example: ${formatValueForMessage(parameter.examples[0])}.`
      : '';

  throw new FrodoError(
    `MCP runtime error: descriptor '${descriptorId}' received invalid value for named argument '${parameter.name}': ${problems.join('; ')}; expected ${expected}.${exampleText}`
  );
}

/**
 * Collects schema validation problems for a runtime value.
 */
function collectSchemaValidationProblems(
  value: unknown,
  schema: McpCapabilityParameterSchema,
  path = ''
): string[] {
  const problems: string[] = [];

  if (schema.type === 'string' && typeof value !== 'string') {
    return [formatSchemaProblem(path, 'must be string')];
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    return [formatSchemaProblem(path, 'must be boolean')];
  }
  if (schema.type === 'number' && typeof value !== 'number') {
    return [formatSchemaProblem(path, 'must be number')];
  }
  if (
    schema.type === 'integer' &&
    (typeof value !== 'number' || !Number.isInteger(value))
  ) {
    return [formatSchemaProblem(path, 'must be an integer')];
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      return [formatSchemaProblem(path, 'must be an array')];
    }
    if (schema.items) {
      value.forEach((item, index) => {
        problems.push(
          ...collectSchemaValidationProblems(
            item,
            schema.items as McpCapabilityParameterSchema,
            `${path}[${index}]`
          )
        );
      });
    }
    return problems;
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [formatSchemaProblem(path, 'must be an object')];
    }

    const record = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);

    const missing = [...required].filter((name) => record[name] === undefined);
    if (missing.length > 0) {
      problems.push(`missing field(s): ${missing.join(', ')}`);
    }

    if (schema.additionalProperties === false) {
      const unknownFields = Object.keys(record).filter(
        (name) => !Object.prototype.hasOwnProperty.call(properties, name)
      );
      if (unknownFields.length > 0) {
        problems.push(`unexpected field(s): ${unknownFields.join(', ')}`);
      }
    }

    for (const [name, propertySchema] of Object.entries(properties)) {
      if (record[name] === undefined) {
        continue;
      }
      problems.push(
        ...collectSchemaValidationProblems(record[name], propertySchema, name)
      );
    }
    return problems;
  }

  if (
    schema.enum &&
    schema.enum.length > 0 &&
    !schema.enum.some((candidate) => Object.is(candidate, value))
  ) {
    problems.push(
      `${formatSchemaProblem(path, 'must be one of')} ${schema.enum
        .map((candidate) => formatValueForMessage(candidate))
        .join(', ')}`
    );
  }

  return problems;
}

/**
 * Renders a compact human-readable schema summary.
 */
function formatParameterSchema(
  schema?: McpCapabilityParameterSchema
): string | undefined {
  if (!schema) {
    return undefined;
  }
  if (schema.type === 'object' && schema.properties) {
    const required = new Set(schema.required ?? []);
    const fields = Object.entries(schema.properties).map(
      ([name, propertySchema]) =>
        `${name}${required.has(name) ? '' : '?'}: ${formatParameterSchema(propertySchema) ?? propertySchema.type ?? 'value'}`
    );
    return `object with fields ${fields.join(', ')}`;
  }
  if (schema.type === 'array') {
    return `array${schema.items ? ` of ${formatParameterSchema(schema.items) ?? schema.items.type ?? 'values'}` : ''}`;
  }
  if (schema.enum && schema.enum.length > 0) {
    return `${schema.type ?? 'value'} one of ${schema.enum
      .map((candidate) => formatValueForMessage(candidate))
      .join(', ')}`;
  }
  return schema.type;
}

/**
 * Infers a simple runtime schema from primitive parameter type labels.
 */
function inferSchemaFromParameterType(
  type: string | undefined
): McpCapabilityParameterSchema | undefined {
  switch ((type ?? '').toLowerCase()) {
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'number':
      return { type: 'number' };
    case 'integer':
      return { type: 'integer' };
    case 'array':
      return { type: 'array' };
    case 'object':
      return { type: 'object' };
    default:
      return undefined;
  }
}

/**
 * Formats a single validation problem, optionally scoped to a nested field.
 */
function formatSchemaProblem(path: string, message: string): string {
  return path ? `field '${path}' ${message}` : message;
}

/**
 * Formats a runtime value for concise user-facing messages.
 */
function formatValueForMessage(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return String(value);
    }
    return serialized.length > 160
      ? `${serialized.slice(0, 157)}...`
      : serialized;
  } catch {
    return String(value);
  }
}

/**
 * Clones default parameter values so MCP calls do not share mutable metadata objects.
 */
function cloneDefaultParameterValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  try {
    return structuredClone(value);
  } catch {
    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return value;
      }
    }
    return value;
  }
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
  paginationWarningThreshold: number,
  resultWarningThresholdBytes: number
): McpToolExecutionMetadata | undefined {
  const scope = buildScopeMetadata(data, args, context);
  const pagination = buildPaginationMetadata(
    data,
    args,
    operationType,
    paginationWarningThreshold
  );
  const result = buildResultMetadata(
    data,
    operationType,
    resultWarningThresholdBytes
  );
  if (!scope && !pagination && !result) {
    return undefined;
  }
  return {
    scope,
    pagination,
    result,
  };
}

/**
 * Produces result-summary metadata for agent reasoning and large payloads.
 */
function buildResultMetadata(
  data: unknown,
  operationType: McpCapabilityOperationType,
  resultWarningThresholdBytes: number
): McpExecutionResultMetadata | undefined {
  const topLevelType = getTopLevelType(data);
  const payloadSizeBytes = estimatePayloadSizeBytes(data);
  const metadata: McpExecutionResultMetadata = {
    topLevelType,
  };

  if (payloadSizeBytes !== undefined) {
    metadata.payloadSizeBytes = payloadSizeBytes;
    metadata.payloadSizeHuman = formatByteSize(payloadSizeBytes);
    metadata.isLarge = payloadSizeBytes >= resultWarningThresholdBytes;
    if (metadata.isLarge) {
      metadata.warning =
        operationType === 'export'
          ? 'Result is large for inline agent use; narrow the request using scope, deps=false, or a more specific export.'
          : 'Result is large for inline agent use; narrow the request using scope, deps=false, or paging controls.';
    }
  }

  if (Array.isArray(data)) {
    metadata.itemCount = data.length;
    return metadata;
  }

  if (data && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    metadata.objectKeys = entries.map(([key]) => key).slice(0, 25);
    const fieldCounts: Record<string, number> = {};
    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        fieldCounts[key] = value.length;
      } else if (value && typeof value === 'object') {
        fieldCounts[key] = Object.keys(value as Record<string, unknown>).length;
      }
    }
    if (Object.keys(fieldCounts).length > 0) {
      metadata.fieldCounts = fieldCounts;
    }
    return metadata;
  }

  return payloadSizeBytes !== undefined ? metadata : undefined;
}

/**
 * Returns the top-level JSON-like type for a payload.
 */
function getTopLevelType(
  data: unknown
): McpExecutionResultMetadata['topLevelType'] {
  if (Array.isArray(data)) {
    return 'array';
  }
  if (data === null) {
    return 'null';
  }
  if (data === undefined) {
    return 'undefined';
  }
  if (typeof data === 'object') {
    return 'object';
  }
  if (typeof data === 'string') {
    return 'string';
  }
  if (typeof data === 'number') {
    return 'number';
  }
  if (typeof data === 'boolean') {
    return 'boolean';
  }
  return 'string';
}

/**
 * Estimates the serialized byte size of a payload.
 */
function estimatePayloadSizeBytes(data: unknown): number | undefined {
  try {
    const serialized = JSON.stringify(data);
    return Buffer.byteLength(serialized ?? 'null', 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Formats byte counts for human-readable metadata.
 */
function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
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
 * Builds an actionable error message for unsupported generic tool combinations.
 */
function buildUnsupportedGenericCombinationMessage(
  toolName: string,
  domain: string,
  objectType: string,
  discovery: McpDiscoveryEntry
): string {
  const objectTypeKey = `${domain}.${objectType}`;
  const supportEntry = discovery.objectTypeOperationSupport?.find(
    (entry) => entry.domain === domain && entry.objectType === objectType
  );

  if (supportEntry) {
    const supportedList =
      supportEntry.supportedOperations.length > 0
        ? supportEntry.supportedOperations.join(', ')
        : 'none';
    return (
      `MCP runtime error: tool '${toolName}' does not support domain '${domain}' and objectType '${objectType}'. ` +
      `Supported operations for '${objectTypeKey}': ${supportedList}. Use 'frodo_discover' to inspect supported combinations.`
    );
  }

  const knownObjectTypes = discovery.objectTypesByDomain[domain];
  if (knownObjectTypes?.length) {
    return (
      `MCP runtime error: tool '${toolName}' does not support domain '${domain}' and objectType '${objectType}'. ` +
      `Known object types for domain '${domain}': ${knownObjectTypes.join(', ')}. Use 'frodo_discover' to inspect supported combinations.`
    );
  }

  return (
    `MCP runtime error: tool '${toolName}' does not support domain '${domain}' and objectType '${objectType}'. ` +
    `Use 'frodo_discover' to inspect supported combinations.`
  );
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
