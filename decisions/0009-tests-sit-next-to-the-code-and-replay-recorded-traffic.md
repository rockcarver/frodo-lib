---
status: accepted
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/**/*.test.ts
  - src/test/**
  - test/**
---

# Tests sit next to the module, in two kinds, and run on the sources

## Context and problem statement

Where a test lives and how a contributor runs it is stated in `CONTRIBUTE.md` ("Before submitting a PR"), `AGENTS.md` and `.github/instructions/tests.instructions.md`. Record 0002 already fixes what a recording is and that a missing one fails the test; this record keeps the layout rules. Recorded retroactively and measured on `main` (e79cfa524, 2026-10-24).

## Decision

- Tests sit next to their module (`ScriptOps.test.ts`). `src/test/` holds resources: `mock-recordings` (Polly), `setup` (staging helpers for recorded tests), `snapshots` (mirroring the source path, resolved by `snapshotResolve.js`), `utils`, and `mocks` (the old mock engine, still used by some tests). The root `test/` holds the Jest setup, including the replay integrity guard.
- Two kinds of test: a recorded test calls `autoSetupPolly()` and replays HTTP from `src/test/mock-recordings`; a `*.unit.test.ts` file never uses recordings, it injects fakes and needs no tenant.
- Tests run on the sources through `npm run test:only -- <pattern>` or `npm test`; a bare `npx jest` fails without `--experimental-vm-modules`. The clone directory is named `frodo-lib`, because `AutoSetupPolly.ts` finds the recordings through that path segment.
- A failing snapshot is decided before it is touched: expected change or regression. It is updated (`npm run test:update`) only for an expected change, and the pull request says so.
- No credentials, keys or tokens in a test, fixture or recording.

## Consequences

Measured:

| Rule | Result |
| - | - |
| 160 `*.test.ts` files; recorded / unit / neither | 60 / 48 / 52 |
| unit tests that use recordings | 0 of 48 (100% conformance) |
| api modules with a sibling test | 22 of 65 (34%) |
| ops modules with a sibling test | 66 of 87 (76%) |
| utils modules with a sibling test | 13 of 23 (57%) |

- "Tests sit next to the module" says where tests go, not that every module has one. 43 api modules and 21 ops modules have no sibling test; whether that is a gap is not decided here.
- 52 test files are neither recorded nor named `*.unit.test.ts` (fakes or pure inputs). The two names describe the recording behaviour, not every file.
