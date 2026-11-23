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

- The JSON and `util.inspect` forms of a `FrodoError` and of the `AxiosError` of
  a request made through the library changed: each is now a summary of the
  error. An `AxiosError` writes its name, message, code, status, method, URL,
  the names of the request headers (the values of the sensitive ones are
  replaced, for example `Authorization: Bearer <redacted>`), the request body,
  and a summary of the response: status, a short list of headers (a header that
  is not on the list is named and its value is `<omitted>`, a URL in a header is
  redacted) and the body, with the sensitive fields of both bodies replaced. A
  `FrodoError` writes its message, combined message, code, HTTP fields,
  transaction id and original errors the same way. `config`, `request` and
  `stack` are no longer in the JSON of an `AxiosError`, and `console.log(error)`
  no longer prints the configuration of the request: read `error.config` when
  you need it. `config`, `request` and `response` of such an error are no longer
  enumerable (`Object.keys`, a spread and `Object.assign` do not copy them) and
  are still readable by name. `getCombinedMessage()` and `toString()` are
  unchanged.
- `frodo.authn.journey.deleteJourney` and `deleteJourneys`: the `error` of the
  status of a journey that could not be deleted is now a `FrodoError` that wraps
  the error of the request (message `Error deleting <realm> realm journey <id>`),
  as everywhere else in the library; it was the error of the request. Read the
  answer of the server with `getFailedResponse(error)` or `error.httpStatus`.
  `frodo.mcp` (`idm.managed.queryManagedObjects`) throws a `FrodoError` that
  wraps the error of the request in the same way.
- The curl command that the debug option `curlirize` prints for a request whose
  body holds an `authId` shows `"authId":"<redacted>"` instead of its value; the
  option that prints secrets keeps printing it. The text of an error is cut
  after its sensitive values are replaced, so a value that the cut would end is
  replaced as a whole. The `getCombinedMessage()` of the view reads only the head
  of the text, so it takes the same time for an error that holds the same error
  many times, and it writes the `Detail:` of an answer the way the view writes a
  body; the text that `getCombinedMessage()` returns is unchanged. A text that
  looks like JSON (it starts like JSON, holds an opening brace or bracket with a
  quote after it, or holds an escaped quote or a unicode escape) is written as
  its structure when it parses and is within 64 KiB, four texts inside texts and
  the budget of the view (512 KiB for all the bodies of one view, or up to 8
  KiB; a text that the view reads twice is read once), with the values of
  sensitive names replaced whatever they are; any other text of that kind is not
  written and is replaced by `<text of N characters not written>`; a text that
  is written with HTML entities or percent escapes, and one that holds an XML
  element or an HTML field of a credential (`<password>`, `type="password"`), is
  read the same way. A text that does not look like JSON is written as before.
  The names of credentials are compared in lower case without hyphens,
  underscores and dots (`accessToken`, `access-token` and `ACCESS_TOKEN` are one
  name); the lists hold `token`, `jwt`, `pwd`, `passwd`, `pass`, `apiKey`,
  `privateKey`, `credentials` and the like (a JSON property named `token` is now
  replaced), and a name that ends in `password`, `passwd`, `pwd`, `secret`,
  `passphrase` or `credentials` is the name of a secret (`dbPassword`,
  `DB_PASSWORD`, `webhookSecret`, `bindCredentials`); the other names are
  compared exactly, with a list of compound names (`passwordConfirmation`,
  `resetToken`, `signingKey`, `otp`, `pin` and the like), so `nextPageToken` and
  `sortKey` stay visible. The names are matched by a list and an ending rule:
  they are not exhaustive. A text is read for such a name before `=`, `:` or
  `=>` (also `user[password]=...`, `user[password][confirm]=...` and
  `--password ...`), and for an XML element of such a name. The value that
  stands beside a name that is one (`{"name":"x-api-key","value":"..."}`; the
  keys that name a field are `name`, `key`, `label`, `id`, `type`, `title` and
  the like, the keys of the value are `value`, `val`, `text`, `data` and the
  like) and the member of a list after one (`["Cookie","..."]`, the flat raw
  headers of a request) are replaced, and so is the base64 text after `Basic`
  when it holds a user name and a password. A message of several lines that
  looks like JSON is one text in the combined message, as it is in `message`;
  after a line that opens JSON or markup, the lines up to the next line that
  starts with a label of the combined message (`Network error:`, `URL:`,
  `Message:` and the others) are not written. The
  password in the user info of a URL in a text goes up to the last at sign of
  its authority (which ends at a slash, `?`, `#`, a backslash, white space, a
  quote, an angle bracket or the scheme of a second URL), so a password that
  holds `, ; | ) ] } &` is replaced as a whole.
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
- `frodo.agent.importAgentGroups` (`src/ops/AgentOps.ts`) now treats an agent
  group type that answers HTTP 501 as a failed agent group, like any other
  failure, as `importAgents` does for agents. It used to skip such a group
  without a word: it was neither imported nor reported. After every group was
  tried, the function now throws one `FrodoError` that carries one nested error
  per failed group, naming the group and its type; with the optional
  `resultCallback` argument, each failed group is passed to the callback and
  nothing is thrown. A file with such a group that imported without an error
  before now ends with one: take the group out of the file, or pass a callback
  and decide what to do with that error.
- `frodo.idm.config.importConfigEntities` (`src/ops/IdmConfigOps.ts`) now tries
  every entity. Without a `resultCallback` it used to stop at the first entity
  that failed, so the entities after it were not written. It now writes the
  others and, after every entity was tried, throws one `FrodoError` (`Error
  importing idm config entities`) that carries one nested error per failed
  entity (`Error importing idm config entity <id>`). The error that a
  `resultCallback` receives for a failed entity is that same error, with the
  former one (`Error updating config entity <id>`, or the invalid script hook
  error) nested in it; a failed entity is still not part of the result. A
  protected entity that PingOne Advanced Identity Cloud refuses (HTTP 403) is
  still skipped without a word for the caller; the debug output now names it
  and the request. A callback that throws for a successful entity is no longer
  called a second time with its own exception: the exception now propagates.
  `importSubConfigEntity` and `removeSubConfigEntity` call it, so their error
  chain has one more nested level.
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
- `frodo.utils.saveJsonToFile` and `frodo.utils.saveToFile` no longer change the
  object they are given. Writing the file used to add the `meta` header to the
  object and to delete `_rev` and the ten modified properties (`lastModifiedBy`,
  `lastModifiedDate`, `modified`, `modifiedDate`, `lastChangeDate`,
  `lastChangedBy`, `lastChanged`, `createdBy`, `creationDate`, `createdDate`)
  from it at every depth, as a side effect. The file is now written from the
  object as it is, and the object is as it was before the call. For data that is
  plain JSON the file is the one it was, with these exceptions. An object that is
  saved more than once used to keep the `meta` header of its first save, so the
  second file had the same `exportDate`; every file now gets a header of its own.
  A later save of the same object that asks to keep `_rev` or the modified
  properties now writes them (the first save had removed them from the object,
  so the second file lacked them). The keys that are left out are now also left
  out of what a `toJSON` method or a getter returns (they were kept there), and
  a frozen object can be saved (it used to fail when a key had to be added or
  removed). Code that used the object after saving it and relied on the removal
  has to remove the keys itself, exact names only:
  `frodo.utils.json.deleteDeepByKey(object, key, true)` for each key (without
  `true` it also removes every key that merely contains the name).
  Code that relied on the added `meta` calls `frodo.utils.getMetadata()`.
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
- `frodo.cloud.env.promotion` and `frodo.cloud.startup`: a call that waits now
  reads the status first. `lockEnvironment`, `unlockEnvironment` and
  `applyUpdates` with `wait` set join an operation that is already under way
  instead of requesting it again: a lock that is locking or locked, an unlock
  that is unlocking or unlocked, a restart that is restarting. The end state is
  the same. `lockEnvironment` then returns the status of the lock that is held,
  in the same shape as a lock of your own and with its `promotionId`; that lock
  may belong to another promotion, so do not assume that you own it.
  `unlockEnvironment` without a `promotionId` still throws when the environment
  holds no lock; pass the id to unlock an environment that may already be
  unlocked. `promoteConfiguration` and `rollbackPromotion` with `wait` set never
  join: when the promotion status is `RUNNING` (a dry run, a real promotion or a
  rollback: the status does not tell them apart while they run) they throw a
  `FrodoError` that names the running operation (status, type, promotion id and
  message), says that nothing was started and sends no request. Every other
  status sends the request and waits as before. Without `wait` none of the five
  functions reads anything first (apart from the read for the promotion id of an
  unlock without an id, which decides nothing) and the request goes out as
  before, so the tenant decides; `applyUpdates` without `wait` still fails
  (returns `false`) while a restart is under way. A status that cannot be read
  first does not end the call: the request is sent as it was before the check. A
  lock or unlock that ends in an error now throws a `FrodoError` whose cause
  carries the text of the status (it carried no cause). This holds without
  `wait` too: when the tenant answers the request itself with the result
  `error`, `lockEnvironment` and `unlockEnvironment` used to return that status
  and now throw, so a caller that tested `result === 'error'` after a call
  without `wait` has to catch the `FrodoError` instead. The standalone
  `applyUpdates` in `StartupOps` takes the optional `pollInterval` and
  `initialDelay`, in milliseconds. The shared helper `waitForUpdate` (not on the
  `frodo` facade) uses the answer of its `initiateUpdate` as the first status:
  complete ends the wait without a check, and fails the call when it also says
  error. Without `wait` an answer that says error fails the call, complete or
  not. With `wait` an answer that says error but not complete is no end: the
  checks go on and the last one decides. An `initiateUpdate` that answers
  nothing counts as not complete.
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
- The MCP tool runtime (`createToolRuntime`, `frodo.mcp.createService`) now
  says in the first fields of a result whether a list or search result is
  complete (a decision in
  https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0025-a-result-that-was-cut-says-so-in-the-first-fields-of-the-result.md,
  a result that was cut says so in the first fields). The result of a list or
  search capability has `truncated`, `returned` and `total` before `data`;
  when `truncated` is `true` it also has `nextPageOffset` (an array result) or
  `nextPageToken` (a result that the platform pages, such as `cloud.log.fetch`
  or `idm.system.querySystemObjects`) and a `warning`. `truncated` is `true`
  whenever items remain beyond `data`: the runtime cut the array to its size
  budget or its item ceiling, the caller asked for a page, or the platform
  returned a cookie. `total` is `null` when the platform does not say.
  `cloud.log.tail`, a live cursor, has `returned` and `nextPageToken` and no
  `truncated`. `cloud.log.searchEvents`, which stops at its own `maxEvents`
  limit (it reads whole pages, so it can return more than its limit; the
  warning says so), and `role.readInternalRoles` and
  `role.queryInternalRoles`, which read one request of at most 1000 items,
  return a plain array; each is
  `truncated` with a `total` of `null` when it returns as many items as its
  limit (it may have left more). `cloud.log.searchEvents` counts its limit
  before it removes duplicate events (`dedupeByTransactionId`, on unless it is
  `false`), so with deduplication a count below the limit proves nothing: the
  result then has `returned` and a `warning` that says so, and no `truncated`
  and no `total` (unless the runtime cut the response itself), and
  `metadata.pagination` has no `totalCount` either, also on the last page of an
  offset read; the warning says not to count the result and not to use
  `returned` as a total, and that `dedupeByTransactionId: false` makes the
  next result say whether the limit was reached.
  `idm.managed.queryManagedObjects` now takes `pageToken` as the cookie of its
  one-page query (it ignored it), so its `nextPageToken` can be passed back.
  `frodo.idm.system.querySystemObjects` and `queryAllSystemObjectIds` now
  encode the characters of a paged-results cookie that are not safe in a query
  string (`+`, `/`, `=`, `&`, a `%` that starts no escape) and add the cookie
  to the request after the URL is formatted; a cookie that IDM has already
  percent-encoded is sent as it came, so the next page of a connector query is
  the same request as before. Before, any other cookie was written into the URL
  as it was, and could end the walk or add a parameter to the request.
  `data` is unchanged, and a result that is not a list, or that the runtime
  cannot read as one, has none of the fields. Before, a cut was reported only
  in `metadata.pagination`. What else changes: the text of
  `metadata.pagination.warning` (the new `warning` has the same text);
  `metadata.pagination.isPartial` is `false` for an array that holds exactly
  the item ceiling and was not cut (it was `true`); a result that the platform
  pages reports `isPartial: true` and `hasMore: true` in `metadata.pagination`
  when it carries a cookie (it was always `false`); `frodo_find_skills` adds
  `executionTruncated: true` and a different `nextAction` when the capability
  that it ran returned a cut result (the `nextAction` also says what to read
  when `total` is `null`); `frodo_describe_skill` returns a `paging` block for
  list and search capabilities; and the descriptions of
  `frodo_dispatch_read_only` and of the list and search capabilities name the
  fields; the description of `frodo_find_skills` says to read on when the answer
  has `executionTruncated`.
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
- The functions of `frodo.oauth2oidc.issuer` no longer modify the objects they
  are given. The imports used to delete `_provider` and `_rev` from the issuer
  objects in the `importData` of the caller, `updateOAuth2TrustedJwtIssuer` and
  `putOAuth2TrustedJwtIssuer` (api layer) from the object they wrote, and the
  retry after "Invalid attribute specified." from its attributes; they work on
  copies now. That retry also names the attributes it removes in one warning (it
  used to say so only in verbose or debug mode). It judges the top-level
  attributes of the issuer, the level at which the server lists the valid ones: it
  leaves out only the ones that the server does not list (never `_id` or
  `_type`) and sends the copy once more. It used to take the members of every
  attribute for attributes, so that it removed `value` and `inherited` of the
  wrapped attributes and `_type.name`, left the unknown attribute in place and
  could not succeed; it no longer takes the elements of an array
  (`allowedSubjects`) for attributes either. When none of the top-level
  attributes is unknown, nothing is sent a second time and the error says which
  attributes the server accepts.
- `frodo.cloud.log`: the Log API is throttled (Ping documents a limit per
  environment, shared by everything that reads its logs, and the answers report
  it in the `X-RateLimit-*` headers), and the functions now say so.
  `tail` and `fetch` return `rateLimit` (`limit`, `remaining`, `resetAt`, in
  milliseconds since 1970) in their page, and so does the tail stream
  (`createLogTailStream().rateLimit`, updated by every poll). A request
  that the API rejects with 429 ends `tail`, `fetch`, `getLogSources` and
  `searchEvents` with a `FrodoError` that has the code `LOG_API_RATE_LIMITED`
  (before, the cause was not recognisable without reading its status) and, if
  the answer carried the headers, `rateLimit`; a caller that keeps a table of
  hints by `FrodoError.code` needs a row for it. `tail` no longer waits and
  sends the request again when the 429 carries `Retry-After`: it returns the
  error at once, and the caller waits until `error.rateLimit.resetAt`.
  `fetch` and `getLogSources` still wait for the end of the window and send the
  request once more, and now also do so where the answer has no `Retry-After`
  but carries `X-RateLimit-Reset`. `searchEvents` no longer waits one second
  between two requests: it spreads the requests it may use over the time left in
  the window, using at most half of the limit that the API reports unless the new
  last parameter `rateLimitShare` (greater than 0, at most 1) says otherwise, so
  a long search on an environment with a limit of 60 per minute takes up to twice
  as long as before and leaves the rest to a running tail. The types of the
  results of `tail` and `fetch` are now `LogEventsPage`
  (`PagedResult<LogEventSkeleton>` plus the optional `rateLimit`).
- `frodo.agent.readAgentTypes`, `readAgents`, `readAgent`, `exportAgents`,
  `exportAgent`, `deleteAgents` and `deleteAgent` (`src/ops/AgentOps.ts`, realm
  level) no longer list, return, export, delete or find agents of the types
  `TrustedJwtIssuer` and `CIMDProfile`, as they never did for `OAuth2Client`.
  Every agent type that has a module of its own is now handled by that module
  alone: trusted JWT issuers by `frodo.oauth2oidc.issuer`
  (`readOAuth2TrustedJwtIssuers`, `exportOAuth2TrustedJwtIssuers`,
  `deleteOAuth2TrustedJwtIssuers`, `importOAuth2TrustedJwtIssuers` and the
  single-issuer functions) and CIMD profiles by `frodo.oauth2oidc.cimd`
  (`readCIMDProfiles`, `exportCIMDProfiles`, `deleteCIMDProfiles`,
  `importCIMDProfiles` and the single-profile functions).
  Before, the generic functions handled every agent type that a realm lists
  except `OAuth2Client`, so an issuer, and a profile of a realm that offers the
  type, was part of their results. Two consequences: `readAgent(id)` and
  `exportAgent(id)` of an issuer or a profile now fail with "not found", and
  `deleteAgents` no longer deletes issuers (they are trust anchors) or profiles;
  use the module to delete them. `readAgentByTypeAndId`, `importAgent` and
  `importAgents` still accept both types. The list of types that have a module
  of their own is the constant `AGENT_TYPES_WITH_OWN_MODULE` in
  `src/ops/AgentOps.ts`. frodo-cli's `agent list`, `agent describe`, `agent
  export` and `agent delete -a` are built on these functions: they stop
  carrying issuers and profiles when the CLI moves to a library version with
  this change, which it does together with its own commands for the two types
  and its own migration entry.
- `frodo.config.exportFullConfiguration` no longer writes trusted JWT issuers
  to `realm.<realm>.agent` (since 4.0.0 it wrote them there as well as to
  `realm.<realm>.trustedJwtIssuer`): they are in `realm.<realm>.trustedJwtIssuer`
  only, the layout of 3.x. It writes CIMD profiles to `realm.<realm>.cimdProfile`
  instead of `realm.<realm>.agent`, and leaves that key out for a realm that has
  no profile or does not offer the type, so an export of such a realm is
  unchanged. `importFullConfiguration` reads both layouts and writes each issuer
  and each profile once, through the module of its type (the profiles as the
  last step of the realm): an export made by an earlier version, with the
  objects in the `agent` section, imports completely, and if both sections hold
  an object with the same id the copy of the module's own section is the one
  written. A realm that does not offer CIMD profiles skips them with one
  warning. An export made by this version is read by an earlier version except
  for its CIMD profiles: that version does not know the key and skips them
  without a message.
- `frodo.agent.readAgentTypes`, `readAgents`, `readAgent`, `exportAgents`,
  `exportAgent`, `deleteAgents` and `deleteAgent` decide whether to leave out
  the Soap STS agent (`SoapSTSAgent`, a classic-only type) from the deployment
  type of the state they are called with, at the time of the call. The facade
  used to add the type to one list shared by the whole process, once for every
  facade created for a deployment other than classic, so the answer for a state
  depended on which other facades existed and when. A classic state now never
  leaves the type out, a state of any other deployment type always does.
- `state.setEnv`, `setEnvs`, `getEnv` and `getEnvs`, the values that replace the
  `${NAME}` placeholders of the configuration a state reads and writes, belong to
  the state. States that did not bring a map of their own used to share one, so a
  value set through one state was seen through every other state, through states
  created later and through the same state after `reset()`. Each state now has a
  map of its own: `createInstance` copies the `env` it is given, and `reset()`
  empties the map. Code that set the values on one state and relied on another
  instance seeing them sets them on that instance, for example
  `frodo.createInstance({ host, env })`.
- `frodo.scriptType.exportScriptTypes` (`src/ops/ScriptTypeOps.ts`) now treats
  a script type whose engine configuration or context cannot be read as a
  failed script type. A missing engine configuration (HTTP 404) is still not a
  failure, but a 404 of the context is. It used to print a line (`Unable to get
  engine configuration for script type '<id>': ...`, or `... context ...`) and
  export the script type without the part it could not read. After every script
  type was tried, the function now throws one `FrodoError` (`Error exporting
  scriptTypes`) that carries one nested error per failed script type (`Error
  exporting script type <id>`, with the failed reads nested in it); a failed
  script type is not in the export. With the new optional `resultCallback`
  argument each failed script type is passed to the callback instead, nothing
  is thrown, and the script types that could be read are exported. In a full
  export (`frodo.config.exportFullConfiguration`) with a result callback, the
  failed script type is reported as an error of its own and the others are
  kept; without one the script types section fails with one error
  (`Error Exporting Script Types`). A full export of a tenant whose script
  type could not be read used to print a line and keep it incomplete.
- `frodo.app.importFirstApplication` and
  `frodo.role.importFirstInternalRole` import the first application or
  role of the import data only, as their names say. The two facade methods
  called `importApplications` and `importInternalRoles` and so imported every
  item of the data, although the functions of the same name in
  `src/ops/ApplicationOps.ts` and `src/ops/InternalRoleOps.ts` always imported
  the first one. The methods still return an array, now with the one imported
  item in it. Callers that relied on the old behaviour call
  `frodo.app.importApplications` or
  `frodo.role.importInternalRoles`. The commands `frodo app import -f`
  and `frodo role import -f` of frodo-cli import the first item of their file
  with these methods, so they import one item once they use a library with this
  change.
- `frodo.utils.json.mergeDeep` (`src/utils/JsonUtils.ts`, also the MCP
  capability `utils.json.mergeDeep` and every library function that merges
  with it) no longer throws or drops a value when the two values of a key are
  of different types: the value of the second object replaces the value of the
  first, whatever the type of either. Before, a number, string or `true` that
  an object or an array with at least one key replaced threw a `TypeError` (an
  empty object or array left the value as it was, without an error), a `null`
  that replaced a value that is not falsy threw one too, a null or undefined
  second argument threw (when the first argument was not falsy), and an object
  or an array that replaced `0`, `''`, `false`, `null` or `undefined` was
  dropped without an error, as was a `null` that replaced `0`, `''`, `false`
  or `undefined`. Now an array replaces an object and an object replaces an
  array (the old result was an array or an object with the keys of both), a
  second argument that is not an object changes nothing, an object without
  prototype or a JSON key named `hasOwnProperty` no longer throws, and an
  object that replaces a function is no longer merged onto the function. The
  key `__proto__` is no longer copied (it used to replace the prototype of the
  result). A `Date`, `RegExp`, `Error`, `Map`, `Set`, `WeakMap`, `WeakSet`,
  `Promise`, `ArrayBuffer`, typed array, `DataView`, `Buffer` or boxed
  primitive is a value, not a bag of keys: it replaces the other value and is
  replaced by it (it used to take the keys of a plain object over it, and to
  be left as it was when it came from the second object). A class instance of
  the first object is no longer changed by a value of another class: a plain
  object or an instance of another class replaces it (it used to be merged
  into it, key by key). What does not change: a class instance in the second
  object merges its own enumerable string keys into a plain object of the
  first (an `AxiosHeaders` instance into the default headers of a factory
  request), two instances of the same class merge, the first object is changed
  and returned, arrays merge by index, a falsy first argument is returned as
  it is, the values of the second object are shared and not copied, and a
  first argument that is truthy and not an object, a frozen first object and a
  property that has only a getter still throw a `TypeError`. Visible through
  the factory: a `proxy` object in the `requestOverride` of
  `frodo.factory.generateAmApi` and the other `generate*Api` methods now takes
  effect (it was dropped over the default `proxy: false`), `proxy: null` now
  becomes `null` (it was dropped; axios leaves its own proxy lookup on for
  `null` and switches it off for `false`), and an `httpsAgent` or `httpAgent`
  override replaces the default agent of that instance, an `Agent` instance
  (it threw) or a plain object (it was merged key by key into the shared
  default agent, which changed it for every later request of the process, the
  verification of certificates included). A caller that relied on one of the
  errors has to check the values first; such callers cannot be counted from
  here.
- `frodo.cloud.feature.readFeatures` (`src/ops/cloud/FeatureOps.ts`) now throws
  a `FrodoError` when the list of features cannot be read, for example HTTP 403
  for a credential without the scope `fr:idc:feature:*`. Before, it returned an
  empty list, so a caller could not tell a tenant without features from a
  credential that may not read them; a failed read is not kept, the next call
  asks again. `frodo.cloud.feature.hasFeature` (and so
  `isServiceAccountsFeatureAvailable`) is unchanged: it still answers `false`
  when the list cannot be read. A caller that wants the old behaviour catches
  the error and uses an empty list.
- `frodo.conn.initConnectionProfiles` (`src/ops/ConnectionProfileOps.ts`) no
  longer contains the migration of the legacy profiles file `~/.frodo/.frodorc`.
  Frodo versions before 0.16.2-11 kept their connection profiles in that file;
  the migration copied it to `Connections.json` and renamed it to
  `.frodorc.deprecated`. Since 2.0.0-30 it checked for `Connections.json` first
  and so could never act for the default profiles file: connection profiles
  that exist only in a `.frodorc` file have not been migrated since then, and
  the code that looked as if it did is removed. A `.frodorc` file is left alone.
  Re-add such connection profiles (`frodo.conn.saveConnectionProfile`, or
  `frodo conn save` of frodo-cli), or copy the file to `Connections.json`
  yourself.
- The MCP capabilities of 17 methods now list the parameters of their
  signature, where their TSDoc had no `@param` tags and their descriptor listed
  none. A call with `namedArgs` was forwarded as ONE object in place of the
  arguments (`idm.script.evaluateScript` received `{ script: "1+1" }` and IDM
  answered "Expecting a java.lang.String but got LinkedHashMap"); it now maps
  every name to its position, like a call with `positionalArgs`, which is
  unchanged. The capabilities are `admin.executeRfc7523AuthZGrantFlow`,
  `admin.generateRfc7523AuthZGrantArtefacts`,
  `admin.generateRfc7523ClientAuthNArtefacts`, `admin.trainAA`,
  `authz.policySet.createPolicySet`, `authz.policySet.deletePolicySet`,
  `cloud.env.readServiceAccountScopes`, `idm.crypto.decrypt`,
  `idm.script.compileScript`, `idm.script.evaluateScript`,
  `idm.system.readSystemStatus`, `oauth2oidc.endpoint.accessToken`,
  `oauth2oidc.endpoint.accessTokenRfc7523AuthZGrant`,
  `oauth2oidc.endpoint.authorize`, `oauth2oidc.endpoint.clientCredentialsGrant`,
  `oauth2oidc.endpoint.deviceAuthorizationRequest` and
  `oauth2oidc.endpoint.getTokenInfo`. Their operation type, risk class,
  `mutating`, `destructive` and the policy presets that expose them are
  unchanged. `cloud.env.readServiceAccountScopes` and
  `idm.system.readSystemStatus` took no arguments at all before (any argument
  was rejected); they now take `flatten` and `systemName`. The parameter of
  `frodo.idm.crypto.decrypt` is named `value` and typed `any` in the facade
  type (it was `script: string`, which the method never used); a call is
  unchanged. `idm.script.evaluateScript` and `idm.script.compileScript` reject a
  `script` that is not a string, for named and positional calls, before the
  call is made.
- The MCP runtime checks `positionalArgs` against the parameters whose schema
  the capability metadata sets explicitly (a value that is `null` or missing is
  skipped), as it already did for `namedArgs`. A schema that is only inferred
  from the declared type of a parameter is still not enforced for a positional
  call.
- `frodo.cloud.log.fetch` takes `cookie`, `txid` and `filter` as optional
  parameters (`cookie?: string`, `txid?: string`, `filter?: string`), and
  `frodo.cloud.log.tail` takes `cookie?: string`. The code already ignored an
  empty value, so a caller that passes `''` is unchanged (unless it also sends
  a `pageToken`, see below); the MCP capabilities no longer reject a call that
  leaves them out, and they accept `null` for them, which counts as left out
  like an empty string. The MCP argument `pageToken` is now the `cookie` of
  these two capabilities (before, it was dropped, because only parameters named
  `pageToken` or `pageCookie` received it): a `cookie` that the caller gave
  wins; a `cookie` that is missing, `null` or empty counts as left out, and
  then `pageToken` is the cookie, unless it is empty too. A call with an empty
  `cookie` and a non-empty `pageToken` now uses the token, where it used the
  empty `cookie` before. This holds for named and for positional calls. The
  same rule fills the `pageCookie` of `idm.system.queryAllSystemObjectIds`,
  `idm.system.querySystemObjects` and `idm.managed.queryManagedObjects` from
  `pageToken`: an empty `pageCookie` and a non-empty `pageToken` now read the
  page of the token. `startTs` and `endTs` stay required.
- The MCP capabilities of 25 methods now list the parameters of their
  signature, by the names of the signature and in its order. Their TSDoc listed
  the parameters in another order, under other names, with a malformed name or
  without one of them, so a call with `namedArgs` reached the wrong positions
  or could not give a parameter; a call with `positionalArgs` is unchanged,
  except for the three named below. A
  `namedArgs` call that gave the old name of a parameter is now rejected as an
  unknown named argument. In another order (the arguments of a named call now
  reach the positions of the signature): `agent.importAgents`,
  `authn.journey.getTreeDescendents`,
  `cloud.adminFed.createAdminFederationProvider`,
  `cloud.iga.certificationTemplate.importCertificationTemplates`,
  `cloud.iga.event.importEvents`, `cloud.iga.glossary.importGlossarySchemas`,
  `cloud.iga.requestForm.importRequestForms`,
  `cloud.iga.requestType.importRequestTypes`,
  `saml2.circlesOfTrust.importCirclesOfTrust` and
  `saml2.entityProvider.updateSaml2Provider`. Under other names:
  `authz.policySet.updatePolicySet` (`importData` is now `policySetData`),
  `idm.mapping.updateSyncMappings` (`mappingData` is now `mappings`) and
  `theme.updateThemes` (`allThemesData` and `realm` are now `themeMap`; the
  method never took a realm). With a malformed name: `idm.crypto.decryptMap`
  and `idm.crypto.encryptMap` (the name was `{{`, it is `map`) and the six
  `idm.managed.schema.{create,remove,update}ManagedObjectSchema{Flat,Relationship}Property`
  capabilities (the optional parameter had brackets in its name, such as
  `[subProperty]`; it is `subProperty`, `reverse` or `withReverse`). With a
  parameter that the TSDoc left out: `authz.policy.exportPolicy` (`options`,
  which is now an argument), and `idm.managed.queryRelatedManagedObjects` and
  `idm.managedSystem.queryManagedSystemObjects` (`pageSize`) and
  `login.getTokens` (`credentialOverride`), which are documented in the TSDoc
  and are not arguments of the capability: the capability does not offer such a
  parameter, and a call that gives it, by name or by position, is rejected
  before the method is called (a `positionalArgs` array that reaches the
  position of the parameter, for these three capabilities; the length of
  `positionalArgs` is still not checked for any other capability). A positional
  call that gave a fifth value to `idm.managed.queryRelatedManagedObjects` or a
  fourth to `idm.managedSystem.queryManagedSystemObjects`, the page size of
  their requests, is rejected now. The `pageSize` argument of a dispatch call
  is what it was: it cuts the result. The operation type, risk class,
  `mutating`, `destructive` and the policy presets of all 25 are unchanged.
- `frodo.admin.generateRfc7523ClientAuthNArtefacts` now waits for the signing
  of the client authentication JWT: `jwt` of its result is the signed token (a
  string), where it was an unresolved promise that serialises as an empty
  object, and its `exp` is five minutes after the call, where it was 300, that
  is seconds since 1970, so the token was expired when it was made. A caller
  that awaited `jwt` gets the same kind of value as before; the property itself
  is no longer a promise.
- `frodo.authn.journey.importJourneys` (`src/ops/JourneyOps.ts`) writes the
  journeys of a batch in the order of their dependencies also when the inner
  journey is already installed in the realm, as its documentation always said.
  It used to treat an installed inner journey as ready at once, so a journey
  that uses it was written in the order of the import data, before the inner
  journey when the data lists the inner journey later. When the installed inner
  journey was disabled or incomplete, AM could refuse to save the journey that
  uses it (HTTP 500, "Could not evaluate tree"), and the inner journey was
  repaired only afterwards. Now a journey that needs another journey of the
  batch is written after it, whether that journey is installed or not, so the
  inner journey is written first, and enabled again when the import data says
  so. A journey that needs a journey that is not in the batch still needs it to
  be installed. Journeys that do not need each other keep the order of the
  import data, and the set of journeys that can be imported does not change: a
  circle of installed journeys and a journey that needs itself are still
  imported, in the order of the import data and after the journeys that could be
  ordered, and a circle of journeys that are not installed is still rejected.
  `frodo.config.importFullConfiguration` imports its journeys section through
  `importJourneys` and gets the same order, and the array `resolvedJourneys`
  that `frodo.authn.journey.resolveDependencies` fills is in that order. The
  module function `resolveInnerTreeDependencies` now shares the ordering code
  and returns the status it documents (an object with `unresolvedJourneys` and
  `resolvedJourneys`). It returned `undefined`, also when journeys stayed
  unresolved, except when the caller passed `index` and no journey could be
  resolved further. Its optional arguments `unresolvedJourneys` and
  `resolvedJourneys` now default to empty ones; leaving them out used to throw.
- With a result callback, `frodo.authn.journey.importJourneys` no longer writes
  a journey whose inner journey of the same batch could not be imported when
  that inner journey is installed. The journey is reported as failed, with an
  error that names the inner journey, as it already was when the inner journey
  is not installed. It used to be written first and reported as imported. The
  rule is the one it was: the journeys are written in the order of their
  dependencies, a journey is skipped when a journey it needs has failed before
  its turn, and an installed journey that cannot be imported because of its own
  dependencies still counts as resolved for the journeys that need it. So in a
  few cascades the journeys that are written differ from before, in either
  direction. Example: installed `A`, `B` and `G`, where `G` needs `E` (new) and
  `A`, `A` needs `B`, and `B` needs a journey that exists nowhere. `G` can be
  written before `A` is judged, and it is now, where it used to be skipped (or
  the other way round, with another order of the import data). A journey that
  cannot be resolved is never written, and the set of journeys that can be
  imported and the journeys reported as unresolved are what they were. A caller
  that depends on the old write order of installed journeys has to order them
  itself.

**Deprecation**:

The `options` parameter of the export and import functions of
`frodo.oauth2oidc.issuer` (`OAuth2TrustedJwtIssuerExportOptions` and
`OAuth2TrustedJwtIssuerImportOptions`) is **deprecated** since 5.0.0: the options
have no effect, a trusted JWT issuer has no scripts. The parameter is kept so
that no caller breaks and will be removed in the next major version.

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

#### One ES module build instead of two

5.0.0 ships one JavaScript build, `dist/index.mjs`, instead of a CommonJS
bundle (`dist/index.js`) and an ES module bundle. `require()`, `import` and
`import()` of `@rockcarver/frodo-lib` all load the same file, so a program that
mixes them now gets one `state` object and one `FrodoError` class (before, each
format had its own copy of both). `package.json` keeps `"type": "commonjs"`, has
no `module` field, and says `"node": ">=22.12"` in `engines`: from Node.js 22.12
on, `require()` loads an ES module without a flag. The reasons are in the
[decision record](https://github.com/rockcarver/frodo-lib/blob/main/decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md).

Still working: `const { frodo, state } = require('@rockcarver/frodo-lib')`,
`FrodoError` (`new`, `extends`, `instanceof`), the `createInstance*` factories,
`require.resolve`, workers and forked processes, `Object.keys`, a spread and
`Object.assign` of the result, patching a member of the facade
(`lib.frodo.login.getTokens = stub`), TypeScript programs (5.4 and later were
checked) under `commonjs`, `node16`, `nodenext` and `bundler` module
resolution (the package ships `index.d.cts` for `require`), ts-node, tsx, and
esbuild bundles. The
`./types/*` deep-import subpath is unchanged.

Four things break:

1. **Jest in CommonJS mode cannot load the real library.** `require()` of the
   package in a test fails with `Must use import to load ES Module`; Jest refuses
   to `require` an ES module file, and no ES-module-only package can change that.
   A `jest.mock('@rockcarver/frodo-lib', () => ({ ... }))` with a factory still
   works, because the real module is never loaded. To use the real library write
   the tests as ES modules and run Jest 30 with
   `NODE_OPTIONS=--experimental-vm-modules` (measured on Node.js 24.9 or later;
   it did not work with Jest 29), or stay on 4.x.
2. **Node.js older than 22.12 cannot `require()` the package.** Node.js 22.0 to
   22.11 and 20.0 to 20.18, and any Node.js started with
   `--no-experimental-require-module`, throw `ERR_REQUIRE_ESM`. Upgrade to
   Node.js 22.12 or later (22.12.0 prints one `ExperimentalWarning` on the first
   `require()`, later versions print nothing), or load the package with
   `import()`, which works on every version.
3. **Clearing `require.cache` no longer resets the library.**
   `delete require.cache[require.resolve('@rockcarver/frodo-lib')]` followed by
   `require()` returns the same module with its `state` kept. To get a fresh
   state create an instance with `frodo.createInstance(...)` (it has a `state`
   of its own), or run the code in a separate process.
4. **The result of `require()` and the namespace of `import` differ in one
   key.** The JavaScript of the package exports a fourth name, `module.exports`
   (the type declarations do not list it, so TypeScript before 5.6 can still
   read them): a plain object that holds `FrodoError`, `frodo` and `state`,
   which is what Node.js returns from `require()` (the module namespace object of an ES module is sealed and
   has no prototype, so `lib.hasOwnProperty('frodo')`, `String(lib)` and
   assigning a top-level member would throw without it). `Object.keys` of
   `await import('@rockcarver/frodo-lib')` now lists `module.exports` next to
   the three names; skip it if you enumerate the keys. Assigning to a member of
   the object that `require()` returns (`lib.frodo = stub`) changes that object
   only, not what `import` callers read; patch a member of the facade instead
   (`lib.frodo.login.getTokens = stub`), which is the same object for everyone.
   The object that `require()` returns also prints differently from the one of
   4.x: `Object.prototype.toString.call(lib)` and `String(lib)` give
   `[object Object]` instead of `[object Module]`, and it has no
   `Symbol.toStringTag` key (its only own keys are the three names).

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
