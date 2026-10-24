---
status: accepted
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/api/**
---

# The api layer is named after the HTTP operation, the ops layer after CRUDQ

## Context and problem statement

`CONTRIBUTE.md` states the CRUDQ naming convention for "object manipulation" without saying which layer it applies to. In the code the two layers follow different vocabularies, and the split is stable. This is an established pattern that the documents do not state. Recorded retroactively and measured on `main` (42632f3cd, 2026-10-24).

## Decision

- Functions in `src/api/` are named after what the endpoint does on the wire: `get`, `put`, `create`, `delete`, `query`, `patch`, `update`, `set`, with the object as the rest of the name (`getTree`, `putTree`, `deleteTree`).
- Functions in `src/ops/` and on the facade follow the CRUDQ convention in record 0006 (`readJourney`, `updateJourney`). An ops function maps one or more api calls to that vocabulary.
- Operations that are not object manipulation (authentication, scripting engine calls) use meaningful names in both layers.

## Consequences

Measured on 371 exported api functions:

| Prefix | Count | Share |
| - | - | - |
| `get` | 156 | 42.0% |
| `put` | 47 | 12.7% |
| `delete` | 45 | 12.1% |
| `create` | 26 | 7.0% |
| `query` | 16 | 4.3% |
| `update`, `set`, `patch`, `read`, `count`, `search`, `enable` | 34 | 9.2% |
| everything else (`generate` 12, `find`, `start`, authentication and scripting operations) | 47 | 12.7% |

- 87.3% of api names use the operation vocabulary above. The remainder are operations of their own kind.
- `read` appears in 3 api functions and `update` in 12; both are ops-layer words used at the wrong layer in a few places. They are minor and are not recorded as a deviation.
- A reviewer does not ask api functions to be renamed to CRUDQ. What `get` may mean on the facade is decided in record 0006.
