# Decision records

A decision record explains one lasting decision: why we chose it, what it means and what we gave up. Records are plain Markdown in the repository, so every contributor and every coding agent, whatever tool it uses, reads the same thing.

This folder holds the decisions that concern **frodo-lib only**. Decisions that span repositories (frodo-cli, frodo-lib, the Homebrew tap) are in [rockcarver/frodo](https://github.com/rockcarver/frodo/tree/main/docs/decisions); `AGENTS.md` lists the ones that bind this repository.

The folder is `decisions/` at the repository root, not `docs/decisions/` as in the other repositories: `docs/` here is typedoc output that is regenerated at release time and would wipe the records.

## Rules

- An accepted record is binding for humans and agents until a newer record supersedes it. An agent whose task conflicts with one stops and says so in the issue or pull request.
- Only lasting decisions get a record: something you would be surprised to see reversed without discussion. Not minor implementation notes or routine refactors.
- An accepted record is not edited, except for typos. A changed decision is a new record: set the old record's status to `superseded by NNNN` and update the index.
- A pull request that changes a decided behaviour adds or supersedes a record in the same pull request.
- Records are public. No credentials, tenant names, security-incident details or personal information.
- `applies-to:` lists path globs where that helps; `issues:` lists related issues as `owner/repo#N`.

## Writing one

Copy `template.md` to `NNNN-short-title.md` (the next number), fill it in (aim for under 40 lines) and add a row to the index. Besides the three required sections, a record may have `## Known deviations` and `## Alternatives considered`. `npm run test:only -- src/decisionRecords.test.ts` checks the folder with `scripts/validate-decision-records.mjs`.

## Index

| # | Title | Status |
| - | - | - |
| 0001 | [Every special capability has a reviewed risk entry](0001-every-special-capability-has-a-reviewed-risk-entry.md) | accepted |
| 0002 | [HTTP tests replay recordings and a missing recording fails the test](0002-http-tests-replay-recordings-and-a-missing-recording-fails.md) | accepted |
| 0003 | [Method documentation is generated from TSDoc](0003-method-documentation-is-generated-from-tsdoc.md) | accepted |
