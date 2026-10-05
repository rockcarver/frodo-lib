import { frodo, state } from './lib/FrodoLib';
import { FrodoError } from './ops/FrodoError';

export * from './mcp';

// Main library exports
export { frodo, FrodoError, state };

// Semantic color-intent theme (dark/light), consumed by frodo-cli and
// available to any other consumer wanting readable colored output without
// hardcoding a hue. See ColorTheme.ts's own doc comments for details.
export {
  theme,
  themeForMode,
  resolveThemeMode,
  FRODO_COLOR_THEME_ENV_KEY,
  type ColorThemeMode,
  type Intent,
} from './utils/ColorTheme';

// Objective, WCAG-based readability checking for the standard 16-color ANSI
// palette, and best-effort actual terminal-background-color detection built
// on top of it -- see TerminalContrast.ts/TerminalBackgroundDetection.ts's
// own doc comments for details.
export {
  contrastRatio,
  TerminalContrastFilter,
  ALL_ANSI_COLOR_NAMES,
  type AnsiColorName,
  type TerminalBackground,
  type Rgb,
} from './utils/TerminalContrast';
export {
  detectTerminalBackgroundRgb,
  matchBackgroundPreset,
  type BackgroundPreset,
} from './utils/TerminalBackgroundDetection';

// Flat (non-relationship) managed-object schema property support -- pure
// helpers and shared types for building/parsing/navigating a property
// definition, reused by consumers (e.g. frodo-cli) that need to preview a
// change before committing it via frodo.idm.managed.schema's orchestration
// functions. See ManagedObjectSchemaOps.ts's own doc comments for details.
export {
  buildManagedObjectSchemaPropertyPayload,
  extractManagedObjectSchemaPropertyFields,
  MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES,
  navigatePropertyPath,
  navigateToPropertyContainer,
  parseSubPropertyPath,
  removeSchemaProperty,
  setSchemaProperty,
  type ManagedObjectSchemaCreatablePropertyType,
  type ManagedObjectSchemaPropertyFields,
  type PropertyContainer,
} from './ops/ManagedObjectSchemaOps';

// Managed-object type-level (title/icon/description) create/update support
// -- pure helpers and shared types, reused the same way as the flat-property
// exports above. See ManagedObjectSchemaOps.ts's own doc comments.
export {
  buildManagedObjectTypeSchema,
  MANAGED_OBJECT_TYPE_DEFAULT_ICON,
  type ManagedObjectTypeFields,
} from './ops/ManagedObjectSchemaOps';

// Relationship-property support -- pure helpers and shared types, reused
// the same way as the flat-property exports above (e.g. so frodo-cli can
// build its own current/proposed preview before committing a change via
// frodo.idm.managed.schema's relationship-property orchestration
// functions). See ManagedObjectSchemaOps.ts's own doc comments.
export {
  buildManagedObjectSchemaRelationshipPropertyPayload,
  extractManagedObjectSchemaRelationshipPropertyFields,
  inferManagedObjectSchemaRelationshipReverseIdentity,
  toManagedObjectSchemaRelationshipReverseFields,
  type ManagedObjectSchemaRelationshipPropertyFields,
  type ManagedObjectSchemaRelationshipReverseFields,
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
