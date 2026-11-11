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

**Root exports** (5.0.0 removes every function and constant from the package
root; these were exported without a deprecation notice in 4.12.0):

- `@rockcarver/frodo-lib` MCP values: `MCP_POLICY_PRESETS`, `applyCapabilityPolicy`, `describeCapabilityRouting`, `rankCapabilitiesForDeployment`, `hydrateMcpDiscoveryContext`, `MCP_AMBIGUOUS_OBJECT_CONCEPTS`, `MCP_SEMANTIC_OBJECT_SYNONYMS`, `descriptorPatternsSupportFamily`, `discoverManagedObjectFamilies`, `matchManagedObjectFamily`, `normalizeSemanticObjectFamily`, `resolveSemanticObjectFamily`, `MCP_SEMANTIC_TERM_SYNONYMS`, `matchSemanticIdentifiers`, `normalizeSemanticIdentifier`, `capabilityMatchesAnyProfile`, `capabilityMatchesDisabled`, `getMcpProfileDefinition`, `listAllMcpProfiles`, `listMcpProfiles`, `resolveMcpProfileSelection`, `FORGEOPS_DOMAIN_PRODUCT_MAP`, `classifyDomainProduct`, `parseAmDocsVersion`, `parseIdmDocsVersion`, `resolveDocsContext`, `buildCapabilityInventory`, `inferObjectType`, `inferOperationType`, `inferRiskClass`, `buildToolManifest`, `createToolRuntime`, `getRealmFromContext`, `resolveRequestScopedFrodo`, `composeCapabilityPolicy`, `createMcpService` — use the corresponding `frodo.mcp` facade member where available (`policyPresets`, `hydrateDiscoveryContext`, `listProfiles`, `resolveProfileSelection`, `buildCapabilityInventory`, `getRealmFromContext`, `resolveRequestScopedFrodo`, `createService`); internal MCP helpers were removed without replacement. To build a service, hydrate, or resolve a request for a specific instance, call the facade member on that instance instead of passing `frodoInstance` or `frodoRoot`: `const instance = frodo.createInstance({ ... }); instance.mcp.createService(options)`, and likewise `instance.mcp.hydrateDiscoveryContext(options)`, `instance.mcp.buildCapabilityInventory(options)`, and `instance.mcp.resolveRequestScopedFrodo(context)`.
- `@rockcarver/frodo-lib` terminal values: `theme`, `themeForMode`, `resolveThemeMode`, `FRODO_COLOR_THEME_ENV_KEY`, `contrastRatio`, `TerminalContrastFilter` (value), `ALL_ANSI_COLOR_NAMES`, `detectTerminalBackgroundRgb`, `matchBackgroundPreset` — use the corresponding `frodo.utils.terminal` member.
- `@rockcarver/frodo-lib` managed-object-schema values: `buildManagedObjectSchemaPropertyPayload`, `extractManagedObjectSchemaPropertyFields`, `MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES`, `navigatePropertyPath`, `navigateToPropertyContainer`, `parseSubPropertyPath`, `removeSchemaProperty`, `setSchemaProperty`, `buildManagedObjectTypeSchema`, `MANAGED_OBJECT_TYPE_DEFAULT_ICON`, `buildManagedObjectSchemaRelationshipPropertyPayload`, `extractManagedObjectSchemaRelationshipPropertyFields`, `inferManagedObjectSchemaRelationshipReverseIdentity`, `toManagedObjectSchemaRelationshipReverseFields` — use the corresponding `frodo.idm.managed.schema` member.

**Removals** (completing the v2.0.0/v4.0.0 deprecation sweeps that earlier
releases missed):

- `frodo.cloud.variable`: `getVariable`, `getVariables`, `putVariable`, `setVariableDescription` — replaced by `readVariable`, `readVariables`, `createVariable`/`updateVariable`, `updateVariableDescription` (same module)
- `frodo.authn.journey`: `isCustomJourney`, `isPremiumJourney`, `isCloudOnlyJourney`, `getJourneyClassification` — removed without replacement; Frodo no longer classifies journeys as custom/standard/cloud-only/premium (deprecated since 4.0.0). The `JourneyClassificationType` type and `JourneyClassification` enum were removed with them
- `frodo.authn.node`: `isPremiumNode`, `isCloudOnlyNode`, `isCloudExcludedNode`, `isDeprecatedNode`, `isCustomNode`, `getNodeClassification` — removed without replacement; Frodo no longer classifies nodes as standard/custom/cloud/excluded/premium/deprecated (deprecated since 4.0.0). The `NodeClassificationType` type and `NodeClassification` enum were removed with them

**Behavior changes**:

- `frodo.mapping.deleteMappings` (`src/ops/MappingOps.ts`) with `connectorId`
  and/or `moType` now deletes only the mappings that belong to them (with both,
  only the mappings that belong to both) and returns only what it deleted.
  Before, it deleted every new-style mapping, reported every legacy mapping as
  deleted, and wrote the new-style mappings back into `sync.json`; with `moType`
  alone it selected nothing. If you relied on the old behavior of deleting
  everything, call `deleteMappings` without a filter. That a mapping which
  cannot be deleted no longer stops the others is described in the entry below.
- `agent list`, `agent export` and `agent delete -a` (`readAgents` and every
  library function that calls it) now skip an unavailable agent type only when
  its request returns HTTP 501. Other per-type request failures are collected
  and thrown in one `FrodoError` naming the failed types after all types have
  been read; previously, they were silently treated as empty lists and the
  command returned the agents from the remaining readable types.
- `frodo.agent.importAgents` (`src/ops/AgentOps.ts`) now treats an agent type
  that answers HTTP 501 as a failed agent, like any other failure. It used to
  skip such an agent without a word: it was neither imported nor reported. After
  every agent was tried, the function now throws one `FrodoError` that carries
  one nested error per failed agent, naming the agent and its type; with the new
  optional `resultCallback` argument, each failed agent is passed to the
  callback and nothing is thrown. A file with such an agent that imported
  without an error before now ends with one: take the agent out of the file, or
  pass a callback and decide what to do with that error.
- `frodo.utils.saveTextToFile` and `frodo.utils.saveJsonToFile`
  (`src/utils/ExportImportUtils.ts`) now return `void` on success instead of
  `true`. Directory-creation and file-write failures throw a `FrodoError`
  naming the file and carrying the original error, rather than printing an
  error and returning `false`. Callers that ignored the result now receive a
  thrown `FrodoError` where they previously received only a printed message
  and no exception. TypeScript callers that test the result no longer compile
  because the functions return `void`. Replace boolean-result checks with
  `try`/`catch`; callers are responsible for reporting or collecting the
  failure. The `ERROR - can't save <file>` line is no longer printed through
  the print handler, so the caller prints the thrown error once.
  `frodo.utils.saveToFile` propagates the same error.
- `frodo.mapping.deleteMappings` (`src/ops/MappingOps.ts`) now tries every
  mapping. A mapping that cannot be deleted no longer stops the others: after
  all of them were tried, the function throws one `FrodoError` that carries one
  nested error per failed mapping, naming it. It used to throw at the first
  failure and leave the later mappings in place, and it reported neither the
  ones already deleted nor the ones it never reached.
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
- `frodo.authn.journey.importJourneys` (`src/ops/JourneyOps.ts`) with a result
  callback no longer rejects the whole batch for an invalid journey or a
  missing dependency. Every journey is an item: the callback gets an imported
  journey as the journey and a failed one as an error that names it, as it
  happens, and the function returns the journeys that were imported. A journey
  that has validation errors, a journey that needs a journey that is neither
  installed nor in the import data, and a journey that needs a journey of the
  batch that failed are reported as failed and are not written; every other
  journey is imported, in the order of its dependencies. Without a callback
  nothing changes: the batch is validated and its dependencies are resolved
  before any journey is written, and a validation error or a missing dependency
  rejects the batch. `frodo.config.importFullConfiguration` imports its journeys
  section this way when it is given a result callback (an invalid journey is
  reported to the callback and no longer rejects the section), and as before
  when it is not.
- A credential that lacks a scope an operation needs (an `InsufficientScopeError`
  anywhere in the error chain) is now a failed item, no longer skipped. The
  shared result helper (`getResult` in `src/utils/ExportImportUtils.ts`) used to
  treat it like the answer "This operation is not available in PingOne Advanced
  Identity Cloud." (HTTP 403): the item was left out of the result without a
  word, nothing was reported to a result callback and nothing was thrown. It now
  fails like any other item. With a result callback, the callback gets an error
  that names the item, with the `InsufficientScopeError` as its cause, and the
  run goes on; without one, the function throws that error at the first such
  item, as it does for every other failure. This reaches every function that
  reports its items through the helper, among them
  `frodo.config.exportFullConfiguration` and `importFullConfiguration`,
  `frodo.am.config.exportAmConfigEntities` and `importAmConfigEntities`,
  `frodo.idm.config.exportConfigEntities`, `frodo.authn.journey.exportJourneys`
  and `importJourneys`, `frodo.script.exportScripts` and the bulk deletes and
  imports of IGA objects. A full configuration export with a credential that
  lacks the scope of one section therefore throws (or, with a callback, reports
  that section as failed) where it used to return the other sections without
  it. The error of the failed item carries the code `INSUFFICIENT_SCOPE`
  (`FrodoError.code`), and so does the `InsufficientScopeError` nested in it, so
  a caller can recognise the condition without parsing the message. The
  answer "not available in PingOne Advanced Identity Cloud" is unchanged, it is
  still skipped without being reported; a debug message now names the skipped
  operation and the request.
- `frodo.cloud.env.promotion`: `promoteConfiguration` now sends its request to
  the promotion endpoint (it used to post to the lock endpoint, so it never
  promoted anything). `lockEnvironment` and `unlockEnvironment` return a
  `LockStatus` (the `LockResponse` type is gone) and can wait for the lock to
  finish (`wait`, `pollInterval`, `timeout`); the `promotionId` of
  `unlockEnvironment` is optional and read from the lock status when left out.
  `promoteConfiguration` and `rollbackPromotion` take the same three optional
  arguments after the config. A wait that fails or times out throws a
  `FrodoError` that carries the original error. In the types, `PromotionStatus`
  is now the union of status names; the former object type is
  `PromotionStatusResponse`.
- `frodo.saml2.entityProvider.deleteSaml2Providers` and `frodo.server.exportServers`
  now try every provider or server before they fail. When any of them fails,
  they still reject with one `FrodoError`, but its `originalErrors` now hold
  one nested error per failed provider or server, each naming its provider
  (entity id) or server (url and id), where the first failure used to end the
  call and the rest were never attempted. `exportServers` returns nothing when
  a server fails, as before; `deleteSaml2Providers` has deleted every provider
  that could be deleted by the time it rejects. The message of the error from
  `exportServers` for a failed server is now `Error exporting servers`; it was
  `Error reading servers`.
- `frodo.idm.connector.readConnectors`, `exportConnectors` and
  `deleteConnectors` now leave out configurations whose id does not start with
  `provisioner.openicf/`, such as `provisioner.openicf.connectorinfoprovider`.
  Before, an export held that configuration under the key "undefined" and
  `deleteConnectors` deleted it (#973).
- The MCP tool runtime (`createToolRuntime`, `frodo.mcp.createService`) passes a
  collecting result callback to every function of the facade that takes a
  `resultCallback`, and its capability descriptors no longer list that
  parameter (it was listed for those that had no `excludeParameters` entry,
  and as a required parameter for `config.exportFullConfiguration` and
  `config.importFullConfiguration`). An MCP caller cannot send a function, so
  since a missing scope is a failed item a bulk call with a scope-limited
  credential used to end with the one error of the first failed item. The tool
  result of a call in which no item failed is unchanged. When at least one
  item failed, the result also has `partial: true` and `itemResults`
  (`succeededCount`, `failedCount`, `failures` with `message`, `code` such as
  `INSUFFICIENT_SCOPE` and `item`, `omittedFailureCount` and a `summary`; at most
  50 failures of at most 1000 characters are listed, without stack and with
  credentials replaced), and `data` holds what the function returned for the
  other items. For a write (an import, a delete) this means that the items that
  can be written are written and the ones that cannot are reported, where the
  functions without a callback reject the batch or stop at the first failed
  item (`importJourneys` validates the whole batch first, `importFullConfiguration`
  stops at the first failed section). A call whose list read fails still
  returns an error. A named-argument call that sends `resultCallback` to a
  capability that takes it as its last parameter is rejected as an unknown
  argument. A host that calls the runtime in process and puts a function at the
  position of the callback keeps it.
- `frodo.oauth2oidc.issuer.deleteOAuth2TrustedJwtIssuer`
  (`src/ops/OAuth2TrustedJwtIssuerOps.ts`) now rejects with a `FrodoError`
  that names the realm and the issuer and carries the original error. Before,
  a failed delete rejected with the raw request error, because the call was not
  awaited inside its `try`. A caller that reads `error.response` of the
  rejection reads `error.httpStatus` (or `error.originalErrors[0].response`)
  now; `isNotFoundError` accepts both. The nested errors of a failed
  `deleteOAuth2TrustedJwtIssuers` are `FrodoError`s that name the issuer in the
  same way.
- `frodo.config.importFullConfiguration` writes a trusted JWT issuer once. An
  issuer that an export holds under both `realm.<realm>.agent` and
  `realm.<realm>.trustedJwtIssuer` (every export of a full configuration since
  4.0.0) used to be written twice, the second write winning, and a failure was
  reported twice. It is now written once from the `trustedJwtIssuer` copy, and
  an issuer that only the `agent` section holds is written through the issuer
  module. Nothing is lost: an export of any earlier layout (issuers under
  `agent`, under `trustedJwtIssuer`, or under both) still imports completely.
  If the two copies differ, the `trustedJwtIssuer` copy is the one that is
  imported, as it was in effect before; an edit made only to the `agent` copy
  is ignored. The Agents step of the import is skipped when the `agent` section
  held nothing but issuers.
- `frodo.oauth2oidc.issuer.importOAuth2TrustedJwtIssuer`,
  `importFirstOAuth2TrustedJwtIssuer` and `importOAuth2TrustedJwtIssuers` also
  read the trusted JWT issuers of the `agent` section of the import data, so an
  `agent export` file of the 4.x line that holds issuers imports through the
  module (the copy in the `trustedJwtIssuer` section wins if both have the same
  id). Their `importData` type is now `OAuth2TrustedJwtIssuerImportData`.

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

`frodo.cloud.serviceAccount.isServiceAccountsFeatureAvailable()` is
**deprecated** since 5.0.0. It answers from the tenant's feature list, which is
not authoritative for service accounts: the admin UI does not consult it
before it shows them, and a failed read of the list is indistinguishable from
a missing feature. Create the service account and handle the error instead.
frodo-cli no longer calls it.

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
