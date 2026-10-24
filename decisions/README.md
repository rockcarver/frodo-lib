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
| 0004 | [frodo-lib has an api layer, an ops layer and a facade, with shared code below them](0004-layers-and-dependency-direction.md) | accepted |
| 0005 | [Every platform object kind is an api module plus an ops module with one fixed shape](0005-module-placement-and-anatomy.md) | accepted |
| 0006 | [Facade methods follow the CRUDQ naming convention](0006-crudq-naming-for-facade-methods.md) | accepted |
| 0007 | [The api layer is named after the HTTP operation, the ops layer after CRUDQ](0007-api-layer-names-follow-the-http-operation.md) | accepted |
| 0008 | [Ops code throws FrodoError and prints through Console.ts](0008-errors-are-frodoerrors-and-output-goes-through-console.md) | accepted |
| 0009 | [Tests sit next to the module, in two kinds, and run on the sources](0009-tests-sit-next-to-the-code-and-replay-recorded-traffic.md) | accepted |
| 0010 | [Recorded HTTP traffic replays against any host, and the framework is a library feature](0010-recordings-replay-against-any-host.md) | accepted |
| 0011 | [Terminal and colour code lives in the library (deprecated)](0011-terminal-and-colour-code-in-the-library.md) | deprecated |
| 0012 | [The foundation and the api layer import from ops (deprecated)](0012-lower-layers-import-upward.md) | deprecated |
| 0013 | [Smaller places where the code departs from the documented conventions (deprecated)](0013-smaller-inconsistencies-with-the-documented-conventions.md) | deprecated |
