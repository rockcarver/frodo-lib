# Frodo Library Migration Guide

This page summarizes the breaking changes and deprecations between major
versions of `@rockcarver/frodo-lib` — everything you need to migrate an
application from one major version to the next without deciphering the full
[changelog](CHANGELOG.md).

Function names link to their API documentation. A function listed here is
gone from (or newly deprecated in) the version(s) named in its section.

---

## Upgrading to 5.x

### From 4.x

**Removals** (completing the v2.0.0/v4.0.0 deprecation sweeps that earlier
releases missed):

- `@rockcarver/frodo-lib` MCP values: `MCP_POLICY_PRESETS`, `applyCapabilityPolicy`, `describeCapabilityRouting`, `rankCapabilitiesForDeployment`, `hydrateMcpDiscoveryContext`, `MCP_AMBIGUOUS_OBJECT_CONCEPTS`, `MCP_SEMANTIC_OBJECT_SYNONYMS`, `descriptorPatternsSupportFamily`, `discoverManagedObjectFamilies`, `matchManagedObjectFamily`, `normalizeSemanticObjectFamily`, `resolveSemanticObjectFamily`, `MCP_SEMANTIC_TERM_SYNONYMS`, `matchSemanticIdentifiers`, `normalizeSemanticIdentifier`, `capabilityMatchesAnyProfile`, `capabilityMatchesDisabled`, `getMcpProfileDefinition`, `listAllMcpProfiles`, `listMcpProfiles`, `resolveMcpProfileSelection`, `FORGEOPS_DOMAIN_PRODUCT_MAP`, `classifyDomainProduct`, `parseAmDocsVersion`, `parseIdmDocsVersion`, `resolveDocsContext`, `buildCapabilityInventory`, `inferObjectType`, `inferOperationType`, `inferRiskClass`, `buildToolManifest`, `createToolRuntime`, `getRealmFromContext`, `resolveRequestScopedFrodo`, `composeCapabilityPolicy`, `createMcpService` — use the corresponding `frodo.mcp` facade member where available (`policyPresets`, `hydrateDiscoveryContext`, `listProfiles`, `resolveProfileSelection`, `buildCapabilityInventory`, `getRealmFromContext`, `resolveRequestScopedFrodo`, `createService`); internal MCP helpers were removed without replacement.
- `@rockcarver/frodo-lib` terminal values: `theme`, `themeForMode`, `resolveThemeMode`, `FRODO_COLOR_THEME_ENV_KEY`, `contrastRatio`, `TerminalContrastFilter` (value), `ALL_ANSI_COLOR_NAMES`, `detectTerminalBackgroundRgb`, `matchBackgroundPreset` — use the corresponding `frodo.utils.terminal` member.
- `@rockcarver/frodo-lib` managed-object-schema values: `buildManagedObjectSchemaPropertyPayload`, `extractManagedObjectSchemaPropertyFields`, `MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES`, `navigatePropertyPath`, `navigateToPropertyContainer`, `parseSubPropertyPath`, `removeSchemaProperty`, `setSchemaProperty`, `buildManagedObjectTypeSchema`, `MANAGED_OBJECT_TYPE_DEFAULT_ICON`, `buildManagedObjectSchemaRelationshipPropertyPayload`, `extractManagedObjectSchemaRelationshipPropertyFields`, `inferManagedObjectSchemaRelationshipReverseIdentity`, `toManagedObjectSchemaRelationshipReverseFields` — use the corresponding `frodo.idm.managed.schema` member.
- `frodo.cloud.variable`: `getVariable`, `getVariables`, `putVariable`, `setVariableDescription` — replaced by `readVariable`, `readVariables`, `createVariable`/`updateVariable`, `updateVariableDescription` (same module)
- `frodo.authn.journey`: `isCustomJourney`, `isPremiumJourney`, `isCloudOnlyJourney`, `getJourneyClassification` — removed without replacement; Frodo no longer classifies journeys as custom/standard/cloud-only/premium (deprecated since 4.0.0). The `JourneyClassificationType` type and `JourneyClassification` enum were removed with them
- `frodo.authn.node`: `isPremiumNode`, `isCloudOnlyNode`, `isCloudExcludedNode`, `isDeprecatedNode`, `isCustomNode`, `getNodeClassification` — removed without replacement; Frodo no longer classifies nodes as standard/custom/cloud/excluded/premium/deprecated (deprecated since 4.0.0). The `NodeClassificationType` type and `NodeClassification` enum were removed with them

**Behavior changes**:

- `frodo.authn.journey.importJourney`, `importJourneys` and
  `frodo.config.importFullConfiguration` now validate journeys before writing
  them. Structural errors (missing node definition, node ID mismatch, missing
  connection target, missing entry node or missing Page Node inner node) reject
  the import; warnings are only reported. `importJourneys` validates the whole
  batch first, so one invalid journey rejects the batch rather than importing a
  subset; for full configuration import, the whole journeys section is
  rejected. To keep the previous behavior, pass `validate: false` in
  `TreeImportOptions`, or `validateJourneys: false` in `FullImportOptions`.
  Exports are unaffected: they report findings as warnings and never block.
- [`frodo.authn.journey.validateJourneys(journeyIds?, journeysExport?)`](https://rockcarver.github.io/frodo-lib/types/Reference.Journey.html#validatejourneys)
  validates journeys from the tenant or from a multi-journey export.

**Deprecation**:

The `@rockcarver/frodo-lib/types/<module>` deep-import subpath is
**deprecated** since 4.12.0: it only resolves under the legacy
`moduleResolution: node` mode (TypeScript 6 deprecates, TypeScript 7
removes). Migrate to root imports — all data-model types are exported from
the root entry:

```
// before (deprecated)
import { type TreeSkeleton } from '@rockcarver/frodo-lib/types/api/TreeApi';

// after
import { type TreeSkeleton } from '@rockcarver/frodo-lib';
```

## Upgrading to 4.x

### From 3.x

**All functions deprecated since v2.0.0 were removed in 4.0.0** (verified
against the runtime surface), with one exception noted below.

- `frodo.admin`: `listOAuth2CustomClients`, `listOAuth2AdminClients`, `listNonOAuth2AdminStaticUserMappings`, `addAutoIdStaticUserMapping`, `grantOAuth2ClientAdminPrivileges`, `revokeOAuth2ClientAdminPrivileges`, `createOAuth2ClientWithAdminPrivileges`, `createLongLivedToken`, `removeStaticUserMapping`, `hideGenericExtensionAttributes`, `showGenericExtensionAttributes`, `repairOrgModel`
- `frodo.login`: `getAccessTokenForServiceAccount` (replaced by `validateServiceAccount` in `frodo.cloud.serviceAccount`, same input and output)
- `frodo.agent`: `getAgents`, `getAgent`, `getAgentByTypeAndId`, `getIdentityGatewayAgents`, `getIdentityGatewayAgent`, `putIdentityGatewayAgent`, `getJavaAgents`, `getJavaAgent`, `putJavaAgent`, `getWebAgents`, `getWebAgent`, `putWebAgent`
- `frodo.saml2.circlesOfTrust`: `getCirclesOfTrust`, `getCircleOfTrust`
- `frodo.email.template`: `getEmailTemplates`, `getEmailTemplate`, `putEmailTemplate`
- `frodo.idm.config`: `getConfigEntityTypes`, `getConfigEntitiesByType`, `getConfigEntity`, `putConfigEntity`, `testConnectorServers`
- `frodo.oauth2oidc.external`: `getSocialIdentityProviders`, `getSocialProvider`, `putProviderByTypeAndId`, `deleteSocialProvider`, `exportSocialProvider`, `exportSocialProviders`, `importSocialProvider`, `importFirstSocialProvider`, `importSocialProviders`
- `frodo.authn.journey`: `getJourneys`, `getJourney`, `importAllJourneys`, `findOrphanedNodes`, `removeOrphanedNodes`
- `frodo.oauth2oidc.client`: `getOAuth2Clients`, `getOAuth2Client`, `putOAuth2Client`
- `frodo.oauth2oidc.provider`: `getOAuth2Provider`
- `frodo.oauth2oidc.issuer`: `getOAuth2TrustedJwtIssuers`, `getOAuth2TrustedJwtIssuer`, `putOAuth2TrustedJwtIssuer`
- `frodo.idm.organization`: `getOrganizations`
- `frodo.authz.policy`: `getPolicies`, `getPoliciesByPolicySet`, `getPolicy`, `putPolicy`
- `frodo.authz.policySet`: `getPolicySets`, `getPolicySet`
- `frodo.realm`: `getRealms`, `getRealmByName`, `putRealm`
- `frodo.authz.resourceType`: `getResourceType`, `getResourceTypes`, `getResourceTypeByName`
- `frodo.saml2.entityProvider`: `getSaml2ProviderStubs`, `getProviderMetadataUrl`, `getProviderMetadata`, `getSaml2ProviderStub`, `getSaml2Provider`
- `frodo.script`: `getScripts`, `getScript`, `getScriptByName`, `putScript`
- `frodo.theme`: `getThemes`, `getTheme`, `getThemeByName`, `putTheme`, `putThemeByName`, `putThemes`
- `frodo.cloud.adminFed`: `getAdminFederationProviders`, `getAdminFederationProvider`, `putProviderByTypeAndId`
- `frodo.cloud.secret`: `getSecrets`, `getSecret`, `putSecret`, `setSecretDescription`, `getSecretVersions`, `createNewVersionOfSecret`, `getVersionOfSecret`, `setStatusOfVersionOfSecret`

Naming pattern: the removed `get*`/`put*` functions were replaced by
`read*`/`update*`/`create*`/`delete*` equivalents on the same module
(e.g. `getJourneys` → `readJourneys`, `putTheme` → `updateTheme`), with the
deprecation notice on each removed function naming its replacement.

**Overlooked in 4.0.0** — the four deprecated `frodo.cloud.variable`
functions and the journey/node classification functions were not removed in
4.0.0; they remained deprecated through the 4.x line and were **removed in
5.0.0** (see "Upgrading to 5.x").

### Node.js version matrix changes in 4.x

- Dropped support for Node.js 18 (and 20 is no longer tested); Node.js 22,
  24, and 26 are tested.

---

## Maintaining This Guide

When a release removes or deprecates a public function:

1. Add the removal to the **target major's** section (e.g. "Upgrading to
   5.x / From 4.x") with the one-line-per-module format: module path,
   comma-separated function names, and the replacement where one exists.
2. Keep the README's _Breaking changes_ section in
   [.github/README.md](.github/README.md) as a short summary that links
   here for the full list.
3. Verify against the runtime before publishing: every listed function
   should actually be absent (or present, for deprecations) in the built
   `dist/`.
