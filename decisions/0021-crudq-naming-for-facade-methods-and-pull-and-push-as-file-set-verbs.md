---
status: proposed
date: 2026-11-27
decision-makers:
  - maintainers
applies-to:
  - src/ops/**
  - src/utils/**
  - src/lib/FrodoLib.ts
  - src/mcp/CapabilityRegistry.ts
issues:
  - rockcarver/frodo-lib#1114
  - rockcarver/frodo-lib#1162
supersedes:
  - 0019
---

# Facade methods follow the CRUDQ naming convention, and pull and push are the verbs of file sets

## Context and problem statement

This record supersedes [0019](0019-crudq-naming-for-facade-methods-with-pull-and-push.md): every rule of it stays except one sentence, which said that a pull is a split of the type's export and a push a merge followed by its import. When the first pull and push were added, on 2026-11-27 (rockcarver/frodo-lib#1162), a pull read the type's entity and split it, and a push wrote with the owner's own write. What a pull and a push do is a rule of both repositories, so it is [core 0028](core/0028-the-library-turns-configuration-into-file-sets-through-the-types-own-read-and-write.md)'s, and this record keeps the names and the registry. Library users, the generated help and the MCP capability registry, which infers what a method does from its name prefix ([0001](0001-every-special-capability-has-a-reviewed-risk-entry.md)), all depend on predictable names. Under a name outside the convention each pull and push would be a special capability with a reviewed entry per type, and a wrong or missing entry would let a write to the tenant pass as safe. The convention is written in `CONTRIBUTE.md`.

## Decision

The names of methods on the `frodo` facade (the public type of every ops and utils module):

| Action | Rule |
| - | - |
| `create` | Create an object. Fails if the object already exists. |
| `read` | Read one object (`readJourney`) or all objects of a type (`readJourneys`). |
| `update` | Update an object if it exists, create it otherwise. |
| `delete` | Delete one object or all objects of a type. |
| `query` | Query objects. |
| `export`, `import` | Export or import one or all objects of a type, as the JSON export of the library. |
| `pull`, `push` | `pull` reads one or all objects of a type from the tenant and returns a file set (`pullJourneys`). `push` takes a file set from a reader and writes it to the tenant (`pushJourneys`). |
| `get`, `set` | Retrieve or set one individual property of an object (`getJourneyDescription`). |
| `enable`, `disable` | Status of a configuration. Avoid getters and setters for status. |
| anything else | A meaningful name, as long as it conveys the purpose. |

`count`, `list` and `search` are accepted for counting, listing and searching; the registry infers them although the `CONTRIBUTE.md` tables do not list them.

- **Pull and push are the file-set verbs of [core 0028](core/0028-the-library-turns-configuration-into-file-sets-through-the-types-own-read-and-write.md).** What a pull reads, what a push writes and which bytes they keep are decided there. Neither touches the file system: a pull returns the file set and a push asks the reader it is given.
- **Split and merge are not on the facade.** The pure functions are exported from the type's ops module for the pull, the push and their tests, and are not in the module's public `type`, so the facade, the generated help and the registry do not list them.
- **The registry class follows the verb.** `pull` is inferred as an `export`: not mutating, and not in the read-only dispatch (`READ_ONLY_OPERATION_TYPES` in `src/mcp/ToolRuntime.ts` holds only read-like types). `push` is inferred as an `import`: a write, with the risk class of an import. No policy names `pull` or `push`; every policy that allows or denies `export` or `import` treats them alike. A method that needs another class gets a reviewed entry in `src/mcp/CapabilityMetadata.ts`, as any method does.
- **A function returns what its caller needs to decide the exit code, as data, and a finding is never silent.** For a configuration type (a bounded set) a pull returns a `PullResult`, the file set (`fileSet`) and its `findings`; a `PullFinding` is a name clash (collision), a refused id, an entry that cannot be read or an entry that is not of the type. A push returns one `PushOutcome` for each object. The engine functions for a list type are `splitList`, `mergeList` and `mergeAndWriteList`. A new function takes no per-object result callback. Progress goes only through the progress indicators (`createProgressIndicator`, `updateProgressIndicator` and `stopProgressIndicator`, which a consumer plugs in with `state.setCreateProgressHandler` and its two siblings) and messages only through the print and debug handlers. The `resultCallback` of the heritage functions stays until they are moved.
- **A collection that can be unbounded is read as pages.** For data with no bound in the code (managed objects, OAuth2 clients where dynamic registration is on, users, logs) a function returns an `AsyncIterable` of pages, built on the cookie paging of the API layer. A page holds its entries and its findings: a problem with one entry is a finding of its page, and a failed request throws out of the iteration with the last good cookie, so that a caller can resume. The consumer writes the pages to a sink as they arrive (for example NDJSON or a folder of shards) and decides the exit code from the findings of all pages. A file-set type has a `volume` (of the type `Volume`: `bounded` or `unbounded`), and the engine refuses an unbounded type.
- **A push checks every id before it builds a URL.** Each list type names the shape of its id in `idPrefix`, in one of three modes: a prefix, and the engine checks the prefix and one safe segment; empty, and the id is one safe segment; or `null`, for an id that is never put into a URL, which gets no segment check but is still text, with no control character and no lone surrogate. So an id of another type (`access` among the locales) is refused as well as an unsafe one.
- **A safe segment (`isRequestSegment`) is one name that no request layer or server reads as more.** A value is refused when it is empty, is `.` or `..`, holds `/`, `\`, `?`, `#` or `%` (a path, a query, a fragment or an escape), holds a control character or a lone surrogate, starts or ends with a blank (a space or another Unicode separator, which a URL parser or a server may trim away), or starts with `;`, `.;` or `..;` with or without blanks before the `;` (a server may cut the path parameter off first and read a dot segment or no name). Accepted on purpose: a blank inside a name (`My Schedule`), a colon, a dot or a `;` inside or after a name, and a format character such as a zero-width space or a bidirectional control, which the request carries percent-encoded and so cannot retarget it. A second file with the same id is refused, and so is an `_id` whose raw text holds `${` in every mode, so that a value of the state or the environment cannot reach a URL or a message. A refused file is an outcome and no request is sent for it; on a pull the same check makes the refused id a finding, so that a pull never writes a file that a push would refuse. One refused id never stops the other objects, and no message repeats an id.

## Consequences

- Kept in sync with this record: `inferOperationType` and the prefix list of `inferObjectType` in `src/mcp/CapabilityRegistry.ts`, which know `pull` and `push` and are pinned by `src/mcp/CapabilityRegistry.test.ts`; the CRUDQ table and the paragraph on inferred prefixes in `CONTRIBUTE.md`; the naming bullet in `.github/instructions/ops-modules.instructions.md`; and the skills that list the verbs (for example `.claude/skills/build-the-lib/SKILL.md`).
- A consumer can write as it reads and set its exit code from data alone. The price: a result type with findings on every pull, a `volume` and an id shape on each list type, and two ways to read a collection, whole for a bounded type and by pages for data.
- Records that cite 0006 or 0019 keep doing so and are read through their status, which points here.
- A pull is classed as an export for what it does to the tenant (nothing is written). It carries no secret in the clear: a file set holds none ([core 0013](core/0013-secrets-are-never-exported-in-the-clear.md)).

## Known deviations

Some names contradict the convention, for example `get` for a whole object (`getConnectionProfile`), `remove` for deleting an object (`removeManagedObjectType`), `add` for creating one (`addCustomDomain`) and `save` where `update` fits (`saveConnectionProfile`). The dated list is in the Known deviations section of 0006, which the pull request that renames one edits. A rename adds the new name, keeps the old one as a deprecated alias and goes into `MIGRATION.md`; none is scheduled.

On 2026-11-27, against frodo-lib commit 74368723c, `resultCallback` appeared about 1,380 times in about 50 source files (tests left out), and the readers of managed objects and organizations returned the whole collection as one array. Both are what the rules above move away from: they are the target and not the state, and each function is changed when it is moved. None is scheduled.

On the maintainer's decision of 2026-11-27 the shipped `pushKbaConfig` and the engine function `mergeAndWriteList` keep the pass-through of their callbacks (`resultCallback`, and `leftOutCallback` where the import function has one) to the import function of the heritage code, so that no shipped signature changes now. That deviates from "A new function takes no per-object result callback". It goes away with the heritage import functions when they are moved, and one follow-up issue is to track it.

## Alternatives considered

Name them as variants of export and import (`exportJourneyToFiles`): the registry would infer them unchanged, but `export` and `import` would then mean two formats. Put split and merge on the facade: more public surface for pure helpers, and the consumer could compose its own reads and writes around them. Leave `pull` and `push` as special names with an entry per type: [0001](0001-every-special-capability-has-a-reviewed-risk-entry.md) prefers a name the convention recognises.
