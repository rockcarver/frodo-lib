---
status: accepted
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - docs/decisions/core/**
  - decisions/core/**
repos:
  - rockcarver/frodo-cli
  - rockcarver/frodo-lib
---

# Core decision records are kept in each repository

## Context and problem statement

Decisions that bind more than one repository were recorded once, in the umbrella repository rockcarver/frodo. That repository holds no code, is seldom opened and has no branch protection, although it held the rules that matter most (core 0002, 0012, 0017). The Repo Concierge's gates read one repository only, so every repository also restated each umbrella record in a one-sentence table. A decision across two repositories took three pull requests, and nothing could check the links between them.

## Decision

- A decision that binds more than one repository is written once as a file in `core/` of every repository it binds: `docs/decisions/core/` in frodo-cli, `decisions/core/` in frodo-lib. The file is identical in each. A decision about one repository stays in that repository's own records.
- Core records are cited as "core NNNN" and linked by relative path. Their numbers count up from 0001 inside `core/`, are never reused and have no gaps. They are separate from the numbering of the repository's own records.
- An accepted core record is not edited. A new core record supersedes it, and the status change is made in every repository in the same change set.
- Each repository's decisions README lists the core records in its index with their `applies-to`, so the gates, which read one repository only, find them.
- A weekly check compares `core/` in frodo-cli and frodo-lib and fails on any difference or missing file.
- The umbrella repository rockcarver/frodo is archived. It stays readable as the history of core 0001 to 0017.
- This partly supersedes core 0003: only its sentence saying that decisions spanning repositories live in the umbrella repository. Every other rule of core 0003 stands.

## Consequences

- A core record costs one pull request per repository it binds, with the same file in each.
- Core 0001 to 0017 were copied from the umbrella without change, including their mentions of the umbrella. Read those as history.
- Core 0008 binds frodo-cli and the Homebrew tap, not frodo-lib. It is kept in both code repositories so that the two folders stay identical.

## Alternatives considered

- Keep the umbrella as the only copy: the gates cannot read it, and it needs its own protection and upkeep for the sake of a few files.
- Keep the umbrella and mirror it into each repository by automation: more machinery, and the dormant repository stays a dependency.
