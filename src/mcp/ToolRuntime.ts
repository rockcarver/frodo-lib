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

import { DEFAULT_PAGE_SIZE as INTERNAL_OBJECT_PAGE_SIZE } from '../api/InternalObjectApi';
import * as ManagedObjectApi from '../api/ManagedObjectApi';
import { getIdmServerVersionInfo } from '../api/ServerInfoApi';
import type { Frodo } from '../lib/FrodoLib';
import { getSemanticVersion } from '../ops/AuthenticateOps';
import type { BrowserLoginPromptHandler } from '../ops/BrowserAuthenticateOps';
import { determineCallerTrustTier } from '../ops/CallerTrustTierOps';
import { FrodoError } from '../ops/FrodoError';
import { StateInterface } from '../shared/State';
import { findResultCallbackPosition } from './CapabilityRegistry';
import {
  describeCapabilityRouting,
  McpCapabilityRoutingStatus,
  rankCapabilitiesForDeployment,
} from './CapabilityRouting';
import {
  McpCapabilityDescriptor,
  McpCapabilityOperationType,
  McpCapabilityParameter,
  McpCapabilityParameterSchema,
  McpDeploymentType,
} from './CapabilityTypes';
import { resolveDocsContext } from './DocsContext';
import {
  createResultCollector,
  McpItemResults,
  McpResultCollector,
  placeResultCallback,
} from './ResultCollector';
import { matchSemanticIdentifiers } from './SemanticIdentifiers';
import {
  descriptorPatternsSupportFamily,
  discoverManagedObjectFamilies,
  matchManagedObjectFamily,
  MCP_AMBIGUOUS_OBJECT_CONCEPTS,
  MCP_SEMANTIC_OBJECT_SYNONYMS,
  McpSemanticObjectFamily,
  McpSemanticObjectFamilyResolution,
  normalizeSemanticObjectFamily,
  resolveSemanticObjectFamily,
} from './SemanticObjectFamilies';
import {
  McpCatalogHydrationStatus,
  McpDiscoveryEntry,
  McpGenericTool,
  McpManagedObjectHydrationStatus,
  McpToolManifest,
} from './ToolManifest';

const FIND_SKILLS_TOOL_NAME = 'frodo_find_skills';
const DESCRIBE_SKILL_TOOL_NAME = 'frodo_describe_skill';
const DISPATCH_READ_ONLY_TOOL_NAME = 'frodo_dispatch_read_only';
const DISPATCH_TOOL_NAME = 'frodo_dispatch';
const DISCOVERY_TOOL_NAME = 'frodo_discover';

const READ_ONLY_OPERATION_TYPES: McpCapabilityOperationType[] = [
  'count',
  'read',
  'list',
  'search',
];

/**
 * Capabilities whose result is the next batch from a position in a live
 * stream. Such a result is never complete, so it carries `returned` and
 * `nextPageToken` but no `truncated`.
 */
const LIVE_CURSOR_CAPABILITY_IDS: readonly string[] = ['cloud.log.tail'];

/**
 * List and search capabilities that stop at a limit of their own, which the
 * runtime cannot see in the array that they return. The limit is set by an
 * argument whose default is read from the descriptor, so that the runtime
 * compares with the limit that the call really got, or it is fixed. When such
 * a capability returns as many items as its limit, it probably stopped there,
 * and the result says so.
 *
 * `readsWholePages` says that the capability checks its limit after it read a
 * whole page, so that it can return more items than the limit.
 *
 * `dedupeArgument` names an argument that, unless it is `false`, makes the
 * capability remove duplicate items after it stopped: the count it returns is
 * then no proof that the limit was not reached, and below the limit the result
 * says neither that it is complete nor that it is not (`truncated` and `total`
 * are left out, and the warning says why).
 */
const SELF_CAPPING_CAPABILITIES: Readonly<
  Record<
    string,
    {
      argument?: string;
      fixedCap?: number;
      readOn?: string;
      dedupeArgument?: string;
      readsWholePages?: boolean;
    }
  >
> = {
  'cloud.log.searchEvents': {
    argument: 'maxEvents',
    dedupeArgument: 'dedupeByTransactionId',
    readsWholePages: true,
  },
  // one request of at most one page of the internal object api: the cookie of the answer is dropped
  'role.readInternalRoles': {
    fixedCap: INTERNAL_OBJECT_PAGE_SIZE,
    readOn:
      'Use role.queryInternalRoles with a filter that matches fewer roles to read the rest.',
  },
  'role.queryInternalRoles': {
    fixedCap: INTERNAL_OBJECT_PAGE_SIZE,
    readOn: 'Narrow the filter to read the rest.',
  },
};

/** The fields that say whether a list or search result is complete, in the order they are serialized. */
const LIST_COMPLETENESS_FIELDS = [
  'truncated',
  'returned',
  'total',
  'nextPageOffset',
  'nextPageToken',
  'warning',
] as const;

/** The arguments that page a list or search result. */
const PAGING_CONTROLS = ['pageSize', 'pageOffset', 'pageToken'] as const;

/**
 * What `frodo_find_skills` tells the agent when the recommended capability
 * that it ran returned a result that is not complete.
 */
const EXECUTION_TRUNCATED_NEXT_ACTION =
  'The recommended read-only capability ran, but its result is not complete: execution.truncated is true, execution.data holds execution.returned of execution.total items (execution.total is null when the number is not known). Do not answer a question about counts or missing items from it. Read on with execution.nextPageOffset or execution.nextPageToken through frodo_dispatch_read_only, or use a count capability; if neither is present, read execution.warning.';

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
 * Credentials payload for a browser-login (interactive) request context.
 *
 * @remarks
 * Unlike every other auth mode, resolving this one is not a single
 * synchronous credential lookup — it requires a real interactive round trip
 * (a loopback-redirect or device-authorization flow) before the instance is
 * usable. See {@link McpToolRuntimeOptions.browserLoginPromptHandler}: this
 * runtime never launches a browser or prints to a terminal itself, exactly
 * like `AuthenticateOps.getTokensInteractive()` — the host embedding this
 * MCP server (e.g. `frodo-cli`'s `frodo mcp server start`) must supply a
 * handler that presents the login step however is appropriate for its
 * environment.
 */
export type McpRuntimeBrowserAuth = {
  /** Discriminator for browser-login auth mode. */
  mode: 'browser';
  /** AM host base URL. */
  host: string;
  /** Deployment type — required for browser login, since there is no existing session to auto-detect it from. */
  deploymentType?: string;
  /** Optional realm override. */
  realm?: string;
  /** OAuth2 client id (mandatory for forgeops/classic; cloud has a built-in default). */
  loginClientId?: string;
  /** Override the default scope requested for the target deployment type. */
  loginScope?: string;
  /** Full, absolute redirect URI to use, for a client registered with an exact-match redirect URI (shared with the non-interactive synthetic flow's own redirect URI setting). */
  loginRedirectUri?: string;
  /** Use the OAuth2 Device Authorization Grant instead of a loopback redirect. */
  useDeviceFlow?: boolean;
  /** Optional insecure-connection toggle. */
  allowInsecureConnection?: boolean;
  /** Optional debug toggle. */
  debug?: boolean;
  /** Optional curlirize toggle. */
  curlirize?: boolean;
};

/**
 * Credentials payload for a request context driven by an already-verified,
 * externally-issued OAuth2 access token — the caller (e.g. an MCP server
 * acting as an OAuth2 resource server for its HTTP transport) is expected
 * to have already validated the token (signature/introspection, scope,
 * expiry) before ever constructing this; this runtime never verifies a
 * token itself, only wires an already-trusted one onto a fresh instance.
 *
 * @remarks
 * Unlike every other auth mode, resolving this one never calls a login
 * endpoint at all — see `AuthenticateOps.ts`'s `applyAccessToken()`, which
 * this ultimately dispatches to.
 */
export type McpRuntimeBearerTokenAuth = {
  /** Discriminator for externally-issued-bearer-token auth mode. */
  mode: 'bearer-token';
  /** AM host base URL. */
  host: string;
  /** The already-verified access token. */
  accessToken: string;
  /** Space-delimited granted scope, when known. */
  scope?: string;
  /** Token expiry, epoch milliseconds, when known. */
  expiresAt?: number;
  /**
   * AM SSO session id, when the issuing OAuth2 client has a session-capture
   * script configured (ForgeOps/classic) and it was already recovered by
   * the caller (e.g. via `/oauth2/tokeninfo`'s `sessionToken` field).
   */
  sessionId?: string;
  /** Optional realm override. */
  realm?: string;
  /** Deployment type — required, since there is no existing session to auto-detect it from. */
  deploymentType?: string;
  /** Optional insecure-connection toggle. */
  allowInsecureConnection?: boolean;
  /** Optional debug toggle. */
  debug?: boolean;
  /** Optional curlirize toggle. */
  curlirize?: boolean;
};

/**
 * Union of supported runtime auth modes.
 */
export type McpRuntimeAuth =
  | McpRuntimeServiceAccountAuth
  | McpRuntimeAdminAccountAuth
  | McpRuntimeStateAuth
  | McpRuntimeBrowserAuth
  | McpRuntimeBearerTokenAuth;

/**
 * Execution-scoped context used to create an isolated Frodo instance.
 */
export type McpRuntimeRequestContext = {
  /** Optional caller-supplied correlation id for audit/log stitching. */
  requestId?: string;
  /** Auth mode and credential payload for this request. */
  auth: McpRuntimeAuth;
  /** Optional request-scoped sink for bounded lifecycle and discovery traces. */
  trace?: McpToolRuntimeTraceHandler;
  /**
   * The resolved scoped instance's caller-privilege tier (see
   * `ops/CallerTrustTierOps.ts`'s `determineCallerTrustTier()`), attached
   * once the instance is authenticated. Absent until then; `assertTrustTierAllowed`
   * treats an absent value as `'full-trust'` (see its own remarks for why
   * that default is safe for every existing, non-browser auth mode).
   */
  callerTrustTier?: 'full-trust' | 'delegated';
};

export type McpToolRuntimeTraceCandidate = {
  skillId: string;
  routingStatus: McpCapabilityRoutingStatus;
  matchedObjectTypeCount?: number;
};

export type McpToolRuntimeTraceCriteria = Readonly<
  Pick<
    McpFindSkillsArguments,
    | 'query'
    | 'objectFamily'
    | 'domain'
    | 'objectType'
    | 'skillIdPrefix'
    | 'operationTypes'
    | 'riskClasses'
    | 'kind'
    | 'limit'
    | 'includeIncompatible'
  >
>;

export type McpToolRuntimeTraceEvent = {
  event:
    | 'discovery'
    | 'selection'
    | 'dispatch-start'
    | 'dispatch-success'
    | 'dispatch-failure'
    | 'compatibility-rejection'
    | 'credential-rejection'
    | 'trust-tier-rejection';
  requestId?: string;
  toolName: string;
  descriptorId?: string;
  deploymentType?: McpDeploymentType;
  candidateCount?: number;
  resultCount?: number;
  criteria?: McpToolRuntimeTraceCriteria;
  topCandidates?: McpToolRuntimeTraceCandidate[];
  routingReason?: string;
  elapsedMs?: number;
  error?: string;
};

export type McpToolRuntimeTraceHandler = (
  event: McpToolRuntimeTraceEvent
) => void | Promise<void>;

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
  /** Optional logical target resolved to deployment-specific object types. */
  semanticTarget?: {
    family: string;
    realm?: string;
  };
  /** Optional positional args forwarded to the underlying Frodo method. */
  positionalArgs?: unknown[];
  /** Optional named args forwarded as a single object argument. */
  namedArgs?: Record<string, unknown>;
};

export type McpFindSkillsArguments = {
  query?: string;
  objectFamily?: string;
  domain?: string;
  objectType?: string;
  skillIdPrefix?: string;
  operationTypes?: McpCapabilityOperationType[];
  riskClasses?: Array<'low' | 'medium' | 'high' | 'critical'>;
  kind?: 'generic' | 'special';
  limit?: number;
  includeIncompatible?: boolean;
  /** Execute a unique deterministic read-only recommendation. Defaults to true. */
  executeRecommended?: boolean;
};

export type McpDiscoverArguments = {
  detail?: 'summary' | 'catalog';
};

export type McpDescribeSkillArguments = {
  skillId: string;
};

export type McpDispatchExecutionArguments = {
  skillId?: string;
  operationType?: McpCapabilityOperationType;
  domain?: string;
  objectType?: string;
  scope?: string;
  realm?: string;
  pageSize?: number;
  pageOffset?: number;
  pageToken?: string;
  includeTotal?: boolean;
  semanticTarget?: {
    family: string;
    realm?: string;
  };
  positionalArgs?: unknown[];
  namedArgs?: Record<string, unknown>;
};

/**
 * Pagination metadata returned for list/search style tool calls.
 *
 * @remarks
 * When {@link McpExecutionPaginationMetadata.hasMore} is present, the result
 * is not complete: either the runtime's default response-size safety net (see
 * `applyResponseSizeLimit`) or the caller's own page size sliced an array
 * before it was returned, or a result that the platform pages says that more
 * follow. For an array, `nextPageOffset` is always a usable continuation
 * value in that case. `isPartial` is `true` exactly when
 * {@link McpToolExecutionResult.truncated} is, so it is `false` when that
 * field is absent because the capability cannot say; `warning` then says so.
 */
export type McpExecutionPaginationMetadata = {
  /** Whether the result is cut: more items exist than `data` holds. */
  isPartial: boolean;
  /** Number of rows returned, when the payload is an array or a platform-paged result. */
  returnedCount?: number;
  /**
   * Total number of rows available before truncation, when known. Present
   * only where {@link McpToolExecutionResult.total} is a number and the
   * runtime sliced an array or the platform pages the result. Absent for an
   * array that nothing cut (its `total` is the length of the array, which
   * `returnedCount` also is), for a capability that stopped at a limit of its
   * own or cannot say whether it did (also on the last page of an offset
   * read), and when the platform does not say.
   */
  totalCount?: number;
  /** Requested page size hint, if provided by caller. */
  requestedPageSize?: number;
  /** Requested page offset hint, if provided by caller. */
  requestedPageOffset?: number;
  /** Requested page token hint, if provided by caller. */
  requestedPageToken?: string;
  /** Whether caller requested exact totals. */
  includeTotalRequested?: boolean;
  /** Whether more items remain past the returned page. */
  hasMore?: boolean;
  /** Offset to pass as pageOffset to fetch the next page, when hasMore is true. */
  nextPageOffset?: number;
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
    'array' | 'object' | 'string' | 'number' | 'boolean' | 'null' | 'undefined';
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
    | McpFindSkillsArguments
    | McpDescribeSkillArguments
    | McpDispatchExecutionArguments
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
  /**
   * `true` when `data` holds fewer items than exist, whoever asked for that
   * page (the runtime's size budget or item ceiling, the caller's own
   * `pageSize`, or a platform cursor that says more follow); `false` when
   * `data` holds everything that remains. Placed before `data` so that it is
   * the first thing a reader of the serialized result meets.
   *
   * @remarks
   * Present only on the result of a list or search capability whose result
   * the runtime can read: an array, or a platform-paged result (an object with
   * a `result` array and `pagedResultsCookie`, `resultCount` or
   * `totalPagedResults`). Absent for every other result, and for a live cursor
   * (see {@link McpToolExecutionResult.returned}), which is never complete.
   * A capability that stops at a limit of its own, such as a `maxEvents`
   * argument, is seen only when it returns as many items as that limit: the
   * result is then `truncated` with a `total` of `null`, and `warning` names
   * the capability and the argument. More items may exist; the runtime cannot
   * know. When such a capability also removes duplicates after it stopped
   * (`cloud.log.searchEvents` unless `dedupeByTransactionId` is `false`), a
   * count below the limit proves nothing: `truncated` and `total` are then
   * absent, unless the runtime cut the response itself, and `warning` always
   * says why.
   * Agrees with `metadata.pagination.isPartial`. Not related to `partial`
   * (failed items of a bulk call) nor to `metadata.result.isTruncated` (a host
   * that replaces a result that is too large to send).
   */
  truncated?: boolean;
  /**
   * The number of items in `data`: the length of the array, or of the `result`
   * array of a platform-paged result. Present with {@link McpToolExecutionResult.truncated},
   * for a live cursor, which has no `truncated`, and for a capability that
   * cannot say whether it stopped at its own limit.
   */
  returned?: number;
  /**
   * The number of items that exist before any cut, or `null` when it is not
   * known: the platform does not say (a paged result with an unknown total),
   * or the capability stopped at a limit of its own. Present with
   * {@link McpToolExecutionResult.truncated}.
   */
  total?: number | null;
  /**
   * Pass as `pageOffset` to read the next page of an array result. Present
   * only when `truncated` is `true` and the result is an array.
   */
  nextPageOffset?: number;
  /**
   * Pass as `pageToken` to read the next page of a result that the platform
   * pages itself (the paged-results cookie). Present when the platform
   * returned a cookie: when `truncated` is `true`, and for a live cursor.
   */
  nextPageToken?: string;
  /**
   * One imperative sentence that says the result is not complete (or may not
   * be) and how to read on. Present when `truncated` is `true`, and when the
   * capability cannot say whether it stopped at its own limit; the same text
   * as `metadata.pagination.warning`.
   */
  warning?: string;
  /** Underlying method result payload. */
  data: unknown;
  /** Optional execution metadata for scope and pagination diagnostics. */
  metadata?: McpToolExecutionMetadata;
  /**
   * `true` when at least one item of a bulk call failed: `data` then holds
   * what the function returned for the items that did not fail, and
   * {@link McpToolExecutionResult.itemResults} lists the failures. Absent
   * (the result is exactly what it was before) when no item failed.
   *
   * @remarks
   * Not related to `metadata.pagination.isPartial`, which says that the rows
   * of a list were cut to a page.
   */
  partial?: true;
  /**
   * The failed items of a bulk call, with the number of items that succeeded.
   * Present only together with `partial`. A bulk function of the facade takes
   * a trailing `resultCallback` that an MCP caller cannot send; the runtime
   * passes its own, so a section or an item that fails (for example for lack
   * of a scope of the credential, code `INSUFFICIENT_SCOPE`) no longer ends
   * the call with one error that hides the readable part.
   */
  itemResults?: McpItemResults & {
    /** What `data` holds and what the failures mean, for a reader that does not know the counts. */
    summary: string;
  };
};

/**
 * Optional runtime customization hooks.
 */
export type McpToolRuntimeOptions = {
  /**
   * Optional custom resolver that returns a request-scoped Frodo instance.
   * When omitted, {@link resolveRequestScopedFrodo} is used.
   */
  resolveFrodoForRequest?: (
    context: McpRuntimeRequestContext,
    frodoRoot: Frodo
  ) => Frodo | Promise<Frodo>;
  /**
   * Optional item ceiling of one list or search response: it is the page size
   * when the caller does not ask for one. A result that holds more items is
   * cut, and says so (`truncated`).
   *
   * Defaults to `1000`.
   */
  paginationWarningThreshold?: number;
  /**
   * Optional byte budget of one list or search response, which is also the
   * size from which a payload is flagged as large. A list that does not fit is
   * cut, and says so (`truncated`); an explicit page size does not raise it.
   *
   * Defaults to `65536` bytes.
   */
  resultWarningThresholdBytes?: number;
  /** Optional service-wide sink for payload-free lifecycle traces. */
  trace?: McpToolRuntimeTraceHandler;
  /** Tenant managed-object types available to service-local semantic search. */
  managedObjectTypes?: readonly string[];
  /** Outcome of tenant managed-object type hydration. */
  managedObjectHydrationStatus?: McpManagedObjectHydrationStatus;
  /** Tenant config entity IDs available to service-local semantic search. */
  configEntityIds?: readonly string[];
  /** Outcome of tenant config entity hydration. */
  configEntityHydrationStatus?: McpCatalogHydrationStatus;
  /** Execute unique deterministic read-only recommendations unless a request opts out. */
  executeRecommendedByDefault?: boolean;
  /**
   * Presents a browser-login (auth mode `'browser'`) interactive login step
   * to whoever operates this MCP server. Required only for requests using
   * that auth mode; every other mode ignores it. Frodo's MCP runtime never
   * launches a browser or writes to stdout itself (stdio transport reserves
   * stdout for the JSON-RPC stream) — the embedding host supplies this,
   * typically printing to stderr and/or opening a local browser.
   */
  browserLoginPromptHandler?: BrowserLoginPromptHandler;
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
 * @param frodoRoot Frodo instance used by the default resolver.
 * @param options Optional runtime customization hooks.
 * @returns Runtime object capable of executing manifest tool calls.
 */
export function createToolRuntime(
  manifest: McpToolManifest,
  capabilities: McpCapabilityDescriptor[],
  frodoRoot: Frodo,
  options: McpToolRuntimeOptions = {}
): McpToolRuntime {
  const byId = new Map<string, McpCapabilityDescriptor>(
    capabilities.map((c) => [c.id, c])
  );
  const genericDescriptorIndex = buildGenericDescriptorIndex(
    manifest.genericTools,
    byId
  );
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
      const args = parseDiscoverArguments(request.arguments);
      const { deploymentType, scopedFrodo: discoveryScopedFrodo } =
        await resolveDeploymentAndFrodoForDiscovery(
          request.context,
          frodoRoot,
          options.resolveFrodoForRequest,
          options.browserLoginPromptHandler
        );
      await ensureIdmVersionResolvedForDiscovery(
        deploymentType,
        discoveryScopedFrodo
      );
      const docsContext = resolveDocsContext(
        deploymentType,
        discoveryScopedFrodo?.state?.getAmVersion?.(),
        discoveryScopedFrodo?.state?.getIdmVersion?.()
      );
      emitRuntimeTrace(request, options, {
        event: 'discovery',
        toolName: request.toolName,
        deploymentType,
        resultCount: capabilities.length,
      });
      const {
        activeTarget,
        managedObjectTypeCount,
        managedObjectHydrationStatus,
        configEntityIdCount,
        configEntityHydrationStatus,
        ...discoveryDetails
      } = manifest.discoveryTool;
      const commonDiscoveryData = {
        ...(activeTarget && { activeTarget }),
        ...(deploymentType && { activeDeploymentType: deploymentType }),
        ...(managedObjectTypeCount !== undefined && {
          managedObjectTypeCount,
        }),
        ...(managedObjectHydrationStatus && {
          managedObjectHydrationStatus,
        }),
        ...(configEntityIdCount !== undefined && { configEntityIdCount }),
        ...(configEntityHydrationStatus && { configEntityHydrationStatus }),
        docsContext,
      };
      return {
        toolName: request.toolName,
        data:
          args.detail === 'catalog'
            ? { ...commonDiscoveryData, ...discoveryDetails }
            : {
                ...commonDiscoveryData,
                skillCount: capabilities.length,
                objectFamilies: discoverManagedObjectFamilies(
                  options.managedObjectTypes ?? []
                ),
                guidance:
                  'Bootstrap is complete. Do not call frodo_discover again for this task. Call frodo_find_skills once, then execute its recommendedDispatch when present.',
                nextSteps: [
                  FIND_SKILLS_TOOL_NAME,
                  DESCRIBE_SKILL_TOOL_NAME,
                  DISPATCH_READ_ONLY_TOOL_NAME,
                  DISPATCH_TOOL_NAME,
                ],
              },
      };
    }

    if (request.toolName === FIND_SKILLS_TOOL_NAME) {
      const args = parseFindSkillsArguments(request.arguments);
      const deploymentType = await resolveDeploymentForDiscovery(
        request.context,
        frodoRoot,
        options.resolveFrodoForRequest,
        options.browserLoginPromptHandler
      );
      const result = findSkills(
        capabilities,
        args,
        deploymentType,
        options.managedObjectTypes,
        options.configEntityIds
      );
      const recommendedExecution =
        (args.executeRecommended ??
          options.executeRecommendedByDefault ??
          false) &&
        result.recommendedDispatch
          ? await executeTool({
              toolName: result.recommendedDispatch.toolName,
              arguments: result.recommendedDispatch.arguments,
              context: request.context,
            })
          : undefined;
      emitRuntimeTrace(request, options, {
        event: 'discovery',
        toolName: request.toolName,
        deploymentType,
        candidateCount: result.total,
        resultCount: result.returned,
        criteria: buildFindSkillsTraceCriteria(args),
        topCandidates: result.skills.slice(0, 5).map((skill) => ({
          skillId: skill.skillId,
          routingStatus: skill.routingStatus,
          ...(skill.matchedObjectTypeCount !== undefined && {
            matchedObjectTypeCount: skill.matchedObjectTypeCount,
          }),
        })),
      });
      return {
        toolName: request.toolName,
        data: recommendedExecution
          ? recommendedExecution.truncated === true
            ? {
                // `truncated` is not used here: `total` and `returned` of this
                // answer already count the capabilities that were found.
                executionTruncated: true,
                ...result,
                nextAction: EXECUTION_TRUNCATED_NEXT_ACTION,
                execution: recommendedExecution,
              }
            : {
                ...result,
                nextAction:
                  'Answer the user from execution.data. The recommended read-only skill has already run; do not call any more discovery tools.',
                execution: recommendedExecution,
              }
          : result,
      };
    }

    if (request.toolName === DESCRIBE_SKILL_TOOL_NAME) {
      const args = parseDescribeSkillArguments(request.arguments);
      const descriptor = byId.get(args.skillId);
      if (!descriptor) {
        throw new FrodoError(
          `MCP runtime error: unknown skillId '${args.skillId}'. Use '${FIND_SKILLS_TOOL_NAME}' first.`
        );
      }
      return {
        toolName: request.toolName,
        descriptorId: descriptor.id,
        data: {
          descriptor,
          supportedSelectors: {
            operationType: descriptor.operationType,
            domain: descriptor.domain,
            objectType: descriptor.objectType,
            scope: descriptor.scope,
          },
          ...(isListOperation(descriptor.operationType) && {
            paging: buildPagingGuide(
              paginationWarningThreshold,
              resultWarningThresholdBytes
            ),
          }),
        },
      };
    }

    if (
      request.toolName === DISPATCH_READ_ONLY_TOOL_NAME ||
      request.toolName === DISPATCH_TOOL_NAME
    ) {
      const args = parseDispatchExecutionArguments(request.arguments);
      const contextForExecution = applyDispatchScopeOverride(
        request.context,
        args
      );
      const scopedFrodo = await resolveScopedFrodoInstance(
        contextForExecution,
        frodoRoot,
        options.resolveFrodoForRequest,
        options.browserLoginPromptHandler
      );
      const deploymentType = resolveScopedDeploymentType(
        scopedFrodo,
        contextForExecution
      );
      const descriptor = resolveDescriptorForDispatch(
        request.toolName,
        args,
        byId,
        genericDescriptorIndex,
        manifest.discoveryTool,
        deploymentType
      );
      const routing = describeCapabilityRouting(descriptor, deploymentType);
      emitRuntimeTrace(request, options, {
        event: 'selection',
        toolName: request.toolName,
        descriptorId: descriptor.id,
        deploymentType,
        routingReason: routing.reason,
      });

      if (
        request.toolName === DISPATCH_READ_ONLY_TOOL_NAME &&
        !READ_ONLY_OPERATION_TYPES.includes(descriptor.operationType)
      ) {
        throw new FrodoError(
          `MCP runtime error: '${DISPATCH_READ_ONLY_TOOL_NAME}' cannot execute '${descriptor.operationType}'. Use '${DISPATCH_TOOL_NAME}' instead.`
        );
      }

      if (
        request.toolName === DISPATCH_TOOL_NAME &&
        READ_ONLY_OPERATION_TYPES.includes(descriptor.operationType)
      ) {
        throw new FrodoError(
          `MCP runtime error: '${DISPATCH_TOOL_NAME}' is for mutating operations. Use '${DISPATCH_READ_ONLY_TOOL_NAME}' for '${descriptor.operationType}'.`
        );
      }

      try {
        assertDeploymentCompatibility(descriptor, deploymentType);
      } catch (error) {
        emitRuntimeTrace(request, options, {
          event: 'compatibility-rejection',
          toolName: request.toolName,
          descriptorId: descriptor.id,
          deploymentType,
          routingReason: routing.reason,
          error: toErrorMessage(error),
        });
        throw error;
      }
      try {
        assertRequiredCredential(descriptor, scopedFrodo);
      } catch (error) {
        emitRuntimeTrace(request, options, {
          event: 'credential-rejection',
          toolName: request.toolName,
          descriptorId: descriptor.id,
          deploymentType,
          routingReason: routing.reason,
          error: toErrorMessage(error),
        });
        throw error;
      }
      try {
        assertTrustTierAllowed(descriptor, contextForExecution);
      } catch (error) {
        emitRuntimeTrace(request, options, {
          event: 'trust-tier-rejection',
          toolName: request.toolName,
          descriptorId: descriptor.id,
          deploymentType,
          routingReason: routing.reason,
          error: toErrorMessage(error),
        });
        throw error;
      }
      const startedAt = Date.now();
      emitRuntimeTrace(request, options, {
        event: 'dispatch-start',
        toolName: request.toolName,
        descriptorId: descriptor.id,
        deploymentType,
      });
      const collection = prepareResultCollection(descriptor);
      let methodResult: unknown;
      try {
        methodResult =
          descriptor.kind === 'generic'
            ? await invokeGenericDescriptorMethod(
                scopedFrodo,
                descriptor,
                args as McpGenericExecutionArguments,
                options.managedObjectTypes ?? [],
                options.managedObjectHydrationStatus,
                collection
              )
            : await invokeDescriptorMethod(
                scopedFrodo,
                descriptor,
                toInvocationArgs(args, descriptor),
                collection
              );
        emitRuntimeTrace(request, options, {
          event: 'dispatch-success',
          toolName: request.toolName,
          descriptorId: descriptor.id,
          deploymentType,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        emitRuntimeTrace(request, options, {
          event: 'dispatch-failure',
          toolName: request.toolName,
          descriptorId: descriptor.id,
          deploymentType,
          elapsedMs: Date.now() - startedAt,
          error: toErrorMessage(error),
        });
        throw error;
      }
      const generic = descriptor.kind === 'generic';
      const { data: responseData, truncation } = generic
        ? applyResponseSizeLimit(
            methodResult,
            args as McpGenericExecutionArguments,
            descriptor.operationType,
            paginationWarningThreshold,
            resultWarningThresholdBytes
          )
        : { data: methodResult, truncation: undefined };

      // What says whether `data` is everything there is. It is built from the
      // same facts as `metadata.pagination`, so the two cannot disagree, and
      // it is spread before `data` so that it is the first thing a reader of
      // the serialized result meets.
      const listCompleteness = isListOperation(descriptor.operationType)
        ? summarizeListResult(
            responseData,
            truncation,
            {
              maxBytes: resultWarningThresholdBytes,
              maxItems: paginationWarningThreshold,
            },
            LIVE_CURSOR_CAPABILITY_IDS.includes(descriptor.id),
            resolveSelfCap(descriptor, args as McpGenericExecutionArguments)
          )
        : undefined;

      const metadata = buildGenericExecutionMetadata(
        responseData,
        args as McpGenericExecutionArguments,
        descriptor.operationType,
        contextForExecution,
        resultWarningThresholdBytes,
        truncation,
        listCompleteness
      );

      const itemResults = collection?.collector.results();

      return {
        toolName: request.toolName,
        descriptorId: descriptor.id,
        ...listCompleteness,
        data: responseData,
        ...(metadata ? { metadata } : {}),
        ...(itemResults
          ? {
              partial: true as const,
              itemResults: {
                ...itemResults,
                summary: summarizeItemResults(itemResults, descriptor.mutating),
              },
            }
          : {}),
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

function emitRuntimeTrace(
  request: McpToolExecutionRequest,
  options: McpToolRuntimeOptions,
  event: Omit<McpToolRuntimeTraceEvent, 'requestId'>
): void {
  const traceEvent: McpToolRuntimeTraceEvent = {
    ...event,
    ...(request.context.requestId && {
      requestId: request.context.requestId,
    }),
  };
  for (const handler of [options.trace, request.context.trace]) {
    if (!handler) {
      continue;
    }
    try {
      void Promise.resolve(handler(traceEvent)).catch(() => undefined);
    } catch {
      // Tracing must never alter tool behavior.
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.name : 'Error';
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
  deploymentType?: McpDeploymentType
): void {
  if (!deploymentType || deploymentType === 'any') {
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
 * Verifies a descriptor's declared {@link McpRequiredCredential} is actually
 * present on the dispatching Frodo instance's state before invoking it.
 *
 * @remarks
 * Some capabilities authenticate with a credential other than the standard
 * AM/IDM bearer token (e.g. the Identity Cloud Log API's `X-API-Key`/
 * `X-API-Secret` pair). That credential isn't guaranteed to be populated just
 * because the session is otherwise authenticated — it comes from the
 * connection profile's own optional fields or explicit env vars. Failing here
 * with an actionable message is preferable to letting the underlying HTTP
 * call surface a bare 401.
 */
function assertRequiredCredential(
  descriptor: McpCapabilityDescriptor,
  scopedFrodo: Frodo
): void {
  if (!descriptor.requiredCredential) {
    return;
  }

  if (descriptor.requiredCredential === 'logApi') {
    const state = scopedFrodo.state;
    if (state?.getLogApiKey() && state?.getLogApiSecret()) {
      return;
    }
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' requires a Log API key/secret, which is not configured for this connection. Add logApiKey/logApiSecret to the connection profile (see 'cloud.log.createLogApiKey' to provision one).`,
      null,
      'LOG_API_CREDENTIAL_MISSING'
    );
  }
}

/**
 * Verifies a descriptor's declared {@link McpCapabilityTrustTier} is
 * satisfied by the resolved caller's own tier before invoking it.
 *
 * @remarks
 * `'full-trust'` is a superset, not a separate exclusive category — it can
 * invoke *any* descriptor, including one marked `'delegated'`. Only a
 * resolved `'delegated'` caller is actually restricted, to descriptors
 * marked `'delegated'` or `'both'`. `context.callerTrustTier` is only ever
 * attached by `resolveScopedFrodoInstance()` (see its remarks) — a caller
 * that bypassed that path (a fully custom `resolveFrodoForRequest` with no
 * matching authentication step) is treated as `'full-trust'`, the same
 * default every existing non-browser auth mode already resolves to, so
 * this check is a pure no-op unless a browser-login caller was actually
 * resolved as `'delegated'`.
 */
function assertTrustTierAllowed(
  descriptor: McpCapabilityDescriptor,
  context: McpRuntimeRequestContext
): void {
  const callerTier = context.callerTrustTier ?? 'full-trust';
  // 'full-trust' is a superset, not a separate exclusive category — a
  // full-trust caller (every existing non-browser auth mode, by
  // construction) can invoke anything, including a 'delegated'-marked
  // capability. Only a resolved 'delegated' caller is actually restricted,
  // to capabilities marked 'delegated' or 'both'.
  if (callerTier === 'full-trust') {
    return;
  }
  if (descriptor.trustTier === 'delegated' || descriptor.trustTier === 'both') {
    return;
  }
  throw new FrodoError(
    `MCP runtime error: descriptor '${descriptor.id}' requires trust tier '${descriptor.trustTier}', which this session's caller ('${callerTier}') does not have.`
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

  return normalizeDeploymentType(rawType);
}

function resolveScopedDeploymentType(
  scopedFrodo: Frodo,
  context: McpRuntimeRequestContext
): McpDeploymentType | undefined {
  return (
    normalizeDeploymentType(scopedFrodo.state?.getDeploymentType?.()) ??
    resolveContextDeploymentType(context)
  );
}

function normalizeDeploymentType(
  rawType: unknown
): McpDeploymentType | undefined {
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
 * Three settings belong to the process, not to a request: air-gapped mode, the
 * switch of the template catalog cache and its directory. The factory helpers
 * build a scoped instance from the credentials of its auth mode, so without
 * this it would start with air-gapped mode off (a request could reach the
 * public catalog host although the process must not) and with the catalog cache
 * off (every request would download the catalog again). The scoped instance
 * takes the three settings from the root instance, whatever the auth mode.
 * Nothing a request or a scoped instance does can loosen them: air-gapped mode
 * and the cache switch only ever go on, and the directory of the root, if it
 * has one, wins over a directory that the scoped instance has of its own.
 *
 * @param scopedFrodo Instance built for a request.
 * @param frodoRoot Root frodo instance of the process.
 * @returns The scoped instance.
 */
function inheritProcessSettings(scopedFrodo: Frodo, frodoRoot: Frodo): Frodo {
  if (scopedFrodo?.state && frodoRoot?.state && scopedFrodo !== frodoRoot) {
    if (
      frodoRoot.state.getAirGapped?.() === true &&
      scopedFrodo.state.getAirGapped?.() !== true
    ) {
      scopedFrodo.state.setAirGapped(true);
    }
    if (
      frodoRoot.state.getUseTemplateCatalogCache?.() === true &&
      scopedFrodo.state.getUseTemplateCatalogCache?.() !== true
    ) {
      scopedFrodo.state.setUseTemplateCatalogCache(true);
    }
    const rootCatalogCachePath =
      frodoRoot.state.getTemplateCatalogCachePath?.();
    if (
      rootCatalogCachePath &&
      scopedFrodo.state.getTemplateCatalogCachePath?.() !== rootCatalogCachePath
    ) {
      scopedFrodo.state.setTemplateCatalogCachePath(rootCatalogCachePath);
    }
  }
  return scopedFrodo;
}

/**
 * Creates a request-scoped Frodo instance using standard factory helpers and
 * the provided auth mode. The instance takes the settings that belong to the
 * process from the root instance: air-gapped mode, the switch of the template
 * catalog cache and the directory of that cache (a scoped instance can not
 * turn off or redirect what the root has set).
 *
 * @param context Request-scoped runtime context.
 * @param frodoRoot Root frodo instance exposing `createInstance*` helpers.
 * @returns New request-scoped Frodo instance.
 */
export function resolveRequestScopedFrodo(
  context: McpRuntimeRequestContext,
  frodoRoot: Frodo
): Frodo {
  return inheritProcessSettings(
    createRequestScopedFrodo(context, frodoRoot),
    frodoRoot
  );
}

/**
 * Builds the instance for the auth mode of a request, from its credentials only.
 */
function createRequestScopedFrodo(
  context: McpRuntimeRequestContext,
  frodoRoot: Frodo
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
    case 'browser':
      // Only seeds state (authMode + host/realm/connection options) — the
      // actual interactive round trip happens afterward, in
      // resolveScopedFrodoInstance(), which calls getTokensInteractive()
      // instead of the getTokens() every other mode uses.
      return frodoRoot.createInstanceWithBrowserLogin(
        context.auth.host,
        context.auth.loginClientId,
        context.auth.loginScope,
        context.auth.loginRedirectUri,
        context.auth.realm,
        context.auth.deploymentType,
        context.auth.allowInsecureConnection,
        context.auth.debug,
        context.auth.curlirize
      );
    case 'bearer-token':
      // Only seeds bare config (host/realm/deploymentType/connection
      // options, token cache disabled) — applying the already-verified
      // token itself happens afterward, in resolveScopedFrodoInstance(),
      // which calls login.applyAccessToken() instead of getTokens().
      return frodoRoot.createInstanceWithAccessToken(
        context.auth.host,
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
  descriptors: McpCapabilityDescriptor[],
  deploymentType?: McpDeploymentType
): McpCapabilityDescriptor {
  if (descriptors.length === 1) {
    return descriptors[0];
  }

  let candidates = descriptors;

  const requestedScope =
    typeof args.scope === 'string' && args.scope.trim().length > 0
      ? args.scope.trim()
      : undefined;
  if (requestedScope) {
    const scopedDescriptors = candidates.filter(
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
    candidates = scopedDescriptors;
  }

  if (args.namedArgs && typeof args.namedArgs === 'object') {
    const matchingDescriptors = candidates.filter((descriptor) =>
      matchesNamedArgumentShape(
        descriptor,
        args.namedArgs as Record<string, unknown>
      )
    );
    if (matchingDescriptors.length > 0) {
      candidates = matchingDescriptors;
    }
  }

  const supportedScopes = [
    ...new Set(
      candidates
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

  return rankCapabilitiesForDeployment(candidates, deploymentType)[0];
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
  ) => Frodo | Promise<Frodo>,
  browserLoginPromptHandler?: BrowserLoginPromptHandler
): Promise<Frodo> {
  // resolveRequestScopedFrodo gives its instance the settings of the process; an
  // instance that a custom resolver builds in another way gets them here
  const scopedFrodo = customResolver
    ? inheritProcessSettings(
        await customResolver(context, frodoRoot),
        frodoRoot
      )
    : resolveRequestScopedFrodo(context, frodoRoot);

  // The request-scoped factory helpers seed state from only the credential
  // fields each auth mode carries — auxiliary connection-profile credentials
  // (Log API key/secret) never make it onto scoped instances, so a singleton
  // whose connection profile had them configured would still fail
  // assertRequiredCredential on any realm-overridden request. Inherit each
  // credential the scoped instance is missing from the root instance's state
  // (getLogApiKey()/getLogApiSecret() fall back to FRODO_LOG_KEY/FRODO_LOG_
  // SECRET themselves, so an explicit env-provided credential is unaffected).
  try {
    if (scopedFrodo?.state && frodoRoot?.state) {
      const rootLogApiKey = frodoRoot.state.getLogApiKey?.();
      if (!scopedFrodo.state.getLogApiKey?.() && rootLogApiKey) {
        scopedFrodo.state.setLogApiKey(rootLogApiKey);
      }
      const rootLogApiSecret = frodoRoot.state.getLogApiSecret?.();
      if (!scopedFrodo.state.getLogApiSecret?.() && rootLogApiSecret) {
        scopedFrodo.state.setLogApiSecret(rootLogApiSecret);
      }
    }
  } catch {
    // Best-effort inheritance — when the credentials genuinely aren't
    // available anywhere, assertRequiredCredential raises its own clean,
    // actionable error below.
  }

  // The request-scoped factory helpers of the service account and of the admin
  // account set no token cache option, so such an instance has the cache off
  // and logs in on every realm-overridden request, however the server was
  // started (frodo-lib#907). The cache key does not contain the realm of the
  // request, so the instance finds the credential that the root instance (or an
  // earlier request) stored. A scoped instance takes the cache switch and the
  // cache path of the root instance unless it has a setting of its own (a custom
  // resolver may set one); these two kinds of credential are encrypted with a
  // key derived from the credential itself, so the master key plays no part. A
  // bearer token that a caller presented is never cached (it belongs to the
  // caller), and a browser login keeps its own session reuse; neither is
  // touched. The `state-config` mode copies the whole state and needs nothing.
  if (
    (context.auth.mode === 'service-account' ||
      context.auth.mode === 'admin-account') &&
    scopedFrodo?.state &&
    frodoRoot?.state &&
    scopedFrodo !== frodoRoot &&
    scopedFrodo.state.getUseTokenCache() === undefined
  ) {
    const rootUseTokenCache = frodoRoot.state.getUseTokenCache();
    if (rootUseTokenCache !== undefined) {
      scopedFrodo.state.setUseTokenCache(rootUseTokenCache);
      const rootTokenCachePath = frodoRoot.state.getTokenCachePath();
      if (rootTokenCachePath && !scopedFrodo.state.getTokenCachePath()) {
        scopedFrodo.state.setTokenCachePath(rootTokenCachePath);
      }
    }
  }

  // A caller-configuration error, not an authentication failure — thrown
  // outside the try/catch below so its specific message isn't swallowed by
  // the generic "authentication failed" wrapper.
  if (context.auth.mode === 'browser' && !browserLoginPromptHandler) {
    throw new FrodoError(
      `MCP runtime error: auth mode 'browser' requires a browserLoginPromptHandler (see McpToolRuntimeOptions.browserLoginPromptHandler) to present the login step to whoever operates this MCP server — this runtime never launches a browser itself.`
    );
  }

  // Authenticate the scoped instance before any method is invoked. getTokens()
  // populates the instance-local state with a valid bearer token and raises a
  // clean authentication error here rather than letting a 401/403 surface deep
  // inside a library method call. Browser-login mode is the one exception:
  // it needs a real interactive round trip (getTokensInteractive()), not the
  // silent credential lookup every other mode uses.
  try {
    if (context.auth.mode === 'browser') {
      await scopedFrodo.login.getTokensInteractive({
        deploymentType: context.auth.deploymentType,
        useDeviceFlow: context.auth.useDeviceFlow,
        loginClientId: context.auth.loginClientId,
        loginScope: context.auth.loginScope,
        loginRedirectUri: context.auth.loginRedirectUri,
        promptHandler: browserLoginPromptHandler,
      });
    } else if (context.auth.mode === 'bearer-token') {
      const expiresAt = context.auth.expiresAt ?? Date.now();
      await scopedFrodo.login.applyAccessToken({
        access_token: context.auth.accessToken,
        token_type: 'Bearer',
        scope: context.auth.scope ?? '',
        expires_in: Math.max(0, Math.round((expiresAt - Date.now()) / 1000)),
        expires: expiresAt,
        sessionId: context.auth.sessionId,
      });
    } else {
      await scopedFrodo.login.getTokens();
    }
  } catch (error) {
    throw new FrodoError(
      'MCP runtime error: authentication failed for request-scoped Frodo instance.',
      error instanceof Error ? error : new Error(String(error))
    );
  }

  // Attached to the request context (mutated in place — the same object
  // reference the dispatch path reads afterward) so assertTrustTierAllowed
  // can enforce McpCapabilityTrustTier without re-deriving it per
  // descriptor. Cheap/instant for every existing non-browser auth mode; see
  // determineCallerTrustTier()'s own remarks for why. Tolerates a
  // partial/fake `.state` (a fully custom resolver's returned instance
  // isn't guaranteed to carry a complete one) the same way
  // assertRequiredCredential's own `state?.` usage above does — leaving
  // `callerTrustTier` unset here still resolves to the same 'full-trust'
  // default assertTrustTierAllowed already applies for every non-browser
  // mode, so this is never a silent privilege escalation, only a skipped
  // (redundant) determination.
  try {
    context.callerTrustTier = await determineCallerTrustTier({
      state: scopedFrodo.state,
    });
  } catch {
    // leave context.callerTrustTier unset — see remarks above.
  }

  return scopedFrodo;
}

/**
 * Resolves the active deployment type for a discovery-style request, along
 * with the scoped Frodo instance if one had to be authenticated to determine
 * it (undefined when the deployment type was already known from context —
 * the common fast path — so callers that only need the version-detection
 * side effect don't pay for an extra auth round-trip they didn't ask for).
 */
async function resolveDeploymentAndFrodoForDiscovery(
  context: McpRuntimeRequestContext,
  frodoRoot: Frodo,
  customResolver?: (
    context: McpRuntimeRequestContext,
    frodoRoot: Frodo
  ) => Frodo | Promise<Frodo>,
  browserLoginPromptHandler?: BrowserLoginPromptHandler
): Promise<{ deploymentType?: McpDeploymentType; scopedFrodo?: Frodo }> {
  const configuredDeployment = resolveContextDeploymentType(context);
  if (configuredDeployment) {
    return { deploymentType: configuredDeployment };
  }

  const configuredHost =
    context.auth.mode === 'state-config'
      ? context.auth.config.host
      : context.auth.host;
  if (!configuredHost) {
    return {};
  }

  const scopedFrodo = await resolveScopedFrodoInstance(
    context,
    frodoRoot,
    customResolver,
    browserLoginPromptHandler
  );
  return {
    deploymentType: resolveScopedDeploymentType(scopedFrodo, context),
    scopedFrodo,
  };
}

/**
 * Lazily resolves and caches the IDM version on a scoped instance's state,
 * for forgeops deployments only (the only deployment type whose docs
 * routing consults it — see DocsContext.ts). Deferred out of the shared
 * login path so plain authentication never pays for an IDM round trip that
 * only the discovery tool's forgeops docs routing needs. Best-effort: an
 * unreachable or misbehaving IDM instance must not fail discovery, so
 * failures here are swallowed and simply leave the IDM version unresolved.
 */
async function ensureIdmVersionResolvedForDiscovery(
  deploymentType: McpDeploymentType | undefined,
  scopedFrodo: Frodo | undefined
): Promise<void> {
  const state = scopedFrodo?.state;
  if (deploymentType !== 'forgeops' || !state || state.getIdmVersion()) {
    return;
  }
  try {
    const idmVersionInfo = await getIdmServerVersionInfo({ state });
    const idmVersion = getSemanticVersion({
      version: idmVersionInfo?.productVersion,
    });
    state.setIdmVersion(idmVersion);
  } catch {
    // leave the IDM version unresolved; DocsContext reports it as such
  }
}

async function resolveDeploymentForDiscovery(
  context: McpRuntimeRequestContext,
  frodoRoot: Frodo,
  customResolver?: (
    context: McpRuntimeRequestContext,
    frodoRoot: Frodo
  ) => Frodo | Promise<Frodo>,
  browserLoginPromptHandler?: BrowserLoginPromptHandler
): Promise<McpDeploymentType | undefined> {
  const { deploymentType } = await resolveDeploymentAndFrodoForDiscovery(
    context,
    frodoRoot,
    customResolver,
    browserLoginPromptHandler
  );
  return deploymentType;
}

/**
 * Invokes a generic descriptor, including MCP-specific paging adapters where the
 * public ops helper aggregates all pages instead of returning a single page.
 */
async function invokeGenericDescriptorMethod(
  scopedFrodo: Frodo,
  descriptor: McpCapabilityDescriptor,
  args: McpGenericExecutionArguments,
  managedObjectTypes: readonly string[],
  managedObjectHydrationStatus?: McpManagedObjectHydrationStatus,
  collection?: ResultCollection
): Promise<unknown> {
  if (
    args.semanticTarget &&
    descriptor.id !== 'idm.managed.countManagedObjects'
  ) {
    args = resolveSemanticTargetIntoType(
      args,
      descriptor,
      managedObjectTypes,
      managedObjectHydrationStatus
    );
  }

  if (descriptor.id === 'script.createScript') {
    return invokeScriptCreate(scopedFrodo, args, descriptor);
  }

  if (descriptor.id === 'idm.managed.queryManagedObjects') {
    return invokeManagedObjectSearchPage(scopedFrodo, args, descriptor);
  }

  if (
    descriptor.id === 'idm.managed.countManagedObjects' &&
    args.semanticTarget
  ) {
    return invokeManagedObjectFamilyCount(
      scopedFrodo,
      args,
      descriptor,
      managedObjectTypes,
      managedObjectHydrationStatus
    );
  }

  return invokeDescriptorMethod(
    scopedFrodo,
    descriptor,
    toInvocationArgs(args, descriptor),
    collection
  );
}

/**
 * Resolves a `semanticTarget` to the managed-object types it names.
 *
 * @param args Dispatch arguments carrying the semantic target.
 * @param descriptor Descriptor of the skill that is dispatched.
 * @param managedObjectTypes Managed-object types of the connected tenant.
 * @param managedObjectHydrationStatus Outcome of the type discovery.
 * @param purpose What the types are resolved for, used in the error messages.
 * @returns The resolved family, the requested realm, if any, and the matching types.
 */
function resolveSemanticManagedObjectTypes(
  args: McpGenericExecutionArguments,
  descriptor: McpCapabilityDescriptor,
  managedObjectTypes: readonly string[],
  managedObjectHydrationStatus: McpManagedObjectHydrationStatus | undefined,
  purpose: 'count' | 'target'
) {
  if (
    managedObjectHydrationStatus === 'failed' ||
    managedObjectHydrationStatus === 'timed-out'
  ) {
    throw new FrodoError(
      `MCP runtime error: semantic ${purpose} is unavailable because managed-object type hydration ${managedObjectHydrationStatus}. Use exact dispatch with namedArgs.type or restart the server after restoring tenant access.`
    );
  }
  const resolution = resolveSemanticObjectFamily(
    args.semanticTarget?.family,
    managedObjectTypes
  );
  if (resolution.status !== 'resolved') {
    throw new FrodoError(formatFamilyResolutionError(resolution));
  }
  const family = resolution.family;
  if (!descriptorPatternsSupportFamily(descriptor.objectTypePatterns, family)) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' does not support semantic family '${family}'.`
    );
  }

  const requestedRealm = args.semanticTarget?.realm
    ?.trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  const matches = managedObjectTypes
    .map((type) => matchManagedObjectFamily(type, family))
    .filter((match): match is NonNullable<typeof match> => !!match)
    .filter(
      (match) =>
        !requestedRealm || match.realm?.toLowerCase() === requestedRealm
    );

  if (matches.length === 0) {
    throw new FrodoError(
      `MCP runtime error: no managed-object types matched semantic family '${family}'${
        requestedRealm ? ` in realm '${requestedRealm}'` : ''
      }. Exact dispatch remains available with namedArgs.type.`
    );
  }
  return { family, requestedRealm, matches };
}

/**
 * Resolves a `semanticTarget` into the `type` argument of a skill that works on
 * exactly one managed-object type per call.
 *
 * @remarks
 * The target is never dropped silently: a skill that takes no `type`, a target
 * that is combined with an explicit type, and a target that names several types
 * are all rejected before the underlying method is called.
 *
 * @param args Dispatch arguments carrying the semantic target.
 * @param descriptor Descriptor of the skill that is dispatched.
 * @param managedObjectTypes Managed-object types of the connected tenant.
 * @param managedObjectHydrationStatus Outcome of the type discovery.
 * @returns The dispatch arguments with `namedArgs.type` set to the resolved type.
 */
function resolveSemanticTargetIntoType(
  args: McpGenericExecutionArguments,
  descriptor: McpCapabilityDescriptor,
  managedObjectTypes: readonly string[],
  managedObjectHydrationStatus?: McpManagedObjectHydrationStatus
): McpGenericExecutionArguments {
  if (!descriptor.parameters?.some((parameter) => parameter.name === 'type')) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' does not accept semanticTarget because it takes no managed-object type. Pass namedArgs or positionalArgs instead.`
    );
  }
  if (args.namedArgs?.type !== undefined || args.positionalArgs !== undefined) {
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' takes either semanticTarget or an explicit type (namedArgs.type or positionalArgs), not both.`
    );
  }
  const { family, matches } = resolveSemanticManagedObjectTypes(
    args,
    descriptor,
    managedObjectTypes,
    managedObjectHydrationStatus,
    'target'
  );
  if (matches.length !== 1) {
    throw new FrodoError(
      `MCP runtime error: semantic family '${family}' matched ${matches.length} managed-object types (${matches
        .map((match) => match.type)
        .join(
          ', '
        )}) but '${descriptor.id}' takes exactly one. Add semanticTarget.realm or pass namedArgs.type.`
    );
  }
  return { ...args, namedArgs: { ...args.namedArgs, type: matches[0].type } };
}

async function invokeManagedObjectFamilyCount(
  scopedFrodo: Frodo,
  args: McpGenericExecutionArguments,
  descriptor: McpCapabilityDescriptor,
  managedObjectTypes: readonly string[],
  managedObjectHydrationStatus?: McpManagedObjectHydrationStatus
): Promise<unknown> {
  const { family, requestedRealm, matches } = resolveSemanticManagedObjectTypes(
    args,
    descriptor,
    managedObjectTypes,
    managedObjectHydrationStatus,
    'count'
  );
  if (requestedRealm && matches.length !== 1) {
    throw new FrodoError(
      `MCP runtime error: realm '${requestedRealm}' resolved to ${matches.length} managed-object types for family '${family}'. Use namedArgs.type for an exact count.`
    );
  }

  const filter =
    typeof args.namedArgs?.filter === 'string'
      ? args.namedArgs.filter
      : undefined;
  const breakdown = await Promise.all(
    matches.map(async (match) => ({
      family,
      type: match.type,
      ...(match.realm && { realm: match.realm }),
      count: (await invokeDescriptorMethod(scopedFrodo, descriptor, [
        match.type,
        filter,
      ])) as number,
    }))
  );

  return {
    family,
    ...(requestedRealm && { realm: requestedRealm }),
    total: breakdown.reduce((total, entry) => total + entry.count, 0),
    breakdown,
  };
}

async function invokeScriptCreate(
  scopedFrodo: Frodo,
  args: McpGenericExecutionArguments,
  descriptor: McpCapabilityDescriptor
): Promise<unknown> {
  const invocationArgs = toInvocationArgs(args, descriptor);

  const scriptId = invocationArgs[0] as string | undefined;
  const requestedScriptName = invocationArgs[1] as string | undefined;
  const scriptData = invocationArgs[2] as unknown;
  if (!scriptId || typeof scriptId !== 'string') {
    throw new FrodoError(
      "MCP runtime error: descriptor 'script.createScript' requires namedArgs.scriptId."
    );
  }
  if (!scriptData || typeof scriptData !== 'object') {
    throw new FrodoError(
      "MCP runtime error: descriptor 'script.createScript' requires namedArgs.scriptData as an object."
    );
  }

  const scriptName =
    typeof requestedScriptName === 'string' && requestedScriptName.length > 0
      ? requestedScriptName
      : scriptId;

  return invokeDescriptorMethod(scopedFrodo, descriptor, [
    scriptId,
    scriptName,
    scriptData,
  ]);
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
    // `pageToken` is the cookie that this query handed out as `nextPageToken`
    pageCookie: resolveCookieValue(pageCookie, args.pageToken) as
      string | undefined,
    state: scopedFrodo.state,
  });
}

function parseFindSkillsArguments(raw: unknown): McpFindSkillsArguments {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const args = raw as McpFindSkillsArguments;
  if (
    args.objectFamily !== undefined &&
    (typeof args.objectFamily !== 'string' || !args.objectFamily.trim())
  ) {
    throw new FrodoError(
      `MCP runtime error: '${FIND_SKILLS_TOOL_NAME}' requires objectFamily to be a non-empty string.`
    );
  }
  if (
    args.limit !== undefined &&
    (!Number.isInteger(args.limit) || args.limit <= 0)
  ) {
    throw new FrodoError(
      `MCP runtime error: '${FIND_SKILLS_TOOL_NAME}' requires limit to be a positive integer when provided.`
    );
  }
  if (
    args.includeIncompatible !== undefined &&
    typeof args.includeIncompatible !== 'boolean'
  ) {
    throw new FrodoError(
      `MCP runtime error: '${FIND_SKILLS_TOOL_NAME}' requires includeIncompatible to be a boolean when provided.`
    );
  }
  if (
    args.executeRecommended !== undefined &&
    typeof args.executeRecommended !== 'boolean'
  ) {
    throw new FrodoError(
      `MCP runtime error: '${FIND_SKILLS_TOOL_NAME}' requires executeRecommended to be a boolean when provided.`
    );
  }
  return args;
}

function parseDiscoverArguments(raw: unknown): McpDiscoverArguments {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object') {
    throw new FrodoError(
      `MCP runtime error: '${DISCOVERY_TOOL_NAME}' requires an arguments object when provided.`
    );
  }
  const args = raw as McpDiscoverArguments;
  if (
    args.detail !== undefined &&
    args.detail !== 'summary' &&
    args.detail !== 'catalog'
  ) {
    throw new FrodoError(
      `MCP runtime error: '${DISCOVERY_TOOL_NAME}' requires detail to be 'summary' or 'catalog'.`
    );
  }
  return args;
}

function buildFindSkillsTraceCriteria(
  args: McpFindSkillsArguments
): McpToolRuntimeTraceCriteria | undefined {
  const criteria: McpToolRuntimeTraceCriteria = {
    ...(args.query !== undefined && { query: args.query }),
    ...(args.objectFamily !== undefined && {
      objectFamily: args.objectFamily,
    }),
    ...(args.domain !== undefined && { domain: args.domain }),
    ...(args.objectType !== undefined && { objectType: args.objectType }),
    ...(args.skillIdPrefix !== undefined && {
      skillIdPrefix: args.skillIdPrefix,
    }),
    ...(args.operationTypes !== undefined && {
      operationTypes: [...args.operationTypes],
    }),
    ...(args.riskClasses !== undefined && {
      riskClasses: [...args.riskClasses],
    }),
    ...(args.kind !== undefined && { kind: args.kind }),
    ...(args.limit !== undefined && { limit: args.limit }),
    ...(args.includeIncompatible !== undefined && {
      includeIncompatible: args.includeIncompatible,
    }),
  };
  return Object.keys(criteria).length > 0 ? criteria : undefined;
}

function parseDescribeSkillArguments(raw: unknown): McpDescribeSkillArguments {
  const args = raw as McpDescribeSkillArguments | undefined;
  if (!args || typeof args !== 'object' || !args.skillId) {
    throw new FrodoError(
      `MCP runtime error: '${DESCRIBE_SKILL_TOOL_NAME}' requires skillId.`
    );
  }
  if (typeof args.skillId !== 'string') {
    throw new FrodoError(
      `MCP runtime error: '${DESCRIBE_SKILL_TOOL_NAME}' requires skillId to be a string.`
    );
  }
  return args;
}

function parseDispatchExecutionArguments(
  raw: unknown
): McpDispatchExecutionArguments {
  if (!raw || typeof raw !== 'object') {
    throw new FrodoError(
      `MCP runtime error: dispatch tools require an arguments object.`
    );
  }
  const args = raw as McpDispatchExecutionArguments;
  if (
    args.skillId === undefined &&
    (!args.operationType || !args.domain || !args.objectType)
  ) {
    throw new FrodoError(
      `MCP runtime error: dispatch tools require skillId or the selector tuple { operationType, domain, objectType }.`
    );
  }
  if (args.skillId !== undefined && typeof args.skillId !== 'string') {
    throw new FrodoError(
      `MCP runtime error: dispatch tools require skillId to be a string when provided.`
    );
  }
  if (args.realm !== undefined && typeof args.realm !== 'string') {
    throw new FrodoError(
      'MCP runtime error: dispatch tools require realm to be a string when provided.'
    );
  }
  if (args.semanticTarget !== undefined) {
    if (
      !args.semanticTarget ||
      typeof args.semanticTarget !== 'object' ||
      typeof args.semanticTarget.family !== 'string' ||
      !args.semanticTarget.family.trim() ||
      (args.semanticTarget.realm !== undefined &&
        typeof args.semanticTarget.realm !== 'string')
    ) {
      throw new FrodoError(
        'MCP runtime error: dispatch tools require semanticTarget with a non-empty family and optional string realm.'
      );
    }
  }
  if (args.scope !== undefined && typeof args.scope !== 'string') {
    throw new FrodoError(
      'MCP runtime error: dispatch tools require scope to be a string when provided.'
    );
  }
  if (
    args.pageSize !== undefined &&
    (!Number.isInteger(args.pageSize) || args.pageSize <= 0)
  ) {
    throw new FrodoError(
      'MCP runtime error: dispatch tools require pageSize to be a positive integer when provided.'
    );
  }
  if (
    args.pageOffset !== undefined &&
    (!Number.isInteger(args.pageOffset) || args.pageOffset < 0)
  ) {
    throw new FrodoError(
      'MCP runtime error: dispatch tools require pageOffset to be a non-negative integer when provided.'
    );
  }
  if (args.pageToken !== undefined && typeof args.pageToken !== 'string') {
    throw new FrodoError(
      'MCP runtime error: dispatch tools require pageToken to be a string when provided.'
    );
  }
  if (
    args.includeTotal !== undefined &&
    typeof args.includeTotal !== 'boolean'
  ) {
    throw new FrodoError(
      'MCP runtime error: dispatch tools require includeTotal to be a boolean when provided.'
    );
  }
  return args;
}

function findSkills(
  capabilities: McpCapabilityDescriptor[],
  args: McpFindSkillsArguments,
  deploymentType?: McpDeploymentType,
  managedObjectTypes: readonly string[] = [],
  configEntityIds: readonly string[] = []
): {
  total: number;
  returned: number;
  guidance?: string;
  nextAction?: string;
  recommendedDispatch?: {
    toolName: typeof DISPATCH_READ_ONLY_TOOL_NAME;
    arguments: McpDispatchExecutionArguments;
  };
  skills: Array<{
    skillId: string;
    kind: McpCapabilityDescriptor['kind'];
    operationType: McpCapabilityOperationType;
    domain: string;
    objectType: string;
    methodName: string;
    modulePath: string;
    riskClass: McpCapabilityDescriptor['riskClass'];
    deploymentTypes: McpCapabilityDescriptor['deploymentTypes'];
    preferredDeploymentTypes?: McpCapabilityDescriptor['preferredDeploymentTypes'];
    identitySurface?: McpCapabilityDescriptor['identitySurface'];
    requiredCredential?: McpCapabilityDescriptor['requiredCredential'];
    objectTypePatterns?: string[];
    matchedObjectFamilies?: McpSemanticObjectFamily[];
    matchedObjectTypes?: string[];
    matchedObjectTypeCount?: number;
    routingStatus: McpCapabilityRoutingStatus;
    routingReason: string;
    argumentMode?: McpCapabilityDescriptor['argumentMode'];
    scope?: string;
    matchedSemanticAliases?: string[];
    matchedConfigEntityIds?: string[];
    matchedConfigEntityIdCount?: number;
    matchedConfigEntityTypes?: string[];
    matchedConfigEntityTypeCount?: number;
    recommendedDispatch?: {
      toolName: typeof DISPATCH_READ_ONLY_TOOL_NAME;
      arguments: McpDispatchExecutionArguments;
    };
  }>;
} {
  const queryTerms = normalizeSearchTerms(args.query);
  const configEntityTypes = [
    ...new Set(
      configEntityIds
        .map((id) => id.split('/')[0])
        .filter((type): type is string => !!type)
    ),
  ];
  const requestedResolution = args.objectFamily
    ? resolveSemanticObjectFamily(args.objectFamily, managedObjectTypes)
    : undefined;
  if (requestedResolution && requestedResolution.status !== 'resolved') {
    return {
      total: 0,
      returned: 0,
      guidance: formatFamilyResolutionError(requestedResolution),
      skills: [],
    };
  }
  const queryResolution = findSemanticObjectFamilies(
    args.query,
    managedObjectTypes
  );
  if (queryResolution.ambiguity) {
    return {
      total: 0,
      returned: 0,
      guidance: formatFamilyResolutionError(queryResolution.ambiguity),
      skills: [],
    };
  }
  const requestedFamily =
    requestedResolution?.status === 'resolved'
      ? requestedResolution.family
      : undefined;
  const queryFamilies = queryResolution.families;
  if (isUserIdentitySelector(args)) queryFamilies.add('user');
  if (requestedFamily) queryFamilies.add(requestedFamily);
  const filtered = capabilities.flatMap((descriptor) => {
    const matchesManagedUserAlias =
      isUserIdentitySelector(args) && descriptor.identitySurface === 'managed';
    if (args.kind && descriptor.kind !== args.kind) {
      return [];
    }
    if (
      requestedFamily &&
      !descriptorPatternsSupportFamily(
        descriptor.objectTypePatterns,
        requestedFamily
      )
    ) {
      return [];
    }
    if (
      args.domain &&
      descriptor.domain !== args.domain &&
      !matchesManagedUserAlias
    ) {
      return [];
    }
    if (
      args.objectType &&
      descriptor.objectType !== args.objectType &&
      !matchesManagedUserAlias
    ) {
      return [];
    }
    if (
      args.skillIdPrefix &&
      !(
        descriptor.id === args.skillIdPrefix ||
        descriptor.id.startsWith(`${args.skillIdPrefix}.`)
      )
    ) {
      return [];
    }
    if (
      args.operationTypes &&
      args.operationTypes.length > 0 &&
      !args.operationTypes.includes(descriptor.operationType)
    ) {
      return [];
    }
    if (
      args.riskClasses &&
      args.riskClasses.length > 0 &&
      !args.riskClasses.includes(descriptor.riskClass)
    ) {
      return [];
    }
    const routing = describeCapabilityRouting(descriptor, deploymentType);
    if (
      routing.status === 'incompatible' &&
      deploymentType &&
      deploymentType !== 'any' &&
      !args.includeIncompatible
    ) {
      return [];
    }
    const managedObjectMatches = findMatchedManagedObjectTypes(
      descriptor,
      queryTerms,
      managedObjectTypes,
      queryFamilies
    );
    const matchedSemanticAliases = findMatchedSemanticAliases(
      descriptor,
      args.query
    );
    const semanticPhrases = [args.query ?? '', ...matchedSemanticAliases];
    const configEntityMatches = descriptor.parameters?.some(
      (parameter) => parameter.name === 'entityId'
    )
      ? matchSemanticIdentifiers(semanticPhrases, configEntityIds)
      : [];
    const configTypeMatches =
      descriptor.modulePath.join('.') === 'idm.config' &&
      descriptor.parameters?.some((parameter) => parameter.name === 'type')
        ? matchSemanticIdentifiers(semanticPhrases, configEntityTypes)
        : [];
    const relevance =
      scoreCapabilitySearch(descriptor, queryTerms) +
      scoreSemanticAliasPhrases(matchedSemanticAliases, args.query) +
      Math.max(
        configEntityMatches[0]?.matchedTerms.length ?? 0,
        configTypeMatches[0]?.matchedTerms.length ?? 0
      ) *
        12 +
      (descriptor.scope === 'bulk' && queryTerms.includes('all') ? 32 : 0) +
      [...queryFamilies].filter((family) =>
        descriptorPatternsSupportFamily(descriptor.objectTypePatterns, family)
      ).length *
        8 +
      managedObjectMatches.matches.length * 6 +
      getRoutingRelevanceBonus(routing.status);
    return queryTerms.length === 0 || relevance > 0
      ? [
          {
            descriptor,
            relevance,
            routing,
            managedObjectMatches,
            matchedSemanticAliases,
            configEntityMatches,
            configTypeMatches,
          },
        ]
      : [];
  });

  const limit = args.limit ?? 100;
  const results = filtered
    .sort(
      (left, right) =>
        right.relevance - left.relevance ||
        getRoutingRank(left.routing.status) -
          getRoutingRank(right.routing.status) ||
        left.descriptor.id.localeCompare(right.descriptor.id)
    )
    .slice(0, limit)
    .map(
      ({
        descriptor,
        routing,
        managedObjectMatches,
        matchedSemanticAliases,
        configEntityMatches,
        configTypeMatches,
      }) => {
        const matchedObjectFamilies = [...queryFamilies].filter((family) =>
          descriptorPatternsSupportFamily(descriptor.objectTypePatterns, family)
        );
        const semanticCountFamily =
          descriptor.id === 'idm.managed.countManagedObjects' &&
          matchedObjectFamilies.length === 1
            ? matchedObjectFamilies[0]
            : undefined;
        const exactManagedObjectType = managedObjectMatches.matches.find(
          (type) => args.query?.toLowerCase().includes(type.toLowerCase())
        );
        const recommendedCountArguments =
          exactManagedObjectType && acceptsExactTypeAlone(descriptor)
            ? {
                skillId: descriptor.id,
                namedArgs: { type: exactManagedObjectType },
              }
            : semanticCountFamily
              ? {
                  skillId: descriptor.id,
                  semanticTarget: { family: semanticCountFamily },
                }
              : undefined;
        return {
          skillId: descriptor.id,
          kind: descriptor.kind,
          operationType: descriptor.operationType,
          domain: descriptor.domain,
          objectType: descriptor.objectType,
          methodName: descriptor.methodName,
          modulePath: descriptor.modulePath.join('.'),
          riskClass: descriptor.riskClass,
          deploymentTypes: descriptor.deploymentTypes,
          preferredDeploymentTypes: descriptor.preferredDeploymentTypes,
          identitySurface: descriptor.identitySurface,
          requiredCredential: descriptor.requiredCredential,
          objectTypePatterns: descriptor.objectTypePatterns,
          ...(matchedObjectFamilies.length > 0 && { matchedObjectFamilies }),
          ...(managedObjectMatches.total > 0 && {
            matchedObjectTypes: managedObjectMatches.matches,
            matchedObjectTypeCount: managedObjectMatches.total,
          }),
          routingStatus: routing.status,
          routingReason: routing.reason,
          argumentMode: descriptor.argumentMode,
          scope: descriptor.scope,
          ...(matchedSemanticAliases.length > 0 && { matchedSemanticAliases }),
          ...(configEntityMatches.length > 0 && {
            matchedConfigEntityIds: configEntityMatches
              .slice(0, 5)
              .map((match) => match.identifier),
            matchedConfigEntityIdCount: configEntityMatches.length,
          }),
          ...(configTypeMatches.length > 0 && {
            matchedConfigEntityTypes: configTypeMatches
              .slice(0, 5)
              .map((match) => match.identifier),
            matchedConfigEntityTypeCount: configTypeMatches.length,
          }),
          ...(recommendedCountArguments && {
            recommendedDispatch: {
              toolName: 'frodo_dispatch_read_only' as const,
              arguments: recommendedCountArguments,
            },
          }),
        };
      }
    );

  const recommendedDispatch =
    results.length === 1 ? results[0].recommendedDispatch : undefined;
  return {
    total: filtered.length,
    returned: results.length,
    ...(recommendedDispatch && {
      nextAction:
        'Execute recommendedDispatch now. Do not call frodo_discover, frodo_find_skills, or frodo_describe_skill again for this read-only task.',
      recommendedDispatch,
    }),
    ...(results.length === 0 &&
      (args.domain || args.objectType || args.skillIdPrefix) && {
        guidance:
          queryFamilies.size > 0
            ? `The recognized object ${
                queryFamilies.size === 1 ? 'family is' : 'families are'
              } unavailable under the active profile, policy, and deployment constraints.`
            : 'No skills matched all exact filters. domain, objectType, and skillIdPrefix are exact skill coordinates, not tenant object names. Retry with query and operationTypes only.',
      }),
    skills: results,
  };
}

/**
 * Whether `namedArgs { type }` is a complete argument set that the skill accepts
 * and may be dispatched read-only.
 *
 * @remarks
 * `frodo_find_skills` recommends an exact dispatch when the query names a
 * managed-object type. The recommendation must be something the dispatcher
 * accepts: a skill that takes no arguments, takes them positionally, needs
 * more than the type, or changes data is not recommended.
 *
 * @param descriptor Descriptor of the skill.
 * @returns True if the recommendation is safe to hand to the client.
 */
function acceptsExactTypeAlone(descriptor: McpCapabilityDescriptor): boolean {
  if (descriptor.mutating) {
    return false;
  }
  const argumentMode = descriptor.argumentMode ?? 'mixed';
  if (argumentMode === 'none' || argumentMode === 'positional') {
    return false;
  }
  const parameters = descriptor.parameters;
  if (!parameters || parameters.length === 0) {
    // No declared contract: nothing to contradict.
    return true;
  }
  return (
    parameters.some((parameter) => parameter.name === 'type') &&
    parameters.every(
      (parameter) => !parameter.required || parameter.name === 'type'
    )
  );
}

function isUserIdentitySelector(args: McpFindSkillsArguments): boolean {
  return (
    args.domain?.toLowerCase() === 'user' &&
    (!args.objectType || args.objectType.toLowerCase() === 'user')
  );
}

function findMatchedManagedObjectTypes(
  descriptor: McpCapabilityDescriptor,
  terms: string[],
  managedObjectTypes: readonly string[],
  requestedFamilies: ReadonlySet<McpSemanticObjectFamily>
): { matches: string[]; total: number } {
  if (
    descriptor.identitySurface !== 'managed' ||
    (terms.length === 0 && requestedFamilies.size === 0)
  ) {
    return { matches: [], total: 0 };
  }
  const concreteTerms = terms.filter(
    (term) =>
      !MANAGED_TYPE_GENERIC_TERMS.has(term) &&
      !termMatchesRequestedFamily(term, requestedFamilies, managedObjectTypes)
  );
  const rankedMatches = managedObjectTypes
    .map((type) => {
      const normalizedType = type.toLowerCase();
      const typeTerms = normalizeSearchTerms(type);
      const matchesRequestedFamily =
        requestedFamilies.size === 0 ||
        [...requestedFamilies].some((family) =>
          matchManagedObjectFamily(type, family)
        );
      const matchedTermCount =
        terms.filter(
          (term) =>
            normalizedType === term ||
            normalizedType.includes(term) ||
            typeTerms.includes(term) ||
            termMatchesRequestedFamily(
              term,
              requestedFamilies,
              managedObjectTypes
            )
        ).length +
        (matchesRequestedFamily && requestedFamilies.size > 0 ? 1 : 0);
      const matchesConcreteTerms = concreteTerms.every(
        (term) => normalizedType.includes(term) || typeTerms.includes(term)
      );
      return {
        type,
        matchedTermCount,
        matchesConcreteTerms,
        matchesRequestedFamily,
      };
    })
    .filter(
      ({ matchedTermCount, matchesConcreteTerms, matchesRequestedFamily }) =>
        matchedTermCount > 0 && matchesConcreteTerms && matchesRequestedFamily
    )
    .sort(
      (left, right) =>
        right.matchedTermCount - left.matchedTermCount ||
        left.type.localeCompare(right.type)
    )
    .map(({ type }) => type);
  return { matches: rankedMatches.slice(0, 5), total: rankedMatches.length };
}

const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'forgerock',
  'in',
  'of',
  'the',
  'to',
  'environment',
  'cloud',
]);

const SEARCH_SYNONYMS: Record<string, string[]> = {
  count: ['many', 'number', 'total'],
  identity: ['user', 'person'],
  list: ['enumerate'],
  read: ['get'],
  search: ['find', 'query'],
  user: ['identity', 'person'],
};

const MANAGED_TYPE_GENERIC_TERMS = new Set([
  'count',
  'enumerate',
  'find',
  'get',
  'group',
  'identity',
  'list',
  'managed',
  'many',
  'number',
  'object',
  'person',
  'query',
  'read',
  'search',
  'total',
  'user',
]);

function normalizeSearchTerms(query?: string): string[] {
  if (!query) return [];
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9*]+/)
        .map(normalizeSearchTerm)
        .filter((term) => term && !SEARCH_STOP_WORDS.has(term))
    ),
  ];
}

function findSemanticObjectFamilies(
  query: string | undefined,
  managedObjectTypes: readonly string[]
): {
  families: Set<McpSemanticObjectFamily>;
  ambiguity?: Extract<
    McpSemanticObjectFamilyResolution,
    { status: 'ambiguous' }
  >;
} {
  if (!query) return { families: new Set() };
  if (
    managedObjectTypes.some(
      (type) => type.toLowerCase() === query.trim().toLowerCase()
    )
  ) {
    return { families: new Set() };
  }
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
  const matches: Array<
    | { family: McpSemanticObjectFamily; start: number; end: number }
    | {
        ambiguity: Extract<
          McpSemanticObjectFamilyResolution,
          { status: 'ambiguous' }
        >;
        start: number;
        end: number;
      }
  > = [];
  tokens.forEach((_, start) => {
    tokens.slice(start).forEach((__, offset) => {
      const phrase = tokens.slice(start, start + offset + 1).join(' ');
      if (
        managedObjectTypes.length === 0 &&
        !(phrase in MCP_SEMANTIC_OBJECT_SYNONYMS) &&
        !(phrase in MCP_AMBIGUOUS_OBJECT_CONCEPTS)
      ) {
        return;
      }
      const resolution = resolveSemanticObjectFamily(
        phrase,
        managedObjectTypes
      );
      if (resolution.status === 'resolved') {
        matches.push({
          family: resolution.family,
          start,
          end: start + offset + 1,
        });
      } else if (resolution.status === 'ambiguous') {
        matches.push({ ambiguity: resolution, start, end: start + offset + 1 });
      }
    });
  });
  const mostSpecific = matches.filter(
    (match) =>
      !matches.some(
        (candidate) =>
          candidate.start <= match.start &&
          candidate.end >= match.end &&
          candidate.end - candidate.start > match.end - match.start
      )
  );
  const ambiguous = mostSpecific.find((match) => 'ambiguity' in match);
  if (ambiguous && 'ambiguity' in ambiguous) {
    return { families: new Set(), ambiguity: ambiguous.ambiguity };
  }
  return {
    families: new Set(
      mostSpecific.flatMap((match) => ('family' in match ? [match.family] : []))
    ),
  };
}

function termMatchesRequestedFamily(
  term: string,
  requestedFamilies: ReadonlySet<McpSemanticObjectFamily>,
  managedObjectTypes: readonly string[]
): boolean {
  const resolution = resolveSemanticObjectFamily(term, managedObjectTypes);
  return (
    resolution.status === 'resolved' &&
    [...requestedFamilies].some(
      (family) =>
        normalizeSemanticObjectFamily(family) ===
        normalizeSemanticObjectFamily(resolution.family)
    )
  );
}

function formatFamilyResolutionError(
  resolution: Exclude<McpSemanticObjectFamilyResolution, { status: 'resolved' }>
): string {
  const candidates = resolution.candidates.join(', ');
  return resolution.status === 'ambiguous'
    ? `The managed-object concept is ambiguous. Choose one of: ${candidates}.`
    : `No managed-object family matched the live tenant catalog.${
        candidates ? ` Closest candidates: ${candidates}.` : ''
      }`;
}

function normalizeSearchTerm(term: string): string {
  if (term === 'identities') return 'identity';
  if (term.length > 3 && term.endsWith('ies')) return `${term.slice(0, -3)}y`;
  if (term.length > 3 && term.endsWith('s')) return term.slice(0, -1);
  return term;
}

function scoreCapabilitySearch(
  descriptor: McpCapabilityDescriptor,
  terms: string[]
): number {
  if (terms.length === 0) return 0;
  const weightedFields: Array<[string, number]> = [
    [descriptor.id, 12],
    [descriptor.operationType, 10],
    [descriptor.domain, 9],
    [descriptor.objectType, 9],
    [descriptor.methodName, 8],
    [descriptor.modulePath.join('.'), 8],
    [descriptor.scope ?? '', 7],
    [descriptor.identitySurface ?? '', 7],
    ...(descriptor.objectTypePatterns ?? []).map(
      (pattern) => [pattern, 7] as [string, number]
    ),
    ...(descriptor.parameters ?? []).flatMap((parameter) => [
      [parameter.name, 4] as [string, number],
      [parameter.description ?? '', 2] as [string, number],
    ]),
    ...(descriptor.semanticAliases ?? []).map(
      (alias) => [alias, 10] as [string, number]
    ),
    [descriptor.notes ?? '', 6],
  ];
  const operationAliases = [
    descriptor.operationType,
    ...(SEARCH_SYNONYMS[descriptor.operationType] ?? []),
  ];
  // Only read-like operations get the generic identity/user/person bonus —
  // otherwise every create/update/delete/relationship-write skill on a user
  // object ties with the actual identity-lookup skills on any query
  // containing "identity" or "user", crowding them out regardless of how
  // specifically a skill's own notes describe it.
  const identityAliases =
    READ_ONLY_OPERATION_TYPES.includes(descriptor.operationType) &&
    (descriptor.identitySurface === 'managed' ||
      descriptor.identitySurface === 'am-user' ||
      descriptor.objectTypePatterns?.some((pattern) =>
        pattern.includes('user')
      ))
      ? ['user', 'identity', 'person']
      : [];

  return terms.reduce((score, term) => {
    const aliases = [term, ...(SEARCH_SYNONYMS[term] ?? [])];
    const fieldScore = weightedFields.reduce((best, [field, weight]) => {
      const normalizedField = field.toLowerCase();
      return aliases.some((alias) => normalizedField.includes(alias))
        ? Math.max(best, weight)
        : best;
    }, 0);
    const semanticScore = aliases.some(
      (alias) =>
        operationAliases.includes(alias) || identityAliases.includes(alias)
    )
      ? 8
      : 0;
    return score + Math.max(fieldScore, semanticScore);
  }, 0);
}

function findMatchedSemanticAliases(
  descriptor: McpCapabilityDescriptor,
  query?: string
): string[] {
  if (!query) return [];
  const queryTerms = new Set(normalizeSearchTerms(query));
  return (descriptor.semanticAliases ?? []).filter((alias) => {
    const aliasTerms = normalizeSearchTerms(alias);
    return (
      aliasTerms.length > 0 && aliasTerms.every((term) => queryTerms.has(term))
    );
  });
}

function scoreSemanticAliasPhrases(
  aliases: readonly string[],
  query?: string
): number {
  if (!query || aliases.length === 0) return 0;
  const normalizedQuery = normalizeSearchTerms(query).join(' ');
  return aliases.reduce((best, alias) => {
    const normalizedAlias = normalizeSearchTerms(alias).join(' ');
    return normalizedAlias && normalizedQuery.includes(normalizedAlias)
      ? Math.max(best, normalizedAlias.split(' ').length * 12)
      : best;
  }, 0);
}

function getRoutingRank(status: McpCapabilityRoutingStatus): number {
  return ['preferred', 'compatible', 'unknown', 'incompatible'].indexOf(status);
}

/**
 * Routing-status bonus folded additively into a search result's relevance
 * score, rather than used as an absolute pre-sort tier (see findSkills).
 *
 * @remarks
 * Routing status answers "is this capability the deployment-native way to do
 * this, or just a compatible fallback" — meaningful when comparing genuine
 * alternative implementations of the same operation (e.g. classic
 * `user.countUsers` vs cloud `idm.managed.countManagedObjects`). It says
 * nothing about how relevant a capability is to an unrelated query. A small
 * additive bonus preserves the original intent — break near-ties toward the
 * deployment-native answer — without letting it categorically outrank every
 * more-relevant "compatible" result from a completely different domain, the
 * way an absolute pre-sort tier did.
 *
 * No entry for "incompatible" deliberately: incompatible results are already
 * excluded by default (see the includeIncompatible check above) and only
 * ever reach this scoring at all when a caller explicitly asks to see them
 * for diagnostics — a penalty here large enough to push them below the
 * relevance > 0 inclusion filter would make them vanish from that
 * diagnostic view entirely instead of just sorting last. The secondary
 * getRoutingRank tiebreak in findSkills' sort still orders them after
 * preferred/compatible results whenever relevance ties.
 */
const ROUTING_RELEVANCE_BONUS: Partial<
  Record<McpCapabilityRoutingStatus, number>
> = {
  preferred: 6,
};

function getRoutingRelevanceBonus(status: McpCapabilityRoutingStatus): number {
  return ROUTING_RELEVANCE_BONUS[status] ?? 0;
}

function resolveDescriptorForDispatch(
  toolName: string,
  args: McpDispatchExecutionArguments,
  descriptorById: Map<string, McpCapabilityDescriptor>,
  genericDescriptorIndex: Map<string, McpCapabilityDescriptor[]>,
  discovery: McpDiscoveryEntry,
  deploymentType?: McpDeploymentType
): McpCapabilityDescriptor {
  if (args.skillId) {
    const descriptor = descriptorById.get(args.skillId);
    if (!descriptor) {
      throw new FrodoError(
        `MCP runtime error: unknown skillId '${args.skillId}'. Use '${FIND_SKILLS_TOOL_NAME}' first.`
      );
    }
    return descriptor;
  }

  const key = buildGenericDescriptorIndexKey(
    args.operationType!,
    args.domain!,
    args.objectType!
  );
  const descriptors = genericDescriptorIndex.get(key);
  if (!descriptors || descriptors.length === 0) {
    throw new FrodoError(
      buildUnsupportedGenericCombinationMessage(
        toolName,
        args.domain!,
        args.objectType!,
        discovery
      )
    );
  }

  return selectGenericDescriptor(
    toolName,
    args as McpGenericExecutionArguments,
    descriptors,
    deploymentType
  );
}

function applyDispatchScopeOverride(
  context: McpRuntimeRequestContext,
  args: McpDispatchExecutionArguments
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
    return withPageTokenAsCookie(
      maybeArgs.positionalArgs,
      descriptor,
      maybeArgs.pageToken
    );
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
 * Name of the parameter that carries the cursor of a capability whose platform
 * pages the result itself (the log reads).
 */
const COOKIE_PARAMETER = 'cookie';

/**
 * The names under which a capability takes that cursor: `cookie` for the log
 * reads, `pageCookie` for the queries of IDM. Every one of them is filled by
 * the `pageToken` argument with the same rule ({@link resolveCookieValue}), so
 * that no capability gets a cursor twice and none gets it by another rule.
 */
const COOKIE_PARAMETERS: readonly string[] = [COOKIE_PARAMETER, 'pageCookie'];

/**
 * Optional string parameters of the log reads for which `null` means the same
 * as `undefined` or an empty string: left out. A JSON payload has no
 * `undefined`, so `null` is how a caller leaves such a parameter out, and the
 * log API treats an empty value as an absent one. A required parameter and
 * the parameters of every other capability still reject `null`.
 */
const NULL_MEANS_LEFT_OUT: Readonly<Record<string, readonly string[]>> = {
  'cloud.log.fetch': [COOKIE_PARAMETER, 'txid', 'filter'],
  'cloud.log.tail': [COOKIE_PARAMETER],
};

/**
 * Tells whether a `null` for this parameter counts as left out (see
 * {@link NULL_MEANS_LEFT_OUT}).
 */
function nullMeansLeftOut(
  descriptor: McpCapabilityDescriptor,
  parameter: McpCapabilityParameter
): boolean {
  return (
    !parameter.required &&
    (NULL_MEANS_LEFT_OUT[descriptor.id] ?? []).includes(parameter.name)
  );
}

/**
 * Decides which value the `cookie` parameter of a call gets.
 *
 * @remarks
 * One rule for named and positional calls. A cookie that the caller gave
 * (anything but `undefined`, `null` or an empty string) wins. A cookie that is
 * absent, `null` or empty counts as left out, and then the `pageToken`
 * argument is the cookie, unless it is empty too. When there is nothing to put
 * in, the value the caller gave is kept as it is.
 *
 * @param given Value of the `cookie` parameter in the call, if any.
 * @param pageToken Value of the `pageToken` argument, if any.
 * @returns The value for the `cookie` parameter.
 */
function resolveCookieValue(given: unknown, pageToken: unknown): unknown {
  if (given !== undefined && given !== null && given !== '') {
    return given;
  }
  if (typeof pageToken === 'string' && pageToken !== '') {
    return pageToken;
  }
  return given;
}

/**
 * Fills the `cookie` slot of a positional call from the `pageToken` argument.
 *
 * @remarks
 * A capability whose platform pages the result itself (the log reads) takes
 * the cursor as a parameter named `cookie`. A named call maps `pageToken` to
 * it by name (see {@link resolveNamedOrGenericParameterValue}); a positional
 * call has to do the same, or the token would be dropped without a word. The
 * rule for which of the two wins is {@link resolveCookieValue}. A capability
 * without a `cookie` parameter is left alone, and the arguments of the caller
 * are never modified.
 *
 * @param positionalArgs Positional arguments of the call.
 * @param descriptor Descriptor of the capability that is called.
 * @param pageToken Value of the `pageToken` argument, if any.
 * @returns The positional arguments, with the slot filled where it was empty.
 */
function withPageTokenAsCookie(
  positionalArgs: unknown[],
  descriptor: McpCapabilityDescriptor | undefined,
  pageToken: unknown
): unknown[] {
  const slot = descriptor?.parameters?.find((parameter) =>
    COOKIE_PARAMETERS.includes(parameter.name)
  )?.position;
  if (slot === undefined) {
    return positionalArgs;
  }
  const resolved = resolveCookieValue(positionalArgs[slot], pageToken);
  if (resolved === positionalArgs[slot]) {
    return positionalArgs;
  }
  const filled = [...positionalArgs];
  while (filled.length < slot) {
    filled.push(undefined);
  }
  filled[slot] = resolved;
  return filled;
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
      `MCP runtime error: descriptor '${descriptor.id}' requires namedArgs. Use frodo_describe_skill for the exact parameter contract.`
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
    argumentMode !== 'none' &&
    !hasPositional &&
    !hasNamed &&
    requiresNamedParameters
  ) {
    // Without arguments the method would be called with `undefined` for every
    // parameter (for example GET /openidm/managed/undefined).
    throw new FrodoError(
      `MCP runtime error: descriptor '${descriptor.id}' requires arguments. Allowed parameters: ${formatDescriptorParameters(descriptor)}.`
    );
  }

  if (hasPositional && descriptor.parameters) {
    validatePositionalArguments(
      descriptor,
      descriptor.parameters,
      args.positionalArgs as unknown[]
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
    if (value === null && nullMeansLeftOut(descriptor, parameter)) {
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
  if (COOKIE_PARAMETERS.includes(parameter.name)) {
    return resolveCookieValue(providedValue, args.pageToken);
  }
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
  validateArgumentValue(
    descriptorId,
    parameter,
    value,
    parameter.schema ?? inferSchemaFromParameterType(parameter.type),
    `named argument '${parameter.name}'`
  );
}

/**
 * Validates the positional arguments of a call against the parameters whose
 * schema was set explicitly in the capability metadata.
 *
 * @remarks
 * A schema that is only inferred from the declared type of a parameter is not
 * enforced for a positional call: positional callers have always been able to
 * pass any value for such a parameter, and the method decides. A parameter
 * with an explicit schema is a deliberate statement about the shape of the
 * value, so it holds for both ways of calling. `null` and `undefined` are not
 * checked: a JSON payload has no `undefined`, so `null` is how a caller skips
 * an optional parameter.
 *
 * @param descriptor Descriptor of the capability that is called.
 * @param parameters Declared parameters of the capability.
 * @param positionalArgs Positional arguments of the call.
 */
function validatePositionalArguments(
  descriptor: McpCapabilityDescriptor,
  parameters: McpCapabilityParameter[],
  positionalArgs: unknown[]
): void {
  for (const parameter of parameters) {
    const index = parameter.position;
    if (
      !parameter.schema ||
      index === undefined ||
      index >= positionalArgs.length
    ) {
      continue;
    }
    const value = positionalArgs[index];
    if (value === undefined || value === null) {
      continue;
    }
    validateArgumentValue(
      descriptor.id,
      parameter,
      value,
      parameter.schema,
      `positionalArgs[${index}] ('${parameter.name}')`
    );
  }
}

/**
 * Checks one argument value against a schema and throws a message that names
 * the argument, the problems, the expected shape and an example.
 */
function validateArgumentValue(
  descriptorId: string,
  parameter: McpCapabilityParameter,
  value: unknown,
  schema: McpCapabilityParameterSchema | undefined,
  label: string
): void {
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
    `MCP runtime error: descriptor '${descriptorId}' received invalid value for ${label}: ${problems.join('; ')}; expected ${expected}.${exampleText}`
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
 * A collecting result callback for one call and the position where the method
 * takes it.
 */
type ResultCollection = {
  /** Zero-based position of the `resultCallback` parameter of the method. */
  position: number;
  collector: McpResultCollector;
};

/**
 * Prepares the collecting result callback for a call, when the method of the
 * descriptor takes one.
 *
 * @remarks
 * Which methods take a result callback is read from the signature of the
 * facade method (the generated Help.ts catalog), not from a list in the
 * capability metadata, so every function with a `resultCallback` is covered,
 * including those added later. An MCP caller cannot send a function; with the
 * callback in place a bulk function reports each failed item to it and goes
 * on, instead of throwing at the first one (frodo-lib#957).
 *
 * @param descriptor Capability descriptor about to be invoked.
 * @returns The collection, or `undefined` for a method without a result callback.
 */
function prepareResultCollection(
  descriptor: McpCapabilityDescriptor
): ResultCollection | undefined {
  const position = findResultCallbackPosition(descriptor.methodName);
  return position === undefined
    ? undefined
    : { position, collector: createResultCollector() };
}

/**
 * Says in a sentence what `data` holds when items failed.
 *
 * @param results What the function reported.
 * @param mutating Whether the capability writes: a failed item is then not applied.
 * @returns The sentence.
 */
function summarizeItemResults(
  results: McpItemResults,
  mutating: boolean
): string {
  const one = results.failedCount === 1;
  const failed = `${one ? '1 reported item' : `${results.failedCount} reported items`} failed`;
  const consequence = mutating
    ? `${one ? 'was' : 'were'} not completed`
    : `${one ? 'is' : 'are'} missing from data`;
  const omitted = results.omittedFailureCount
    ? ` ${results.omittedFailureCount} failures are not listed.`
    : '';
  const rest = mutating
    ? 'data holds what the function returned for the others.'
    : 'data holds the rest.';
  return `${failed} and ${consequence}; ${results.succeededCount} succeeded.${omitted} ${rest} Report the failures to the user.`;
}

/**
 * Resolves and executes the exact method referenced by a capability descriptor.
 *
 * @param instance Request-scoped Frodo instance.
 * @param descriptor Capability descriptor containing method path metadata.
 * @param args Positional arguments to pass to the resolved method.
 * @param collection The collecting result callback to pass to a method that
 *   takes one, see {@link prepareResultCollection}.
 * @returns The resolved method result.
 */
async function invokeDescriptorMethod(
  instance: Frodo,
  descriptor: McpCapabilityDescriptor,
  args: unknown[],
  collection?: ResultCollection
): Promise<unknown> {
  const method = resolveDescriptorMethod(instance, descriptor);
  const callArgs = collection
    ? placeResultCallback(
        args,
        collection.position,
        collection.collector.callback
      )
    : args;
  try {
    return await Promise.resolve(method(...callArgs));
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
 * Builds standardized execution metadata for generic tool calls.
 *
 * @param truncation Truncation result from {@link applyResponseSizeLimit},
 *   when the caller already applied it. `data` must be the (possibly
 *   sliced) value actually being returned, not the pre-truncation original —
 *   metadata describes what the caller receives.
 * @param listCompleteness What {@link summarizeListResult} made of the same
 *   data, for list and search calls whose result the runtime can read.
 */
function buildGenericExecutionMetadata(
  data: unknown,
  args: McpGenericExecutionArguments,
  operationType: McpCapabilityOperationType,
  context: McpRuntimeRequestContext,
  resultWarningThresholdBytes: number,
  truncation?: McpArrayTruncationResult,
  listCompleteness?: McpListCompleteness
): McpToolExecutionMetadata | undefined {
  const scope = buildScopeMetadata(data, args, context);
  const pagination = buildPaginationMetadata(
    data,
    args,
    operationType,
    truncation,
    listCompleteness
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
 * Result of applying the default response-size safety net to an array result.
 */
type McpArrayTruncationResult = {
  returnedCount: number;
  totalCount: number;
  hasMore: boolean;
  nextPageOffset?: number;
};

/**
 * The fields of a result that say whether `data` is everything there is.
 */
type McpListCompleteness = Pick<
  McpToolExecutionResult,
  (typeof LIST_COMPLETENESS_FIELDS)[number]
>;

/**
 * The limits that cut one response, as they appear in the warning.
 */
type McpListLimits = {
  /** Byte budget of one response. */
  maxBytes: number;
  /** Item ceiling of one response. */
  maxItems: number;
};

/**
 * The limit that a self-capping capability applies to one call.
 */
type McpSelfCap = {
  /** The capability, named in the warnings. */
  capability: string;
  /** The argument that sets the limit; absent when the limit is fixed. */
  argument?: string;
  /** The limit that applies to this call. */
  cap: number;
  /** What to do to read the rest, for a capability with a fixed limit. */
  readOn?: string;
  /** The argument that removes duplicates after the limit, and whether it is on. */
  dedupe?: { argument: string; on: boolean };
  /** Whether the capability reads whole pages, so that it can return more than the limit. */
  readsWholePages?: boolean;
};

/**
 * Resolves the limit that a self-capping capability applies to this call: the
 * value the caller sent for the argument that sets it, or its default.
 *
 * @remarks
 * Deduplication counts as on for every value but `false`, which is how the
 * operations function reads it (it removes duplicates for any truthy value, so
 * the runtime never believes it is off when it is on).
 *
 * A limit that is not a finite number cannot be compared with the number of
 * items, so the rule is not applied and the result is read as that of a
 * capability that does not limit itself. This cannot happen for the shipped
 * capabilities: they take named arguments, and a named value that is not an
 * integer is refused before the capability runs. A host that brings its own
 * descriptors and takes the limit as a positional value can reach it.
 *
 * @returns `undefined` for a capability that does not cap itself, and for a
 *   limit that is not a finite number.
 */
function resolveSelfCap(
  descriptor: McpCapabilityDescriptor,
  args: McpGenericExecutionArguments
): McpSelfCap | undefined {
  const entry = SELF_CAPPING_CAPABILITIES[descriptor.id];
  if (!entry) {
    return undefined;
  }
  if (entry.argument === undefined) {
    return entry.fixedCap === undefined
      ? undefined
      : {
          capability: descriptor.id,
          cap: entry.fixedCap,
          ...(entry.readOn !== undefined && { readOn: entry.readOn }),
        };
  }
  // the value that the call gets: what the caller sent, else the default of the descriptor
  const valueOf = (name: string): unknown => {
    const parameters = descriptor.parameters ?? [];
    const parameter = parameters.find((candidate) => candidate.name === name);
    const sent = Array.isArray(args.positionalArgs)
      ? parameter
        ? args.positionalArgs[
            parameter.position ?? parameters.indexOf(parameter)
          ]
        : undefined
      : args.namedArgs?.[name];
    return sent ?? parameter?.defaultValue;
  };
  const cap = valueOf(entry.argument);
  if (typeof cap !== 'number' || !Number.isFinite(cap)) {
    return undefined;
  }
  return {
    capability: descriptor.id,
    argument: entry.argument,
    cap,
    ...(entry.readsWholePages && { readsWholePages: true }),
    ...(entry.dedupeArgument !== undefined && {
      dedupe: {
        argument: entry.dedupeArgument,
        on: valueOf(entry.dedupeArgument) !== false,
      },
    }),
  };
}

/**
 * Whether results of this operation type are lists that can be cut.
 */
function isListOperation(operationType: McpCapabilityOperationType): boolean {
  return operationType === 'list' || operationType === 'search';
}

/**
 * Reads a result that the platform pages itself (a CREST paged result): an
 * object with a `result` array and at least one of the paging fields.
 *
 * @returns The items, the cookie that continues the query (when there is
 *   one), the total (`null` when the platform does not say) and the number of
 *   remaining items (`-1` when unknown); `undefined` for any other shape.
 */
function readPagedResult(data: unknown):
  | {
      items: unknown[];
      cookie?: string;
      total: number | null;
      remaining: number;
    }
  | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const candidate = data as Record<string, unknown>;
  if (
    !Array.isArray(candidate.result) ||
    !(
      'pagedResultsCookie' in candidate ||
      'resultCount' in candidate ||
      'totalPagedResults' in candidate
    )
  ) {
    return undefined;
  }
  const { pagedResultsCookie, totalPagedResults, remainingPagedResults } =
    candidate;
  return {
    items: candidate.result,
    ...(typeof pagedResultsCookie === 'string' &&
      pagedResultsCookie.length > 0 && { cookie: pagedResultsCookie }),
    total:
      typeof totalPagedResults === 'number' && totalPagedResults >= 0
        ? totalPagedResults
        : null,
    remaining:
      typeof remainingPagedResults === 'number' ? remainingPagedResults : -1,
  };
}

/**
 * Says whether the data of a list or search result is everything there is.
 *
 * @remarks
 * Knows three shapes: an array (complete unless `truncation` says the runtime
 * cut it or the caller asked for a page that is followed by more), a result
 * that the platform pages (complete unless it carries a cookie or says that
 * results remain), and, for a live cursor, a batch that has no end. Any other
 * shape is left alone: nothing is claimed about a result that cannot be read.
 *
 * @param data The data that is returned (sliced, when it was cut).
 * @param truncation The result of {@link applyResponseSizeLimit}; absent when
 *   no slice was applied, which means the whole array is returned.
 * @param limits The limits that cut one response, named in the warning.
 * @param liveCursor Whether the capability returns a position in a live stream.
 */
function summarizeListResult(
  data: unknown,
  truncation: McpArrayTruncationResult | undefined,
  limits: McpListLimits,
  liveCursor: boolean,
  selfCap?: McpSelfCap
): McpListCompleteness | undefined {
  if (liveCursor) {
    const page = readPagedResult(data);
    const returned = Array.isArray(data) ? data.length : page?.items.length;
    return returned === undefined
      ? undefined
      : {
          returned,
          ...(page?.cookie !== undefined && { nextPageToken: page.cookie }),
        };
  }

  if (Array.isArray(data)) {
    // What the capability returned, before the runtime cut it to a page.
    const returnedByCapability = truncation
      ? truncation.totalCount
      : data.length;
    if (selfCap && returnedByCapability > 0) {
      if (returnedByCapability >= selfCap.cap) {
        // The capability stopped at its own limit: the runtime cannot know how
        // many items there are, only that it may have left some.
        return {
          truncated: true,
          returned: data.length,
          total: null,
          ...(truncation?.hasMore && {
            nextPageOffset: truncation.nextPageOffset,
          }),
          warning: buildSelfCapWarning(
            data.length,
            returnedByCapability,
            truncation,
            selfCap
          ),
        };
      }
      if (selfCap.dedupe?.on) {
        // The limit counts the items before the duplicates were removed, so a
        // count below the limit does not show that the limit was not reached.
        // What the runtime cut itself, it knows.
        const warning = buildDedupeWarning(
          data.length,
          returnedByCapability,
          truncation,
          selfCap
        );
        return truncation?.hasMore
          ? {
              truncated: true,
              returned: data.length,
              total: null,
              nextPageOffset: truncation.nextPageOffset,
              warning,
            }
          : { returned: data.length, warning };
      }
    }
    if (!truncation) {
      return { truncated: false, returned: data.length, total: data.length };
    }
    return {
      truncated: truncation.hasMore,
      returned: truncation.returnedCount,
      total: truncation.totalCount,
      ...(truncation.hasMore && {
        nextPageOffset: truncation.nextPageOffset,
        warning: buildArrayTruncationWarning(truncation, limits),
      }),
    };
  }

  const page = readPagedResult(data);
  if (!page) {
    return undefined;
  }
  const returned = page.items.length;
  const truncated = page.cookie !== undefined || page.remaining > 0;
  return {
    truncated,
    returned,
    total: page.total,
    ...(page.cookie !== undefined && { nextPageToken: page.cookie }),
    ...(truncated && {
      warning: buildPagedTruncationWarning(returned, page.total, page.cookie),
    }),
  };
}

/**
 * The warning of an array result that was cut: how much `data` holds, the
 * limits, and how to read on.
 */
function buildArrayTruncationWarning(
  truncation: McpArrayTruncationResult,
  limits: McpListLimits
): string {
  const { returnedCount, totalCount, nextPageOffset } = truncation;
  return `Result is not complete: data holds ${returnedCount} of ${totalCount} items; the other ${totalCount - returnedCount} are not in this response (size limit ${limits.maxBytes} bytes, at most ${limits.maxItems} items per call). Do not count or search only this page. Pass pageOffset: ${nextPageOffset} to read on (pageSize is the maximum number of items you want), or use a count capability for the exact total.`;
}

/**
 * What the warning of a self-capping capability adds when the runtime also cut
 * the response to a page.
 */
function describeCutOfResponse(
  returned: number,
  returnedByCapability: number,
  truncation: McpArrayTruncationResult | undefined
): string {
  return truncation?.hasMore
    ? ` The response was also cut: data holds ${returned} of the ${returnedByCapability} items that the capability returned. Pass pageOffset: ${truncation.nextPageOffset} to read the rest of them.`
    : '';
}

/**
 * What a warning says about a capability that reads whole pages: it can return
 * more items than its limit, and `returned` is what it returned.
 */
function describeWholePages(selfCap: McpSelfCap, noun: string): string {
  return selfCap.readsWholePages
    ? `; it reads whole pages, so it can return more ${noun} than the limit, and returned says how many it returned`
    : '';
}

/**
 * The warning of an array that a capability returned after it stopped at a
 * limit of its own. It says that more may exist, not that they do, and how to
 * read on.
 */
function buildSelfCapWarning(
  returned: number,
  returnedByCapability: number,
  truncation: McpArrayTruncationResult | undefined,
  selfCap: McpSelfCap
): string {
  const limit =
    selfCap.argument === undefined
      ? `limit of ${selfCap.cap} items`
      : `limit of ${selfCap.cap} items (argument ${selfCap.argument}${describeWholePages(selfCap, 'items')})`;
  const readOn =
    selfCap.argument === undefined
      ? (selfCap.readOn ?? 'Narrow the query to read the rest.')
      : `Raise ${selfCap.argument} or narrow the search to read more.`;
  return `Result is not complete: the capability ${selfCap.capability} stopped at${selfCap.readsWholePages ? ' or after' : ''} its own ${limit}, so more items may exist than it returned. Do not count or search only this result. ${readOn}${describeCutOfResponse(returned, returnedByCapability, truncation)}`;
}

/**
 * The warning of an array from a capability that stops at a limit of its own
 * and removes duplicates afterwards: it says that the result can be
 * incomplete although it holds fewer items than the limit, that the count is
 * not a total, and which argument makes the next result say whether the limit
 * was reached. It promises no certainty: with the duplicates kept the result
 * still only says that the limit was reached, not that nothing was left.
 */
function buildDedupeWarning(
  returned: number,
  returnedByCapability: number,
  truncation: McpArrayTruncationResult | undefined,
  selfCap: McpSelfCap
): string {
  const dedupeArgument = selfCap.dedupe?.argument;
  return `Result may be incomplete: the capability ${selfCap.capability} stops at${selfCap.readsWholePages ? ' or after' : ''} its own limit of ${selfCap.cap} events (argument ${selfCap.argument}${describeWholePages(selfCap, 'events')}), counted before duplicate events are removed (argument ${dedupeArgument}, which is on unless you pass false), so a result can be incomplete even when it has fewer than ${selfCap.argument} events. Do not count or search only this result, and do not use returned as a total. Pass ${dedupeArgument}: false to read a result that says whether the limit was reached.${describeCutOfResponse(returned, returnedByCapability, truncation)}`;
}

/**
 * The warning of a result that the platform pages and that has more pages.
 */
function buildPagedTruncationWarning(
  returned: number,
  total: number | null,
  cookie: string | undefined
): string {
  const holds =
    total === null
      ? `data.result holds ${returned} items and more exist`
      : `data.result holds ${returned} of ${total} items; the other ${total - returned} are not in this response`;
  const readOn =
    cookie !== undefined
      ? 'Pass nextPageToken as pageToken to read on'
      : 'Read on with the paging controls of this capability';
  return `Result is not complete: ${holds}. Do not count or search only this page. ${readOn}, or use a count capability for the exact total.`;
}

/**
 * The `paging` block of `frodo_describe_skill` for a list or search
 * capability: the controls, the fields that say whether a result is complete,
 * and the limits of the runtime. Built from the runtime's own constants so
 * that it is not written out by hand for each capability.
 *
 * @param maxItems The item ceiling of one response.
 * @param maxBytes The byte budget of one response.
 */
function buildPagingGuide(maxItems: number, maxBytes: number) {
  return {
    controls: [...PAGING_CONTROLS],
    resultFields: [...LIST_COMPLETENESS_FIELDS],
    defaultMaxBytes: maxBytes,
    defaultMaxItems: maxItems,
    note: 'A list or search result says whether it is complete in truncated, returned and total, placed before data. The runtime cuts one response of a list to defaultMaxBytes bytes and defaultMaxItems items, and an explicit pageSize does not raise that limit: read on with pageOffset, from nextPageOffset. A result that the platform pages itself has nextPageToken: pass it as pageToken. A semantic count adds up every realm-qualified type of a family; a list reads one type. Compare a list with a count of the same type and filter; total of a list result is that count.',
  };
}

/**
 * Applies a default response-size safety net to array-shaped list/search
 * results before they are serialized back over MCP.
 *
 * @remarks
 * `src/ops/**` has no notion of a caller-specific response ceiling — only the
 * MCP transport does — so this enforcement lives entirely here, never in an
 * ops module (see `McpToolRuntimeOptions.resultWarningThresholdBytes`/
 * `paginationWarningThreshold`, the two existing configurable thresholds this
 * reuses). It is applied by default, not just opt-in: a caller has no way to
 * know in advance that an unfiltered list call will be oversized, so the
 * absence of `pageSize`/`pageOffset` must not mean "no limit" — previously,
 * those args only fed a post-hoc truncation *warning* here; the full array
 * was always serialized regardless of size.
 *
 * Cuts by byte budget first — item sizes vary wildly by domain (a lightweight
 * managed-object summary vs. a full script body with its base64 source,
 * which is what originally broke `script.readScripts` for MCP callers) — with
 * the item-count ceiling as a secondary safety valve. Always includes at
 * least one item past the requested offset even if it alone exceeds the byte
 * budget: a single oversized item is a field-projection problem (see
 * `script.readScriptSource`/`script.listScripts`), not something pagination
 * can fix.
 *
 * @param data Raw method result, prior to any truncation.
 * @param args Generic execution arguments (may carry caller paging hints).
 * @param operationType Capability operation type; only `list`/`search` are
 *   eligible for truncation.
 * @param paginationWarningThreshold Default item-count ceiling (also used as
 *   the fallback page size when the caller didn't request one).
 * @param resultWarningThresholdBytes Byte budget for one page.
 * @returns The (possibly sliced) data to actually return, plus truncation
 *   details when slicing occurred.
 */
function applyResponseSizeLimit(
  data: unknown,
  args: McpGenericExecutionArguments,
  operationType: McpCapabilityOperationType,
  paginationWarningThreshold: number,
  resultWarningThresholdBytes: number
): { data: unknown; truncation?: McpArrayTruncationResult } {
  if (
    !Array.isArray(data) ||
    (operationType !== 'list' && operationType !== 'search')
  ) {
    return { data };
  }

  const requestedOffset =
    args.pageOffset !== undefined && args.pageOffset >= 0 ? args.pageOffset : 0;
  const maxItems =
    args.pageSize !== undefined && args.pageSize > 0
      ? args.pageSize
      : paginationWarningThreshold;

  const window = data.slice(requestedOffset);
  const page: unknown[] = [];
  let bytes = 2; // '[' + ']'
  for (const item of window) {
    if (page.length >= maxItems) {
      break;
    }
    const itemBytes = estimatePayloadSizeBytes(item) ?? 0;
    const separatorBytes = page.length > 0 ? 1 : 0; // ','
    if (
      page.length > 0 &&
      bytes + separatorBytes + itemBytes > resultWarningThresholdBytes
    ) {
      break;
    }
    page.push(item);
    bytes += separatorBytes + itemBytes;
  }

  const returnedCount = page.length;
  const hasMore = requestedOffset + returnedCount < data.length;

  if (!hasMore && requestedOffset === 0 && returnedCount === data.length) {
    return { data };
  }

  return {
    data: page,
    truncation: {
      returnedCount,
      totalCount: data.length,
      hasMore,
      ...(hasMore && { nextPageOffset: requestedOffset + returnedCount }),
    },
  };
}

/**
 * Produces pagination diagnostics for list/search style calls.
 *
 * @param truncation When provided, reflects an actual slice already applied
 *   by {@link applyResponseSizeLimit}.
 * @param listCompleteness What {@link summarizeListResult} made of the data,
 *   when it could read it. For a list that no slice was applied to, and for a
 *   result that the platform pages, it is the truth about whether `data` is
 *   everything: the diagnostics report the same, so that they and the fields
 *   of the result itself never disagree.
 */
function buildPaginationMetadata(
  data: unknown,
  args: McpGenericExecutionArguments,
  operationType: McpCapabilityOperationType,
  truncation?: McpArrayTruncationResult,
  listCompleteness?: McpListCompleteness
): McpExecutionPaginationMetadata | undefined {
  if (!isListOperation(operationType)) {
    return undefined;
  }

  const requested = {
    requestedPageSize: args.pageSize,
    requestedPageOffset: args.pageOffset,
    requestedPageToken: args.pageToken,
    includeTotalRequested: args.includeTotal,
  };

  if (truncation) {
    // a total is reported only where the result itself has one: a capability
    // that stopped at its own limit, and one that cannot tell whether it did
    // (`total` is `null` or absent), have none, and the count of what the
    // capability returned is not one
    const truncated =
      truncation.hasMore || listCompleteness?.truncated === true;
    return {
      isPartial: truncated,
      returnedCount: truncation.returnedCount,
      ...(typeof listCompleteness?.total === 'number' && {
        totalCount: truncation.totalCount,
      }),
      ...requested,
      ...(truncation.hasMore && {
        hasMore: true,
        nextPageOffset: truncation.nextPageOffset,
      }),
      ...(listCompleteness?.warning !== undefined && {
        warning: listCompleteness.warning,
      }),
    };
  }

  if (!Array.isArray(data) && listCompleteness) {
    // a result that the platform pages, or a live cursor
    return {
      isPartial: listCompleteness.truncated === true,
      returnedCount: listCompleteness.returned,
      ...(typeof listCompleteness.total === 'number' && {
        totalCount: listCompleteness.total,
      }),
      ...requested,
      ...(listCompleteness.truncated === true && {
        hasMore: true,
        warning: listCompleteness.warning,
      }),
    };
  }

  // An array that no slice was applied to is complete, however many items that
  // is: the runtime read all of it and kept all of it. Only a capability that
  // stopped at its own limit can say otherwise.
  const selfCapped = listCompleteness?.truncated === true;
  return {
    isPartial: selfCapped,
    returnedCount: Array.isArray(data) ? data.length : undefined,
    ...requested,
    ...(listCompleteness?.warning !== undefined && {
      warning: listCompleteness.warning,
    }),
  };
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
 *
 * @remarks
 * Exported for custom `resolveFrodoForRequest` implementations (see
 * {@link McpToolRuntimeOptions.resolveFrodoForRequest}) that reuse a
 * pre-authenticated singleton `Frodo` instance for performance instead of
 * calling {@link resolveRequestScopedFrodo} on every request: such a
 * resolver still needs to know when `context` carries a realm that differs
 * from the singleton's own, so it can fall back to a genuinely scoped
 * instance for that one call rather than silently ignoring the override.
 */
export function getRealmFromContext(
  context: McpRuntimeRequestContext
): string | undefined {
  switch (context.auth.mode) {
    case 'state-config':
      return context.auth.config.realm;
    case 'service-account':
      return context.auth.realm;
    case 'admin-account':
      return context.auth.realm;
    case 'browser':
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
