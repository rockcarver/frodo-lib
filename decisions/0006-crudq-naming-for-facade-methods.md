---
status: accepted
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/ops/**
  - src/utils/**
  - src/lib/FrodoLib.ts
---

# Facade methods follow the CRUDQ naming convention

## Context and problem statement

Most of frodo-lib manipulates configuration objects of a Ping Identity Platform instance. Library users, the generated help and the MCP capability registry (which infers an operation type from the method name prefix, 0001) all depend on predictable names. The convention is in `CONTRIBUTE.md` ("Managing objects - CRUDQ", "Managing properties", "Managing status", "Everything else"); it is stated here once, with its meaning and how well the code follows it. Measured on `main` (42632f3cd, 2026-10-24) from the 844 public methods in the generated `Help.ts`.

## Decision

The names of methods on the `frodo` facade (the public type of every ops and utils module):

| Action | Rule |
| - | - |
| `create` | Create an object. Fails if the object already exists. |
| `read` | Read one object (`readJourney`) or all objects of a kind (`readJourneys`). |
| `update` | Update an object if it exists, create it otherwise. |
| `delete` | Delete one object or all objects of a kind. |
| `query` | Query objects. |
| `export`, `import` | Export or import one or all objects of a kind. |
| `get`, `set` | Retrieve or set one individual property of an object (`getJourneyDescription`). |
| `enable`, `disable` | Status of a configuration. Avoid getters and setters for status. |
| anything else | A meaningful name, as long as it conveys the purpose. |

`count`, `list` and `search` are accepted for counting, listing and searching; the capability registry infers them (lib record 0001) although the `CONTRIBUTE.md` tables do not list them.

## Consequences

Measured conformance of the 844 facade methods (92 types). Of these, 210 (24.9%) are "special" to the capability registry (every `get`, `set`, `enable`, `disable` and the 154 other names) and each has a reviewed entry: the test passes and `contract-gap-baseline.json` is `[]`, which is lib record 0001 followed to the letter.

| Group | Methods | Share |
| - | - | - |
| CRUDQ (`create` 80, `read` 182, `update` 72, `delete` 102, `query` 8) | 444 | 52.6% |
| `export` 95, `import` 86 | 181 | 21.4% |
| `get` 51, `set` 1 | 52 | 6.2% |
| `enable` 3, `disable` 2 | 5 | 0.6% |
| `count` 4, `list` 3, `search` 1 | 8 | 0.9% |
| everything else (`generate` 11, `is` 11, `remove` 10, `save` 8, `validate` 7, `resolve` 7, `find` 6, `has` 6, `add` 5, `convert` 5 and 60 other leading words) | 154 | 18.2% |

81.8% of the names use the convention's vocabulary. "Everything else" is allowed, but each of those methods needs a reviewed entry in the capability metadata (lib record 0001), which a zero-tolerance test enforces. The semantics ("create fails if the object exists", "update creates it") are not measured; no test checks them across modules.

## Known deviations

Names that contradict what the convention says, found by reading the 154 "everything else" names and the 52 `get`/`set` names. The list is a starting point for review, not a verdict.

- **`get` retrieves a whole object or a collection, where the convention says `read`** (11): `ConnectionProfile.getConnectionProfile`, `getConnectionProfileByHost`, `getAdditionalServiceAccount`; `ServiceAccount.getServiceAccount`; `Log.getLogApiKey`, `getLogApiKeys`, `getLogSources`; `Saml2.getSaml2ProviderMetadata`; `Session.getSessionInfo`; `OAuth2Oidc.getTokenInfo`; `Info.getInfo`. The other 40 `get` names compute a value, a path or a name (`getFilePath`, `getRealmName`, `getVersion`) and are fine. `Service.getFullServices` and `getListOfServices` read all objects of a kind; the registry accepts `getListOf*` and `getFull*` as list names (lib record 0001), but `CONTRIBUTE.md` does not, so they count as an undocumented legacy form.
- **`remove` deletes an object, where the convention says `delete`** (4 of 10): `ManagedObjectSchemaOps.removeManagedObjectType`, `ConnectionProfile.removeAdditionalServiceAccount`, `Realm.removeCustomDomain`, `IdmConfig.removeSubConfigEntity`. The other six remove a property or an association (`removeRelationship` in two modules, three schema properties, `removeOrphanedNodes`); the convention is silent on them. A comment in `CapabilityRegistry.test.ts` calls this "the codebase's own remove*-not-delete* convention", but no document states it. Either the convention gains a line (an object is deleted, a property or association is removed) or the four object-level names change.
- **`add` creates an object** (3 of 5): `ConnectionProfile.addNewServiceAccount`, `addAdditionalServiceAccount`, `Realm.addCustomDomain`. `addRelationship` (two modules) is an association.
- **`save` where `update` fits** (1): `ConnectionProfile.saveConnectionProfile` creates or replaces a profile, which is the documented meaning of `update`. The other `save` names write token cache entries or files and are fine.
### Remediation
Direction only; not scheduled. A rename is breaking for library users and the CLI: add the new name, keep the old one as a deprecated alias, list it in `MIGRATION.md`, update `CapabilityMetadata.ts` and `Help.ts`, remove the alias in the next major. S for each rename, M for the 19 together. The two `Ops`-suffixed public types (`ManagedObjectSchemaOps`, `ManagedSystemObjectSchemaOps`) and the missing `list`, `count`, `search` and `getListOf*` rows in the `CONTRIBUTE.md` tables are S.
