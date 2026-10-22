import { frodo, state } from './lib/FrodoLib';
import * as Mcp from './mcp';
import type { McpCapabilityDescriptor } from './mcp/CapabilityTypes';
import { hydrateMcpDiscoveryContext as hydrateMcpDiscoveryContextForRoot } from './mcp/DiscoveryHydration';
import type { McpDiscoveryHydrationOptions } from './mcp/DiscoveryHydration';
import { createMcpService as createMcpServiceForRoot } from './mcp/McpService';
import type { McpService, McpServiceOptions } from './mcp/McpService';
import type { McpToolManifest } from './mcp/ToolManifest';
import {
  createToolRuntime as createToolRuntimeForRoot,
  resolveRequestScopedFrodo as resolveRequestScopedFrodoForRoot,
} from './mcp/ToolRuntime';
import type {
  McpRuntimeRequestContext,
  McpToolRuntime,
  McpToolRuntimeOptions,
} from './mcp/ToolRuntime';
import { FrodoError } from './ops/FrodoError';
import * as ManagedObjectSchema from './ops/ManagedObjectSchemaOps';
import * as ColorTheme from './utils/ColorTheme';
import * as TerminalBackgroundDetection from './utils/TerminalBackgroundDetection';
import * as TerminalContrast from './utils/TerminalContrast';

/**
 * @deprecated Use the corresponding `frodo.mcp.*` member where available;
 * other MCP internals are not part of the facade.
 */
export * from './mcp';

/** @deprecated Use `frodo.mcp.createService()` instead. */
export function createMcpService(options: McpServiceOptions = {}): McpService {
  const { frodoInstance = frodo, ...serviceOptions } = options;
  return createMcpServiceForRoot(frodoInstance, serviceOptions);
}

/** @deprecated Use `frodo.mcp.hydrateDiscoveryContext()` instead. */
export function hydrateMcpDiscoveryContext(
  options: McpDiscoveryHydrationOptions = {}
) {
  const { frodoInstance = frodo, ...hydrationOptions } = options;
  return hydrateMcpDiscoveryContextForRoot(frodoInstance, hydrationOptions);
}

/** @deprecated Use `frodo.mcp.resolveRequestScopedFrodo()` instead. */
export function resolveRequestScopedFrodo(
  context: McpRuntimeRequestContext,
  frodoRoot = frodo
) {
  return resolveRequestScopedFrodoForRoot(context, frodoRoot);
}

/**
 * @deprecated Internal MCP runtime; use `frodo.mcp.createService()` to
 * construct an MCP service.
 */
export function createToolRuntime(
  manifest: McpToolManifest,
  capabilities: McpCapabilityDescriptor[],
  options: McpToolRuntimeOptions = {}
): McpToolRuntime {
  const { frodoRoot = frodo, ...runtimeOptions } = options;
  return createToolRuntimeForRoot(
    manifest,
    capabilities,
    frodoRoot,
    runtimeOptions
  );
}

/** @deprecated Use `frodo.mcp.policyPresets` instead. */
export const MCP_POLICY_PRESETS = Mcp.MCP_POLICY_PRESETS;
/** @deprecated Internal MCP policy helper. */
export const applyCapabilityPolicy = Mcp.applyCapabilityPolicy;
/** @deprecated Internal MCP routing helper. */
export const describeCapabilityRouting = Mcp.describeCapabilityRouting;
/** @deprecated Internal MCP routing helper. */
export const rankCapabilitiesForDeployment = Mcp.rankCapabilitiesForDeployment;
/** @deprecated Internal MCP semantic helper. */
export const MCP_AMBIGUOUS_OBJECT_CONCEPTS = Mcp.MCP_AMBIGUOUS_OBJECT_CONCEPTS;
/** @deprecated Internal MCP semantic helper. */
export const MCP_SEMANTIC_OBJECT_SYNONYMS = Mcp.MCP_SEMANTIC_OBJECT_SYNONYMS;
/** @deprecated Internal MCP semantic helper. */
export const descriptorPatternsSupportFamily =
  Mcp.descriptorPatternsSupportFamily;
/** @deprecated Internal MCP semantic helper. */
export const discoverManagedObjectFamilies = Mcp.discoverManagedObjectFamilies;
/** @deprecated Internal MCP semantic helper. */
export const matchManagedObjectFamily = Mcp.matchManagedObjectFamily;
/** @deprecated Internal MCP semantic helper. */
export const normalizeSemanticObjectFamily = Mcp.normalizeSemanticObjectFamily;
/** @deprecated Internal MCP semantic helper. */
export const resolveSemanticObjectFamily = Mcp.resolveSemanticObjectFamily;
/** @deprecated Internal MCP semantic helper. */
export const MCP_SEMANTIC_TERM_SYNONYMS = Mcp.MCP_SEMANTIC_TERM_SYNONYMS;
/** @deprecated Internal MCP semantic helper. */
export const matchSemanticIdentifiers = Mcp.matchSemanticIdentifiers;
/** @deprecated Internal MCP semantic helper. */
export const normalizeSemanticIdentifier = Mcp.normalizeSemanticIdentifier;
/** @deprecated Internal MCP profile helper. */
export const capabilityMatchesAnyProfile = Mcp.capabilityMatchesAnyProfile;
/** @deprecated Internal MCP profile helper. */
export const capabilityMatchesDisabled = Mcp.capabilityMatchesDisabled;
/** @deprecated Internal MCP profile helper. */
export const getMcpProfileDefinition = Mcp.getMcpProfileDefinition;
/** @deprecated Internal MCP profile helper. */
export const listAllMcpProfiles = Mcp.listAllMcpProfiles;
/** @deprecated Use `frodo.mcp.listProfiles()` instead. */
export const listMcpProfiles = Mcp.listMcpProfiles;
/** @deprecated Use `frodo.mcp.resolveProfileSelection()` instead. */
export const resolveMcpProfileSelection = Mcp.resolveMcpProfileSelection;
/** @deprecated Internal MCP docs helper. */
export const FORGEOPS_DOMAIN_PRODUCT_MAP = Mcp.FORGEOPS_DOMAIN_PRODUCT_MAP;
/** @deprecated Internal MCP docs helper. */
export const classifyDomainProduct = Mcp.classifyDomainProduct;
/** @deprecated Internal MCP docs helper. */
export const parseAmDocsVersion = Mcp.parseAmDocsVersion;
/** @deprecated Internal MCP docs helper. */
export const parseIdmDocsVersion = Mcp.parseIdmDocsVersion;
/** @deprecated Internal MCP docs helper. */
export const resolveDocsContext = Mcp.resolveDocsContext;
/** @deprecated Use `frodo.mcp.buildCapabilityInventory()` instead. */
export const buildCapabilityInventory = Mcp.buildCapabilityInventory;
/** @deprecated Internal MCP capability helper. */
export const inferObjectType = Mcp.inferObjectType;
/** @deprecated Internal MCP capability helper. */
export const inferOperationType = Mcp.inferOperationType;
/** @deprecated Internal MCP capability helper. */
export const inferRiskClass = Mcp.inferRiskClass;
/** @deprecated Internal MCP manifest helper. */
export const buildToolManifest = Mcp.buildToolManifest;
/** @deprecated Use `frodo.mcp.getRealmFromContext()` instead. */
export const getRealmFromContext = Mcp.getRealmFromContext;
/** @deprecated Internal MCP service helper. */
export const composeCapabilityPolicy = Mcp.composeCapabilityPolicy;

// Main library exports
export { frodo, FrodoError, state };

// Semantic color-intent theme (dark/light), consumed by frodo-cli and
// available to any other consumer wanting readable colored output without
// hardcoding a hue. See ColorTheme.ts's own doc comments for details.
/** @deprecated Use `frodo.utils.terminal.theme()` instead. */
export const theme = ColorTheme.theme;
/** @deprecated Use `frodo.utils.terminal.themeForMode()` instead. */
export const themeForMode = ColorTheme.themeForMode;
/** @deprecated Use `frodo.utils.terminal.resolveThemeMode()` instead. */
export const resolveThemeMode = ColorTheme.resolveThemeMode;
/** @deprecated Use `frodo.utils.terminal.FRODO_COLOR_THEME_ENV_KEY` instead. */
export const FRODO_COLOR_THEME_ENV_KEY = ColorTheme.FRODO_COLOR_THEME_ENV_KEY;
export type { ColorThemeMode, Intent } from './utils/ColorTheme';

// Objective, WCAG-based readability checking for the standard 16-color ANSI
// palette, and best-effort actual terminal-background-color detection built
// on top of it -- see TerminalContrast.ts/TerminalBackgroundDetection.ts's
// own doc comments for details.
/** @deprecated Use `frodo.utils.terminal.contrastRatio()` instead. */
export const contrastRatio = TerminalContrast.contrastRatio;
/** @deprecated Use `frodo.utils.terminal.TerminalContrastFilter` instead. */
export const TerminalContrastFilter = TerminalContrast.TerminalContrastFilter;
/** @deprecated Use `frodo.utils.terminal.TerminalContrastFilter` instead. */
export type TerminalContrastFilter = TerminalContrast.TerminalContrastFilter;
/** @deprecated Use `frodo.utils.terminal.ALL_ANSI_COLOR_NAMES` instead. */
export const ALL_ANSI_COLOR_NAMES = TerminalContrast.ALL_ANSI_COLOR_NAMES;
export type {
  AnsiColorName,
  TerminalBackground,
  Rgb,
} from './utils/TerminalContrast';
/** @deprecated Use `frodo.utils.terminal.detectTerminalBackgroundRgb()` instead. */
export const detectTerminalBackgroundRgb =
  TerminalBackgroundDetection.detectTerminalBackgroundRgb;
/** @deprecated Use `frodo.utils.terminal.matchBackgroundPreset()` instead. */
export const matchBackgroundPreset =
  TerminalBackgroundDetection.matchBackgroundPreset;
export type { BackgroundPreset } from './utils/TerminalBackgroundDetection';

// Flat (non-relationship) managed-object schema property support -- pure
// helpers and shared types for building/parsing/navigating a property
// definition, reused by consumers (e.g. frodo-cli) that need to preview a
// change before committing it via frodo.idm.managed.schema's orchestration
// functions. See ManagedObjectSchemaOps.ts's own doc comments for details.
/** @deprecated Use `frodo.idm.managed.schema.buildManagedObjectSchemaPropertyPayload()` instead. */
export const buildManagedObjectSchemaPropertyPayload =
  ManagedObjectSchema.buildManagedObjectSchemaPropertyPayload;
/** @deprecated Use `frodo.idm.managed.schema.extractManagedObjectSchemaPropertyFields()` instead. */
export const extractManagedObjectSchemaPropertyFields =
  ManagedObjectSchema.extractManagedObjectSchemaPropertyFields;
/** @deprecated Use `frodo.idm.managed.schema.MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES` instead. */
export const MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES =
  ManagedObjectSchema.MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES;
/** @deprecated Use `frodo.idm.managed.schema.navigatePropertyPath()` instead. */
export const navigatePropertyPath = ManagedObjectSchema.navigatePropertyPath;
/** @deprecated Use `frodo.idm.managed.schema.navigateToPropertyContainer()` instead. */
export const navigateToPropertyContainer =
  ManagedObjectSchema.navigateToPropertyContainer;
/** @deprecated Use `frodo.idm.managed.schema.parseSubPropertyPath()` instead. */
export const parseSubPropertyPath = ManagedObjectSchema.parseSubPropertyPath;
/** @deprecated Use `frodo.idm.managed.schema.removeSchemaProperty()` instead. */
export const removeSchemaProperty = ManagedObjectSchema.removeSchemaProperty;
/** @deprecated Use `frodo.idm.managed.schema.setSchemaProperty()` instead. */
export const setSchemaProperty = ManagedObjectSchema.setSchemaProperty;
export type {
  ManagedObjectSchemaCreatablePropertyType,
  ManagedObjectSchemaPropertyFields,
  PropertyContainer,
} from './ops/ManagedObjectSchemaOps';

// Managed-object type-level (title/icon/description) create/update support
// -- pure helpers and shared types, reused the same way as the flat-property
// exports above. See ManagedObjectSchemaOps.ts's own doc comments.
/** @deprecated Use `frodo.idm.managed.schema.buildManagedObjectTypeSchema()` instead. */
export const buildManagedObjectTypeSchema =
  ManagedObjectSchema.buildManagedObjectTypeSchema;
/** @deprecated Use `frodo.idm.managed.schema.MANAGED_OBJECT_TYPE_DEFAULT_ICON` instead. */
export const MANAGED_OBJECT_TYPE_DEFAULT_ICON =
  ManagedObjectSchema.MANAGED_OBJECT_TYPE_DEFAULT_ICON;
export type { ManagedObjectTypeFields } from './ops/ManagedObjectSchemaOps';

// Relationship-property support -- pure helpers and shared types, reused
// the same way as the flat-property exports above (e.g. so frodo-cli can
// build its own current/proposed preview before committing a change via
// frodo.idm.managed.schema's relationship-property orchestration
// functions). See ManagedObjectSchemaOps.ts's own doc comments.
/** @deprecated Use `frodo.idm.managed.schema.buildManagedObjectSchemaRelationshipPropertyPayload()` instead. */
export const buildManagedObjectSchemaRelationshipPropertyPayload =
  ManagedObjectSchema.buildManagedObjectSchemaRelationshipPropertyPayload;
/** @deprecated Use `frodo.idm.managed.schema.extractManagedObjectSchemaRelationshipPropertyFields()` instead. */
export const extractManagedObjectSchemaRelationshipPropertyFields =
  ManagedObjectSchema.extractManagedObjectSchemaRelationshipPropertyFields;
/** @deprecated Use `frodo.idm.managed.schema.inferManagedObjectSchemaRelationshipReverseIdentity()` instead. */
export const inferManagedObjectSchemaRelationshipReverseIdentity =
  ManagedObjectSchema.inferManagedObjectSchemaRelationshipReverseIdentity;
/** @deprecated Use `frodo.idm.managed.schema.toManagedObjectSchemaRelationshipReverseFields()` instead. */
export const toManagedObjectSchemaRelationshipReverseFields =
  ManagedObjectSchema.toManagedObjectSchemaRelationshipReverseFields;
export type {
  ManagedObjectSchemaRelationshipPropertyFields,
  ManagedObjectSchemaRelationshipReverseFields,
} from './ops/ManagedObjectSchemaOps';

// ---- Data-model / export-option types consumed by frodo-cli -----------------
// These were previously reachable only via the `@rockcarver/frodo-lib/types/*`
// deep-import subpath, which only resolves under the deprecated node10
// moduleResolution (deprecated in TS 6.0, removed in TS 7.0) - see the 4.10.0
// types incident. Re-exported here so the root entry is the complete public
// type surface; the ./types/* subpath is now redundant (deprecated in 4.12.0,
// removed in 5.0.0). Grouped by source module, sorted by name.

export type { AgentType } from './api/AgentApi';

export type {
  IdObjectSkeletonInterface,
  Readable,
  Writable,
} from './api/ApiTypes';

export type { RetryStrategy } from './api/BaseApi';

export type { CircleOfTrustSkeleton } from './api/CirclesOfTrustApi';

export type { ManagedObjectSchema } from './api/ManagedObjectApi';

export type {
  CustomNodeSkeleton,
  CustomNodeUsage,
  InnerNodeRefSkeletonInterface,
  NodeRefSkeletonInterface,
  NodeSkeleton,
} from './api/NodeApi';

export type { OAuth2ClientSkeleton } from './api/OAuth2ClientApi';

export type { AccessTokenResponseType } from './api/OAuth2OIDCApi';

export type { OAuth2TrustedJwtIssuerSkeleton } from './api/OAuth2TrustedJwtIssuerApi';

export type { PolicySkeleton } from './api/PoliciesApi';

export type { PolicySetSkeleton } from './api/PolicySetApi';

export type { ResourceTypeSkeleton } from './api/ResourceTypesApi';

export type { Saml2ProviderSkeleton } from './api/Saml2Api';

export type { ScriptSkeleton } from './api/ScriptApi';

export type { SecretStoreMappingSkeleton } from './api/SecretStoreApi';

export type { FullService, ServiceNextDescendent } from './api/ServiceApi';

export type { SocialIdpSkeleton } from './api/SocialIdentityProvidersApi';

export type { TreeSkeleton } from './api/TreeApi';

export type {
  JourneyValidationCode,
  JourneyValidationFinding,
  JourneyValidationInput,
  JourneyValidationSeverity,
} from './utils/JourneyValidationUtils';

export type { ContentSecurityPolicy } from './api/cloud/EnvContentSecurityPolicyApi';

export type { DirectConfigurationSessionState } from './api/cloud/EnvDirectConfigurationSessionApi';

export type {
  LogApiKey,
  LogEventPayloadSkeleton,
  LogEventSkeleton,
} from './api/cloud/LogApi';

export type {
  SecretEncodingType,
  SecretSkeleton,
  VersionOfSecretSkeleton,
} from './api/cloud/SecretsApi';

export type {
  LogExporterSkeleton,
  TelemetryExporterCategory,
} from './api/cloud/TelemetryApi';

export type {
  VariableExpressionType,
  VariableSkeleton,
} from './api/cloud/VariablesApi';

export type {
  ApprovalTask,
  ScriptTask,
  WorkflowExpression,
} from './api/cloud/iga/IgaWorkflowApi';

export type { McpProfileName } from './mcp/ProfileRegistry';

export type { AgentExportInterface } from './ops/AgentOps';

export type {
  ApplicationExportInterface,
  ApplicationExportOptions,
  ApplicationImportOptions,
} from './ops/ApplicationOps';

export type { BrowserLoginOptions, Tokens } from './ops/AuthenticateOps';

export type { AuthenticationSettingsExportInterface } from './ops/AuthenticationSettingsOps';

export type {
  BrowserLoginPrompt,
  BrowserLoginPromptHandler,
} from './ops/BrowserAuthenticateOps';

export type { Callback, CallbackHandler } from './ops/CallbackOps';

export type { CirclesOfTrustExportInterface } from './ops/CirclesOfTrustOps';

export type {
  FullExportInterface,
  FullExportOptions,
  FullGlobalExportInterface,
  FullImportOptions,
  FullRealmExportInterface,
} from './ops/ConfigOps';

export type { ConnectionProfileInterface } from './ops/ConnectionProfileOps';

export type { ConnectorSkeleton } from './ops/ConnectorOps';

export type { EmailTemplateSkeleton } from './ops/EmailTemplateOps';

export type { ConfigEntityExportInterface } from './ops/IdmConfigOps';

export type { SocialIdentityProviderImportOptions } from './ops/IdpOps';

export type { InternalRoleExportInterface } from './ops/InternalRoleOps';

export type { JwkRsa, JwksInterface } from './ops/JoseOps';

export type {
  DeleteJourneysStatus,
  MultiTreeExportInterface,
  SingleTreeExportInterface,
  TreeDependencyMapInterface,
  TreeExportOptions,
  TreeExportResolverInterface,
  TreeImportOptions,
} from './ops/JourneyOps';

export type { ResolvedIdentity } from './ops/ManagedObjectOps';

export type {
  MappingExportInterface,
  MappingExportOptions,
  MappingImportOptions,
  MappingSkeleton,
  SyncSkeleton,
} from './ops/MappingOps';

export type {
  CustomNodeExportInterface,
  CustomNodeExportOptions,
  CustomNodeImportOptions,
} from './ops/NodeOps';

export type {
  OAuth2ClientExportInterface,
  OAuth2ClientExportOptions,
  OAuth2ClientImportOptions,
} from './ops/OAuth2ClientOps';

export type { AccessTokenMetaType } from './ops/OAuth2OidcOps';

export type { ExportMetaData } from './ops/OpsTypes';

export type {
  PolicyExportInterface,
  PolicyExportOptions,
  PolicyImportOptions,
} from './ops/PolicyOps';

export type {
  PolicySetExportInterface,
  PolicySetExportOptions,
  PolicySetImportOptions,
} from './ops/PolicySetOps';

export type { RealmExportInterface } from './ops/RealmOps';

export type { ResourceTypeExportInterface } from './ops/ResourceTypeOps';

export type {
  Saml2EntitiesExportOptions,
  Saml2EntitiesImportOptions,
  Saml2ExportInterface,
} from './ops/Saml2Ops';

export type {
  ScriptExportInterface,
  ScriptExportOptions,
  ScriptImportOptions,
} from './ops/ScriptOps';

export type {
  ServiceExportInterface,
  ServiceImportOptions,
} from './ops/ServiceOps';

export type { ThemeExportInterface, ThemeSkeleton } from './ops/ThemeOps';

export type { CachedSessionSummary } from './ops/TokenCacheOps';

export type {
  ServerExportInterface,
  ServerExportOptions,
  ServerExportSkeleton,
  ServerImportOptions,
} from './ops/classic/ServerOps';

export type { LogTailStream } from './ops/cloud/LogOps';

export type { SecretsExportInterface } from './ops/cloud/SecretsOps';

export type { TelemetryExportInterface } from './ops/cloud/TelemetryOps';

export type { VariablesExportInterface } from './ops/cloud/VariablesOps';

export type {
  WorkflowExportInterface,
  WorkflowExportOptions,
  WorkflowGroup,
  WorkflowImportOptions,
} from './ops/cloud/iga/IgaWorkflowOps';

export type {
  ProgressIndicatorStatusType,
  ProgressIndicatorType,
} from './utils/Console';
