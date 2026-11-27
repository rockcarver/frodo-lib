---
status: accepted
date: 2026-11-17
decision-makers:
  - maintainers
applies-to:
  - src/ops/**
  - src/utils/**
  - src/lib/FrodoLib.ts
  - src/mcp/CapabilityRegistry.ts
issues:
  - rockcarver/frodo-lib#1114
supersedes:
  - 0006
---

# Facade methods follow the CRUDQ naming convention, with pull and push for file sets

## Context and problem statement

This record supersedes [0006](0006-crudq-naming-for-facade-methods.md): every rule of it stays and two verbs are added. Library users, the generated help and the MCP capability registry, which infers what a method does from its name prefix ([0001](0001-every-special-capability-has-a-reviewed-risk-entry.md)), all depend on predictable names. [Core 0024](core/0024-the-library-turns-configuration-into-file-sets-and-back-and-never-touches-the-file-system.md) gives each configuration type a tenant-facing pull and push, and the convention has no word for them. Under a name outside the convention each would be a special capability with a reviewed entry per type, and a wrong or missing entry would let a write to the tenant pass as safe. The convention is written in `CONTRIBUTE.md`.

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

- **Pull and push wrap export and import.** A pull is a split of the type's export and a push is a merge followed by its import ([core 0024](core/0024-the-library-turns-configuration-into-file-sets-and-back-and-never-touches-the-file-system.md)). Neither touches the file system: a pull returns the file set and a push asks the reader it is given.
- **Split and merge are not on the facade.** The pure functions are exported from the type's ops module for the pull, the push and their tests, and are not in the module's public `type`, so the facade, the generated help and the registry do not list them.
- **The registry class follows the verb.** `pull` is inferred as an `export`: not mutating, and not in the read-only dispatch (`READ_ONLY_OPERATION_TYPES` in `src/mcp/ToolRuntime.ts` holds only read-like types). `push` is inferred as an `import`: a write, with the risk class of an import. No policy names `pull` or `push`; every policy that allows or denies `export` or `import` treats them alike. A method that needs another class gets a reviewed entry in `src/mcp/CapabilityMetadata.ts`, as any method does.

## Consequences

- `inferOperationType` and the prefix list of `inferObjectType` in `src/mcp/CapabilityRegistry.ts` learn `pull` and `push`, and `src/mcp/CapabilityRegistry.test.ts` pins both, in the pull request that adds the first pull or push.
- Kept in sync with this record: the CRUDQ table and the paragraph on inferred prefixes in `CONTRIBUTE.md`, the naming bullet in `.github/instructions/ops-modules.instructions.md`, and the skills that list the verbs (for example `.claude/skills/build-the-lib/SKILL.md`).
- Records that cite 0006 keep doing so and are read through its status, which points here.
- A pull is classed as an export for what it does to the tenant (nothing is written). It carries no secret in the clear: a file set holds none ([core 0013](core/0013-secrets-are-never-exported-in-the-clear.md)).

## Known deviations

Some names contradict the convention, for example `get` for a whole object (`getConnectionProfile`), `remove` for deleting an object (`removeManagedObjectType`), `add` for creating one (`addCustomDomain`) and `save` where `update` fits (`saveConnectionProfile`). The dated list is in the Known deviations section of 0006, which the pull request that renames one edits. A rename adds the new name, keeps the old one as a deprecated alias and goes into `MIGRATION.md`; none is scheduled.

## Alternatives considered

Name them as variants of export and import (`exportJourneyToFiles`): the registry would infer them unchanged, but `export` and `import` would then mean two formats, which core 0024 avoids. Put split and merge on the facade: more public surface for pure helpers, and the consumer could compose its own reads and writes around them. Leave `pull` and `push` as special names with an entry per type: [0001](0001-every-special-capability-has-a-reviewed-risk-entry.md) prefers a name the convention recognises.
