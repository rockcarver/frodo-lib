# Decision records

A decision record explains one lasting decision: why we chose it, what it means and what we gave up. Records are plain Markdown in the repository, so every contributor and every coding agent, whatever tool it uses, reads the same thing.

This folder holds the decisions that concern **frodo-lib only**. Decisions that span repositories (frodo-cli and frodo-lib) are core records in [core/](core/), the same files in each repository; the section "Core decisions" below indexes them.

The folder is `decisions/` at the repository root, not `docs/decisions/` as in the other repositories: `docs/` here is typedoc output that is regenerated at release time and would wipe the records.

## Rules

- An accepted record is binding for humans and agents until a newer record supersedes it. An agent whose task conflicts with one stops and says so in the issue or pull request.
- Only lasting decisions get a record: something you would be surprised to see reversed without discussion. Not minor implementation notes or routine refactors.
- An accepted record is not edited, except for typos. A changed decision is a new record: set the old record's status to `superseded by NNNN` and update the index.
- A pull request that changes a decided behaviour adds or supersedes a record in the same pull request.
- Records are public. No credentials, tenant names, security-incident details or personal information.
- `applies-to:` lists path globs where that helps; `issues:` lists related issues as `owner/repo#N`.

## Writing one

Copy `template.md` to `NNNN-short-title.md` (the next number), fill it in (aim for under 40 lines) and add a row to the index (a core record is written as the same file in each repository it binds: see the `record-a-decision` skill). Besides the three required sections, a record may have `## Known deviations` and `## Alternatives considered`. `npm run test:only -- src/decisionRecords.test.ts` checks the folder with `scripts/validate-decision-records.mjs`.

## Core decisions

A decision that binds more than one repository is a core record: the same file is kept in `core/` of every repository it binds, cited as "core NNNN" and numbered apart from this repository's own records ([core 0018](core/0018-core-decision-records-are-kept-in-each-repository.md)). The Repo Concierge's gates read this index and then the records whose `applies-to` matches a change, so a new core record that binds this repository gets its row here in the same change set.

| Number | Title | Status | Applies to |
| - | - | - | - |
| [core 0001](core/0001-library-is-the-brain-cli-is-a-thin-wrapper.md) | The library is the brain, the CLI is a thin wrapper | accepted | `src/ops/**` |
| [core 0002](core/0002-a-maintainer-stays-the-last-lever-on-agent-work.md) | A maintainer stays the last lever on agent work | accepted | repository-wide |
| [core 0003](core/0003-guidance-for-agents-and-contributors-lives-in-the-repository.md) | Guidance for agents and contributors lives in the repository | accepted | repository-wide |
| [core 0004](core/0004-the-repo-concierge-runs-the-issue-plan-and-pr-gates.md) | The Repo Concierge runs the issue, plan and PR gates | accepted | repository-wide |
| [core 0005](core/0005-releases-are-started-by-a-maintainer-through-the-pipeline.md) | Releases are started by a maintainer through the pipeline | accepted | repository-wide |
| [core 0006](core/0006-published-packages-have-no-runtime-dependencies.md) | Published packages have no runtime dependencies | accepted | `package.json`, `tsdown.config.*` |
| [core 0007](core/0007-public-api-only-through-the-frodo-facade.md) | The public API is only the frodo facade | accepted | `src/index.ts` |
| [core 0008](core/0008-homebrew-installs-prebuilt-release-binaries.md) | Homebrew installs prebuilt release binaries (binds frodo-cli and the tap, not this repository) | accepted | `Formula/**`, `tools/update-homebrew-formula.mjs` |
| [core 0009](core/0009-let-the-callback-handler-return-a-promise.md) | Let the callback handler return a promise | proposed | repository-wide |
| [core 0010](core/0010-one-toolchain-tsdown-eslint-prettier-typescript-5-9.md) | Both repositories use one toolchain: tsdown, ESLint 10 with Prettier, and TypeScript 5.9 | accepted | `package.json`, `tsdown.config.*`, `eslint.config.*` |
| [core 0011](core/0011-dependency-updates-merge-automatically-only-for-patch-and-minor.md) | Dependency updates merge automatically only when they are patch or minor | accepted | `.github/dependabot.yml`, `.github/workflows/dependabot-auto-merge.yml` |
| [core 0012](core/0012-merging-is-gated-by-a-stable-set-of-required-checks.md) | Merging into main is gated by a small, stable set of required checks | accepted | `.github/workflows/pipeline.yml` |
| [core 0013](core/0013-secrets-are-never-exported-in-the-clear.md) | Secrets are never exported in the clear, and stored credentials are encrypted | accepted | `src/ops/cloud/SecretsOps.ts`, `src/ops/TokenCacheOps.ts`, `src/ops/ConnectionProfileOps.ts` |
| [core 0014](core/0014-the-recording-framework-stays-on-polly-for-now.md) | The recording framework stays on Polly until Node 28 or a real breakage forces a change | accepted | `src/utils/SetupPollyForFrodoLib.ts` |
| [core 0015](core/0015-published-packages-ship-only-an-allowlist-of-files.md) | Published packages ship only an allowlist of files | accepted | `package.json` |
| [core 0016](core/0016-changes-that-are-not-code-still-run-the-checks-that-validate-them.md) | Changes that are not code still run the checks that validate them | accepted | `.github/workflows/pipeline.yml`, `.github/scripts/classify-changes.sh` |
| [core 0017](core/0017-security-reports-and-fixes-are-handled-privately-by-a-maintainer.md) | Security reports and fixes are handled privately by a maintainer | accepted | `SECURITY.md`, `.claude/skills/triage-a-security-report/**` |
| [core 0018](core/0018-core-decision-records-are-kept-in-each-repository.md) | Core decision records are kept in each repository | accepted | `docs/decisions/core/**`, `decisions/core/**` |

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
