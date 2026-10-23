---
applyTo: 'src/**/*.test.ts,src/test/**'
---

# Tests

- **Layout.** Tests sit next to their module (`ScriptOps.test.ts`). Snapshots live in `src/test/snapshots`, mirroring the source path (resolved by `snapshotResolve.js`); recordings in `src/test/mock-recordings`; staging helpers for recorded tests in `src/test/setup`.
- **Two kinds.** A recorded test calls `autoSetupPolly()` and replays HTTP from recordings. A `*.unit.test.ts` file never uses recordings (none of the 48 does): it injects fakes and needs no tenant.
- **Run** `npm run test:only -- <path pattern>` for a subset and `npm test` for everything. A bare `npx jest` fails without the `--experimental-vm-modules` flag. Tests run on the sources, so they need no build. The clone directory must be named `frodo-lib`: `src/utils/AutoSetupPolly.ts` finds the recordings through that path segment.
- **A request without a recording fails the test** (`test/jest-polly-replay-integrity.setup.js`). Recording needs a real tenant (`npm run test:record <Name>`, see the header of any recorded test and [RECORD_REPLAY.md](../../RECORD_REPLAY.md)), so a maintainer does it. If your change needs new HTTP traffic, write the test, say in the pull request that it needs a recording, and do not hand-write or edit anything under `src/test/mock-recordings`.
- **A failing snapshot is either an expected output change or a regression.** Decide which before touching it. Update a snapshot (`npm run test:update`) only for an expected change, and say so in the pull request. Never update snapshots just to turn CI green.
- **Production code does not read the record and replay switches** (`FRODO_MOCK*`, `FRODO_POLLY_MODE`, `FRODO_RECORD_PHASE`). Only `src/api/BaseApi.ts`, `src/utils/AutoSetupPolly.ts`, `src/utils/SetupPollyForFrodoLib.ts` and the helpers in `src/test/setup` do. Do not add another.
- **Never commit credentials, keys or tokens**, in a test, a fixture or a recording.
