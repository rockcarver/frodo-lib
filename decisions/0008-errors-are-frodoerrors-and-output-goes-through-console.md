---
status: accepted
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/api/**
  - src/ops/**
  - src/utils/**
---

# Ops code throws FrodoError and prints through Console.ts

## Context and problem statement

A library has no business deciding where messages go, and a caller needs the cause of a failure, not just its text. The rules are in `CONTRIBUTE.md` ("Writing a new ops module", step 2) and `AGENTS.md`. Recorded retroactively and measured on `main` (42632f3cd, 2026-10-24).

## Decision

- A failure from the api layer is wrapped as `throw new FrodoError('Error reading X', error)` so the cause is kept. A bare `Error` is only for argument guards (`src/api/ManagedObjectApi.ts` is the model).
- Output goes through `src/utils/Console.ts` (`printMessage`, `verboseMessage`, `debugMessage`, `createProgressIndicator` and its siblings), never through `console.*`. Each function takes the caller's handler from `state`; the library decides nothing about where output goes (umbrella 0001; the exceptions are in record 0011).

## Consequences

Measured:

| Rule | Result |
| - | - |
| `throw new FrodoError` against `throw new Error` in `src/ops` | 985 against 17 live throws (98.3%); a further bare `Error` sits in a comment |
| the same in `src/api` | 13 against 16; 13 of the 16 are the argument guards in `ManagedObjectApi.ts` |
| `console.*` in non-test source | 11 matches in 3 files: `State.ts` (5, the default handlers), `SetupPollyForFrodoLib.ts` (4, one of them a comment; the recording framework), `ext/axios-curlirize` (2) |
| direct use of `process.stdin`, `process.stdout` or `process.stderr` | `TerminalBackgroundDetection.ts` (8 stdin, 2 stdout) and `State.ts` (4 stderr, the default error handler) |

- The 17 bare errors in `src/ops` are not argument guards: they are "not found", "multiple found" and "unsupported 2FA factor" failures in `RealmOps`, `InternalRoleOps`, `ThemeOps`, `IdpOps`, `ApplicationOps`, `SecretStoreOps`, `JourneyOps`, `AuthenticateOps` and `classic/ServerOps`. They contradict the rule as written and are listed in record 0013.
- The stream use in `TerminalBackgroundDetection.ts` and the `console.*` and `process.stderr` use in the `State.ts` default handlers are part of the terminal-code deviation in record 0011. The recording framework (0010) prints its own status lines by design. The `State.ts` default handlers also contradict the header of `Console.ts`, which says output is lost when the caller sets no handler: the defaults print to the console and to stderr.
