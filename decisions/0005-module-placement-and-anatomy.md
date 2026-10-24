---
status: accepted
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/api/**
  - src/ops/**
  - src/lib/FrodoLib.ts
---

# Every platform object kind is an api module plus an ops module with one fixed shape

## Context and problem statement

Adding support for another kind of platform object happens often and should look the same every time, so that library users, the MCP capability registry and the generated help find it where they expect it. The recipe is in `CONTRIBUTE.md` ("Writing a new ops module") and `.github/instructions/ops-modules.instructions.md`. This record keeps the rule next to the layer rule (0004). Recorded retroactively and measured on `main` (42632f3cd, 2026-10-24).

## Decision

- One kind of object is `src/api/<Name>Api.ts` and `src/ops/<Name>Ops.ts`. Modules that exist for one deployment type only go in `cloud/` or `classic/` under both folders. Copy a neighbour (`ScriptTypeApi.ts`, `ScriptTypeOps.ts`).
- An api function takes one options object that ends in `state` and sends the request through a `generate*Api` helper from `BaseApi.ts`.
- An ops module exports a `type <Name>` with one documented method signature per public function, a default export `(state: State): <Name> => ({ ... })` that delegates to standalone exported functions, and those functions, which take one options object that ends in `state`.
- The module is registered in `src/lib/FrodoLib.ts` (factory and type imported, type added to `Frodo`, instance added in `FrodoLib()`). A module that is not registered cannot be reached by library users.
- Helpers that are not part of the public surface go in `src/ops/internal/` (not `src/ops/`), so nothing in `src/ops/*Ops.ts` is unregistered by accident.
- Tests sit next to the module (0009). Methods are named by the convention in 0006.

## Consequences

Measured on `main`:

| Rule | Conformance | Outliers |
| - | - | - |
| api files end in `Api.ts` | 64 of 65 (98.5%) | `ApiTypes.ts` (types only) |
| ops files end in `Ops.ts` | 83 of 87 (95.4%) | `FrodoError.ts`, `OpsTypes.ts`, `VersionUtils.ts`, `internal/RelationshipHelpers.ts` |
| `*Ops.ts` has a default factory and is registered | 78 of 83 (94.0%) | `BrowserAuthenticateOps`, `CallbackOps`, `CallerTrustTierOps`, `PrivilegeEscalationOps`, `RequiredScopesOps` (internal helpers that sit in `src/ops/`, imported by 1 to 4 other modules each) |
| api functions take an options object that includes `state` | 370 of 371 (99.7%); `state` last in 349 (94.1%) | `requireVersion` in `NodeApi.ts` has none |
| ops functions take an options object that includes `state` | 798 of 853 (93.6%); `state` last in 793 (93.0%) | 52 pure helpers without `state` (12 in `ManagedObjectSchemaOps`, 9 in `AdminOps`, 7 in `JourneyOps`, 5 in `JoseOps` and others) |

- The five unregistered modules and the misplaced helpers are listed as known deviations in record 0013. Pure helpers without `state` are fine; they are not part of the rule.
- Not in the docs: `src/utils/` files mostly end in `Utils.ts` (15 of 23); the others (`Console`, `ColorTheme`, `DataProtection`, `TerminalContrast`, `TerminalBackgroundDetection`, `AutoSetupPolly`, `SetupPollyForFrodoLib`, `FrodoNodeHttpAdapter`) do not. This is not a rule.
