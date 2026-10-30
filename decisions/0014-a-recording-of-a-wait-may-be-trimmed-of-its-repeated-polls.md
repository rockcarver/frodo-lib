---
status: proposed
date: 2026-10-30
decision-makers:
  - maintainers
applies-to:
  - src/test/mock-recordings/**
issues:
  - rockcarver/frodo-lib#849
---

# A recording of a wait may be trimmed of its repeated polls

## Context and problem statement

[Record 0002](0002-http-tests-replay-recordings-and-a-missing-recording-fails.md) says nobody hand-writes or hand-edits a recording, so that every recorded response is one a tenant really gave. A test that waits for an operation (a lock, a promotion, a rollback) polls its status until it ends, and a real run of minutes records dozens of identical "still running" answers. Replay matches requests in order, so every recorded poll is a poll the test makes again, and a consumer that shows how long a replayed wait took, such as the recorded output of frodo-cli, would replay for as long as the real wait. The recordings of the promotion waits were trimmed for that reason, which the rule, read literally, forbids.

## Decision

- A recording of a wait may be trimmed of repeated polls that return the same state. The first poll stays, and so does the last, which returns the end state. Every entry that stays is a response the tenant really gave, in its real order; nothing is added, reordered or changed.
- Trimming is the only hand edit a recording may have. It is made on the file a recording run wrote, and the header of the test says that the wait recordings were trimmed.
- Everything else in record 0002 stays: recordings come from a real run, nobody writes or changes a response, and a snapshot is not updated to turn a run green.
- A test of a wait polls fast while it replays and at the real interval while it records, so the number of recorded polls does not decide how long the test takes.

## Consequences

- A re-recorded wait is trimmed the same way, and a reviewer checks that the entries that remain are the first poll or polls, in order, and a last one with the end state.
- The time between two recorded polls is no longer the time the tenant took, so a test must not rely on it.
