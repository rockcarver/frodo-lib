# Decision records

A decision record explains one lasting decision: why we chose it, what it means and what we gave up. Records are plain Markdown in the repository, so every contributor and every coding agent, whatever tool it uses, reads the same thing.

This folder holds the decisions that concern **frodo-lib only**. Decisions that span repositories (frodo-cli, frodo-lib, the Homebrew tap) are in [rockcarver/frodo](https://github.com/rockcarver/frodo/tree/main/docs/decisions); the section "Decisions that span repositories" below states, in one sentence each, the ones that bind this repository.

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

## Decisions that span repositories

A decision that binds more than this repository is recorded once, in the public umbrella repository [rockcarver/frodo](https://github.com/rockcarver/frodo) (`docs/decisions/`). The Repo Concierge's gates read this repository only and never the umbrella, so each umbrella record that binds this repository is stated here in one sentence with a link. When a new umbrella record binds this repository, add its row in the same change set.

| Record | Rule | Status |
| - | - | - |
| [0001](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0001-library-is-the-brain-cli-is-a-thin-wrapper.md) | Business logic lives in frodo-lib behind the `frodo` facade, the library has no interface code, the CLI wraps it, and a new capability is built library first. | accepted |
| [0002](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0002-a-maintainer-stays-the-last-lever-on-agent-work.md) | Agent pull requests are never merged automatically; a maintainer approves their workflow runs and can hold an issue with the `plan-approval-required` label. | accepted |
| [0003](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0003-guidance-for-agents-and-contributors-lives-in-the-repository.md) | `AGENTS.md` is the single entry point and `CLAUDE.md` only imports it; accepted decision records bind humans and agents; guidance is public, with no credentials or tenant details. | accepted |
| [0004](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0004-the-repo-concierge-runs-the-issue-plan-and-pr-gates.md) | The Repo Concierge runs the issue, plan and PR gates from a pinned release; its managed files are never edited here and gate changes are made in the Concierge repository. | accepted |
| [0005](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0005-releases-are-started-by-a-maintainer-through-the-pipeline.md) | A release starts only when a maintainer runs the pipeline by hand; merging never releases and nobody edits `CHANGELOG.md` in a pull request. | accepted |
| [0006](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0006-published-packages-have-no-runtime-dependencies.md) | `dependencies` stays empty; packages imported by shipped code are `devDependencies` that the bundler inlines. | accepted |
| [0007](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0007-public-api-only-through-the-frodo-facade.md) | The package root exports only `frodo`, `state`, `FrodoError` and types; every capability is a method on the `frodo` facade, enforced by a test and a lint rule, and removals go into `MIGRATION.md`. | accepted |
| [0009](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0009-let-the-callback-handler-return-a-promise.md) | Proposed: the callback handler may return a promise, so the CLI can use its asynchronous prompt and drop the synchronous helper; not yet binding. | proposed |
| [0010](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0010-one-toolchain-tsdown-eslint-prettier-typescript-5-9.md) | One toolchain: tsdown, ESLint 10 with Prettier (Prettier owns formatting and import order; `npm run fix` writes, `npm run check` only reads) and TypeScript 5.9. | accepted |
| [0011](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0011-dependency-updates-merge-automatically-only-for-patch-and-minor.md) | Dependabot patch and minor updates merge automatically once the required checks pass; majors and the tooling set stay manual, and nothing else auto-merges. | accepted |
| [0012](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0012-merging-is-gated-by-a-stable-set-of-required-checks.md) | Merging needs `Build`, `Test gate` and one platform check; `paths-ignore` is never used on the pull-request trigger, and a pipeline change updates `PIPELINE.md` and `BUILD-ENV.md` in the same pull request. | accepted |
| [0013](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0013-secrets-are-never-exported-in-the-clear.md) | Secrets are never exported in the clear and stored credentials are encrypted; credential files get restrictive permissions; no credentials, keys or tokens in the repository, fixtures or recordings. | accepted |
| [0014](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0014-the-recording-framework-stays-on-polly-for-now.md) | Recordings stay on Polly; a replacement (nock or MSW) is deferred until Node 28 or a real breakage. | accepted |
| [0015](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0015-published-packages-ship-only-an-allowlist-of-files.md) | `package.json` has a `files` allowlist; developer documents, examples and test resources are not published. | accepted |
| [0016](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0016-changes-that-are-not-code-still-run-the-checks-that-validate-them.md) | Guidance files (entry points, records, skills, instruction files) count as non-code for the test matrix, but whatever a test validates runs the fast guidance job; a new validated path goes into `.github/scripts/classify-changes.sh`. | accepted |
| [0017](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0017-security-reports-and-fixes-are-handled-privately-by-a-maintainer.md) | Suspected vulnerabilities are reported privately (see `SECURITY.md`); a maintainer owns security reports and unsolicited security fixes, and coding agents and the Concierge do not act on them. | accepted |

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
