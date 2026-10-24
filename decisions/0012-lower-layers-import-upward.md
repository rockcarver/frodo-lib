---
status: deprecated
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/api/**
  - src/shared/**
  - src/utils/**
  - src/ops/FrodoError.ts
  - src/ops/OpsTypes.ts
---

# The foundation and the api layer import from ops (deprecated)

## Context and problem statement

Record 0004 says imports point downward: `ops` may use `api`, `shared` and `utils`, never the other way round. In the code, 34 of 1,278 import edges go upward: 17 value imports, 13 type-only imports and 4 dynamic imports. Most exist because a shared building block (`FrodoError`, `OpsTypes`, a constant, a type) was written in the ops or api layer and a lower layer later needed it. Counting type-only imports, 48 files form one strongly connected group of imports (`State`, `BaseApi`, `FrodoError`, `AuthenticateOps` and their neighbours); counting only the imports that run, the largest cycle has 10 files (`IdmConfigApi`, `ManagedSystemObjectApi`, `RealmApi`, `VariablesApi`, `EmailTemplateOps`, `IdmConfigOps`, `RealmOps`, `VariablesOps`, `ExportImportUtils`, `ForgeRockUtils`) and four smaller ones (4, 3, 3 and 2 files). A runtime cycle has already caused a failure: jest 30.5 exposed the `FrodoLib` and `SecretsOps` cycle at module initialisation, fixed in #670 with a dynamic import, which is why `SecretsOps` still imports the facade four times. Measured on `main` (42632f3cd, 2026-10-24).

## Decision

The upward imports listed below are deprecated and not extended. New code does not add one; a shared piece a lower layer needs is moved down instead. Type-only imports count as well.

### Evidence

| Edge | Count (value / type / dynamic) | Imports |
| - | - | - |
| api to ops | 6 (5 / 1 / 0) | `FrodoError` (from `AmConfigApi`, `BaseApi`, `ManagedSystemObjectApi`); `BaseApi` to `RequiredScopesOps`; `AuthenticateApi` to `CallbackOps` (type); `IdmConfigApi` to `EmailTemplateOps` (a constant) |
| shared to api | 3 (0 / 3 / 0) | `State` to `BaseApi` and `FeatureApi`; `Constants` to `IgaGlossaryApi` |
| shared to ops | 5 (0 / 5 / 0) | `State` to `AuthenticateOps`, `CallerTrustTierOps`, `FrodoError`, `JoseOps`, `OAuth2OidcOps` |
| utils to api | 4 (1 / 3 / 0) | `ExportImportUtils` to `ApiTypes`, `BaseApi`, `VariablesApi`; `ScriptValidationUtils` to `ScriptApi` |
| utils to ops | 9 (8 / 1 / 0) | `ExportImportUtils` to `VariablesOps`, `EmailTemplateOps`, `FrodoError`, `OpsTypes`, `RequiredScopesOps`; `ForgeRockUtils` to `RealmOps`; `CryptoUtils` and `JwtUtils` to `FrodoError`; `AutoSetupPolly` to `AuthenticateOps` |
| ops to the facade or package root | 5 (1 / 0 / 4) | `SecretsOps` to `FrodoLib` (4, dynamic), `WSFedOps` to `index.ts` |
| utils to the package root or generated help | 2 (2 / 0 / 0) | `AutoSetupPolly` to `index.ts`; `HelpUtils` to `lib/Help.ts` |

- `FrodoError` sits in `src/ops/` and is the package's public error type; it is imported by api, shared and utils, which is the largest single cause.
- All eight edges from `shared` to `api` and `ops` are type-only: `State.ts` imports the shapes it stores (`UserSessionMetaType`, `AccessTokenMetaType`, `JwkRsa`, `CallerTrustTierResolver`, `FeatureInterface`, `RetryStrategy`) and `FrodoError` from the layers that define them. Its comments show that the authors work around the direction with hooks ("`BaseApi` must never import `AuthenticateOps`").

## Consequences

- No tool enforces the direction, so the count can grow unnoticed.
- The 10-file runtime cycle makes module initialisation order fragile; the type-level group makes the compiler and readers follow dozens of files to understand one.

### Remediation

Direction only; not scheduled. None of this changes the public API except where noted.

| Piece | Work | Size |
| - | - | - |
| 1. Shared building blocks | Move `FrodoError.ts` and `OpsTypes.ts` to `src/shared/` and re-export from the old paths; the package root keeps exporting `FrodoError`. Move the `EmailTemplateOps` constant and the `CallbackOps` type that `api` needs to `shared`. Removes 10 of the 34 edges. | S |
| 2. `RequiredScopesOps` | The scope catalogue `BaseApi` and `ExportImportUtils` need becomes a shared module. | S |
| 3. Facade and root imports | `SecretsOps` receives what it needs from the facade as a parameter or imports the ops module directly; `WSFedOps` imports the type it needs; `AutoSetupPolly` and `HelpUtils` import from the module that owns the thing. | S |
| 4. `ExportImportUtils`, `ForgeRockUtils`, `ScriptValidationUtils` | The functions that need ops or api move into the ops layer (`ops/internal/` where they are not public) and the facade keeps exposing them under `frodo.utils`. | M |
| 5. `State` types | The shapes `State` stores move to `src/shared/` (type-only change), so `shared` imports nothing from `api` or `ops`. Removes 8 edges. | S |
| 6. The 10-file runtime cycle | Checked by simulation on the import graph: removing the four edges `IdmConfigApi` to `EmailTemplateOps`, `ExportImportUtils` to `VariablesOps` and to `EmailTemplateOps`, and `ForgeRockUtils` to `RealmOps` breaks it (pieces 1 and 4). Removing all 17 upward value imports leaves cycles of 4, 3 and 2 files inside one layer each. | M |
| 7. Enforcement | A lint rule (`import-x/no-restricted-paths` zones) with a list of allowed legacy edges that only shrinks, so new upward edges fail in CI. | S |

All pieces are internal and non-breaking: the public names stay where users import them from (`frodo`, `state`, `FrodoError`, the root types).
