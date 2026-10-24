---
status: deprecated
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/ops/**
  - src/lib/Help.ts
  - package.json
---

# Smaller places where the code departs from the documented conventions (deprecated)

## Context and problem statement

Records 0004 to 0010 state conventions. Measuring them on `main` (42632f3cd, 2026-10-24) found a few smaller departures that are not worth a record each but should not be lost. Each is listed with its evidence; none is scheduled. The bigger deviations have their own records: terminal and colour code (0011), upward imports (0012).

## Decision

The departures below are deprecated: they are not copied into new code, and fixing one is welcome in any pull request that touches the file.

### Evidence

| # | Departure | Rule it departs from | Evidence | Remediation | Size |
| - | - | - | - | - | - |
| 1 | Five internal helper modules sit in `src/ops/` as `*Ops.ts` without a default factory and are not on the facade | 0005: helpers not exposed on the facade go in `src/ops/internal/` | `BrowserAuthenticateOps`, `CallbackOps`, `CallerTrustTierOps`, `PrivilegeEscalationOps`, `RequiredScopesOps` (1 to 4 importers each, 9 test files between them) | Move to `src/ops/internal/` or give them a factory if they are meant to be public | S |
| 2 | About 1,190 lines of commented-out functions in `src/ops/AdminOps.ts` (lines 326 to 1909) | none stated; dead code | The commented block holds `listOAuth2CustomClients`, `listOAuth2AdminClients`, `addAutoIdStaticUserMapping`, `grantOAuth2ClientAdminPrivileges`, `createLongLivedToken`, `repairOrgModel` and more; frodo-cli implements the same functions itself (frodo-cli record 0026) | Decide whether the logic moves back into the library (cli 0026) or the block is deleted | S |
| 3 | 17 bare `throw new Error` in ops code that are not argument guards ("not found", "multiple found", "unsupported 2FA factor") | 0008: ops code throws `FrodoError` and keeps the cause | `RealmOps` 2, `InternalRoleOps` 2, `ThemeOps` 2, `IdpOps` 2, `ApplicationOps` 2, `SecretStoreOps` 2, `AuthenticateOps` 2, `classic/ServerOps` 2, `JourneyOps` 1 | Throw `FrodoError`; callers that match on the message need a check first | S |
| 4 | 62 of 844 public methods have no TSDoc description (719 of 844 have `@returns`) | 0003: every method of a public type is documented | `ExportImport` 17, `FRUtils` 7, `OAuth2Oidc` 6, `ScriptValidation` 6, `Jose` 5, `Base64` 5, `Admin` 4, `Version` 3, `Json` 3, `PolicySet` 2, one each in `Saml2`, `Service`, `Jwt`, `Pkce` | Write the descriptions, regenerate `Help.ts` | S |
| 5 | `tsup.config.ts` is still in the repository although the build runs `tsdown` (`tsdown.config.mts`) | the toolchain moved to tsdown in 2026-10 | `package.json` scripts do not reference tsup | Delete the file | S |
| 6 | `engines.node` is `>=20`, while `CONTRIBUTE.md` and `AGENTS.md` say Node.js 22 or later and the CI matrix runs 22, 24 and 26 | the docs show the tested matrix, not `engines` (a maintainers' convention) | `MIGRATION.md`: 4.x dropped Node 18 and 20 | Confirm that the wider `engines` range is intended; if not, raise it | S |
| 7 | Two public types carry an `Ops` suffix in their names | 0006 (type names omit it) | `ManagedObjectSchemaOps`, `ManagedSystemObjectSchemaOps` | Rename the types; they are exported types, so alias and deprecate | S |
| 8 | Comments in source point at local machine paths, a personal sample login and a private note | `AGENTS.md`: never commit credentials; durable design goes into repository docs | `SetupPollyForFrodoLib.ts` (comment blocks near lines 220 to 240), `EnvFederationEnforcementOps.ts` (a line naming a private note) | Rewrite the comments; see the sensitivity list | S |
| 9 | Facade method names that contradict the CRUDQ convention | 0006 | 19 candidates, listed in 0006 | See 0006 | M |
| 10 | `BUILD-ENV.md` says the `types/` tree is dropped from the tarball, `files` lists it | the document | `package.json` `files` | Correct the document or the list | S |

## Consequences

- Conformance found for existing records, for the record: regenerating `Help.ts` on `main` changes nothing (lib record 0003, 844 methods from 110 files); no hit of a record or replay switch outside the allowed files (lib record 0002); the capability baseline is empty (lib record 0001).

- None of these breaks users today. Items 3, 7 and 9 touch public behaviour or names and follow the alias-and-migrate route when they are fixed (0006).
- A reviewer may point at this record when a pull request copies one of the patterns.
