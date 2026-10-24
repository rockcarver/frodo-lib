---
status: accepted
date: 2026-08-29
decision-makers:
  - maintainers
applies-to:
  - src/mcp/**
---

# Every special capability has a reviewed risk entry

## Context and problem statement

The MCP capability registry (`src/mcp/CapabilityRegistry.ts`) infers what a facade method does from its name: `create*`, `read*`, `update*`, `delete*`, `import*`, `export*`, `search*`, `list*` and a few more prefixes. A method that matches none is "special", and left to inference a special capability counts as non-mutating and low risk. A method that changes or deletes something under an unusual name (the `removeManagedObject*` schema functions were the case that motivated this) would reach agents as safe.

## Decision

- Every special-kind capability has an explicit entry in `CAPABILITY_META` (`src/mcp/CapabilityMetadata.ts`) that says whether it mutates and what its risk class is. A minimal entry is enough; a missing one is not.
- The test "every special-kind capability has an explicit, reviewed CapabilityMetadata.ts entry" in `src/mcp/CapabilityRegistry.test.ts` has zero tolerance. The contract-gap baseline `src/mcp/contract-gap-baseline.json` stays `[]`: a new gap is fixed, never added to the baseline.
- Prefer a method name the convention recognises over a special name plus metadata.

## Consequences

- A pull request that adds a facade method with an unconventional name adds its metadata entry in the same pull request.
- A reviewer checks that `mutating` and `riskClass` tell the truth, not that the test is green.
- Relaxing the test or growing the baseline needs a new record that supersedes this one.
