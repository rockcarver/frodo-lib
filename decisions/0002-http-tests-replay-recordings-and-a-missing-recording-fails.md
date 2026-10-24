---
status: accepted
date: 2026-07-12
decision-makers:
  - maintainers
applies-to:
  - test/jest-polly-replay-integrity.setup.js
  - src/test/**
---

# HTTP tests replay recordings and a missing recording fails the test

## Context and problem statement

Most of the library talks to a tenant. Its tests run against recorded HTTP traffic (Polly) so that CI needs no tenant. A test could pass while Polly logged "recording not found", so replay coverage was incomplete without anyone noticing ("soft-green").

## Decision

- In replay mode, the default, a request without a recording fails the test. `test/jest-polly-replay-integrity.setup.js`, loaded through `setupFilesAfterEnv` in `jest.config.js`, fails any test during which Polly reported a missing recording. Recording runs are excluded.
- Recordings come only from a real recording run against a real environment (`npm run test:record`, see `RECORD_REPLAY.md`), made by someone with access to one. Nobody hand-writes or hand-edits a recording.
- A recording or snapshot is not updated to turn a run green. First decide whether the change is expected or a regression, and say so in the pull request.
- Only the HTTP layer (`src/api/BaseApi.ts`), the Polly setup (`src/utils/AutoSetupPolly.ts`, `src/utils/SetupPollyForFrodoLib.ts`) and the test setup helpers in `src/test/setup` read the record and replay switches. Production code does not.

## Consequences

- A contributor without tenant access cannot record a new request. Say so in the pull request and a maintainer records it.
- A missing-recording failure is a real failure, not flakiness: record it, never silence it.
