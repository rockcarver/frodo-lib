---
status: accepted
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/api/**
  - src/ops/**
  - src/shared/**
  - src/utils/**
  - src/lib/FrodoLib.ts
---

# frodo-lib has an api layer, an ops layer and a facade, with shared code below them

## Context and problem statement

Every new module has to land in one place and import in one direction, or the library turns into a tangle that nobody can reason about or test. The layers are described in `CONTRIBUTE.md` ("Code structure and conventions"); the dependency direction is an established pattern that the documents never state. Recorded retroactively from CONTRIBUTE.md and a measurement of `main` (42632f3cd, 2026-10-24). It implements the library half of the umbrella record 0001 (the library is the brain, the CLI a thin wrapper).

## Decision

- `src/api/` wraps platform REST endpoints: URL templates, API versions, skeleton types, one function per endpoint. No business logic.
- `src/ops/` is the library layer: business logic, import and export, progress output. It calls the api layer for requests and other ops modules for reuse.
- `src/lib/FrodoLib.ts` is the facade (`frodo`). It imports the ops factories and is the only way a module becomes reachable by library users (umbrella 0007).
- `src/shared/` (State, constants, operation types, version) and `src/utils/` are the foundation. `src/mcp/` is a consumer of the facade, not part of the layer stack. `src/ext/` holds vendored code that cannot be consumed as an npm package.
- Imports point downward only (established pattern, measured below): `lib` to `ops`; `ops` to `api`, `ops`, `shared`, `utils`; `api` to `api`, `shared`, `utils`. `shared` and `utils` are one foundation and may import each other (`State.ts` imports five utils modules, and utils import `State`), but neither imports `api`, `ops`, the facade or the package root.
- Deployment-specific modules live in `cloud/` or `classic/` under both `api/` and `ops/`. Helpers shared by ops modules and not exposed on the facade live in `src/ops/internal/`.

## Consequences

Measured on `main` with a syntax-tree analysis of the relative imports of non-test modules: 1,278 edges, of which 839 are value imports, 435 are used only as types (erased at build) and 4 are dynamic `import()`.

| Layer | Modules | Lines | Edges that follow the rule |
| - | - | - | - |
| `api` | 65 | 16,051 | api to api 112, shared 121, utils 85 |
| `ops` | 87 | 61,848 | ops to api 166, ops 236, shared 104, utils 153 |
| `utils` | 23 | 5,195 | utils to utils 21, shared 12 |
| `shared` | 4 | 1,357 | shared to utils 5 (all from `State.ts`) |
| `lib` (facade, generated help) | 2 | 9,418 | lib to ops 79 |

Edges against the rule: api to ops 6, shared to api 3, shared to ops 5, utils to api 4, utils to ops 9, ops to the facade or package root 5, utils to the package root or generated help 2. That is 34 of 1,278 edges (2.7%): 17 value imports, 13 type-only imports and 4 dynamic imports. They are recorded as a known deviation in record 0012.

- A reviewer rejects a new module that imports upward. The fix is to move the shared piece down, not to add the import.
- Type-only imports count as edges: they do not run, but they tie the layers together for readers and for the compiler (record 0012).
