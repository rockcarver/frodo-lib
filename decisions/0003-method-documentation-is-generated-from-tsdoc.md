---
status: accepted
date: 2026-03-19
decision-makers:
  - maintainers
applies-to:
  - src/ops/**
  - src/lib/Help.ts
---

# Method documentation is generated from TSDoc

## Context and problem statement

Consumers such as frodo-cli and its single-binary build need the help for every facade method (signature, description, parameters) without reading source files at runtime. Keeping a second copy of that text by hand would drift from the code.

## Decision

- TSDoc on each ops module's public type is the single source of method documentation. Every method of that type gets TSDoc.
- `scripts/generate-help.mjs` (`npm run generate-help`, also the first step of `npm run build`) parses `src/ops/**` and `src/utils/**` and writes `src/lib/Help.ts`, which `src/utils/HelpUtils.ts` serves.
- `src/lib/Help.ts` is generated and tracked. Regenerate it and commit it with the change that caused it. Nobody edits it by hand.

## Consequences

- Adding, renaming or documenting a method means regenerating `Help.ts` in the same pull request; a hand edit is overwritten and a stale file ships stale help.
- A reviewer expects the `Help.ts` diff to follow from the TSDoc diff and nothing else.
