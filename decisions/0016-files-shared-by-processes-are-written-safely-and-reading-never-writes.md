---
status: accepted
date: 2026-11-06
decision-makers:
  - maintainers
applies-to:
  - src/ops/TokenCacheOps.ts
  - src/ops/ConnectionProfileOps.ts
  - src/utils/ExportImportUtils.ts
  - src/utils/FileLockUtils.ts
  - src/utils/DataProtection.ts
issues:
  - rockcarver/frodo-lib#914
---

# Files shared by processes are written safely and reading never writes

## Context and problem statement

The library keeps state in files under the user's frodo directory: the token cache with its two indexes and the connection profiles file. Several processes use them at the same time: command line runs, MCP servers, scripts and editor extensions. When this was decided, on 2026-11-06, each file was a single JSON document that every save read whole, changed in memory and wrote back by truncating and rewriting, with no lock. Two processes could lose each other's entries, a reader could see a half-written file, and a corrupt cache stayed corrupt. A measurement the same day showed that even a cache hit rewrote files, with identical content, on every call.

## Decision

- **Assume other writers.** Code that writes under the frodo directory does not rely on being the only process that does.
- **A set of independent entries is one file per entry.** The token cache is stored that way, so no write has to read another entry. Entries carry the plain data a listing needs, so no shared index file is needed.
- **Writes are atomic.** Write a uniquely named temporary file in the same directory, created with its final permissions (an owner-only file is never readable by others, even briefly), then rename it over the target. A reader never sees a partial file.
- **A file that must stay one document** (the connection profiles file, which people edit, back up and share) is written under a lock file, re-read inside the lock, written atomically, and not written at all when the result equals what is on disk. A lock that is older than a bound is stale.
- **A file that is created once is created exclusively** (the master key, the empty connection profiles file), so processes that start together end up with the same file.
- **A read never writes,** and a write that changes nothing is skipped.
- **Unreadable data: replace only what can be rebuilt.** A token cache entry that cannot be read is treated as missing, and the next login writes a new one. A file that holds data the user keeps, such as the connection profiles, and that cannot be parsed is reported and left as it is.
- **Each shared file has a test with several processes** that write at the same time and lose nothing; it runs on every supported operating system.

## Consequences

- A change that adds a file under the frodo directory, or a write to an existing one, states which of these rules it follows.
- The on-disk layout of the cache is private to the library. Consumers go through the `frodo.cache` facade.
- The library keeps no runtime dependencies for this: locking and renaming use the platform file API.

## Alternatives considered

One cache file with a lock: it needs rules for a process that dies holding the lock and for locks on network or synced home directories, and every reader still parses the whole cache. A database: it adds a dependency or a platform feature that is not available on every supported runtime.
