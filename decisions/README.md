# Decision records

A decision record explains one lasting decision: why we chose it, what it means and what we gave up. Records are plain Markdown in the repository, so every contributor and every coding agent, whatever tool it uses, reads the same thing.

This folder holds the decisions that concern **frodo-lib only**. Decisions that span repositories (frodo-cli and frodo-lib) are core records in [core/](core/), the same files in each repository; the section "Core decisions" below indexes them.

The folder is `decisions/` at the repository root, not `docs/decisions/` as in the other repositories: `docs/` here is typedoc output that is regenerated at release time and would wipe the records.

## Rules

- An accepted record is binding for humans and agents until a newer record supersedes it. An agent whose task conflicts with one stops and says so in the issue or pull request.
- Only lasting decisions get a record: something you would be surprised to see reversed without discussion. Not minor implementation notes or routine refactors.
- An accepted record is not edited, except for typos and for a `Known deviations` section, a status note that may be added, edited or removed, without a new record, in the pull request that fixes the deviation or opens its tracking issue ([core 0018](core/0018-core-decision-records-are-kept-in-each-repository.md)). A changed decision is a new record: set the old record's status to `superseded by NNNN` and update the index.
- A pull request that changes a decided behaviour adds or supersedes a record in the same pull request.
- Records are public. No credentials, tenant names, security-incident details or personal information.
- Write a record so it stays true: state the rule, not a value that changes. Leave out "currently", "now", "the latest" and any current version, count, size or line number. Say "e.g." or "for example" when an example helps, and date a fact that explains the decision ("on 2026-10-24 the pin was ..."). An accepted record is not edited to keep up with such a fact, so it must not contain one.
- `applies-to:` lists path globs where that helps; `issues:` lists related issues as `owner/repo#N`.

## Writing one

Copy `template.md` to `NNNN-short-title.md` (the next number), fill it in (aim for under 40 lines) and add a row to the index (a core record is written as the same file in each repository it binds: see the `record-a-decision` skill). Besides the three required sections, a record may have `## Known deviations` and `## Alternatives considered`. `npm run test:only -- src/decisionRecords.test.ts` checks the folder with `scripts/validate-decision-records.mjs`.

## Core decisions

A decision that binds more than one repository is a core record: the same file is kept in `core/` of every repository it binds, cited as "core NNNN" and numbered apart from this repository's own records ([core 0018](core/0018-core-decision-records-are-kept-in-each-repository.md)). The Repo Concierge's gates read this index and then the records whose `applies-to` matches a change, so a new core record that binds this repository gets its row here in the same change set.

| Number | Title | Status | Applies to | Rule |
| - | - | - | - | - |
| [core 0001](core/0001-library-is-the-brain-cli-is-a-thin-wrapper.md) | The library is the brain, the CLI is a thin wrapper | accepted | `src/ops/**` | Business logic lives in frodo-lib behind the `frodo` facade, the library has no interface code, the CLI wraps it, and a new capability is built library first. |
| [core 0002](core/0002-a-maintainer-stays-the-last-lever-on-agent-work.md) | A maintainer stays the last lever on agent work | accepted | repository-wide | Agent pull requests are never merged automatically; a maintainer approves their workflow runs and can hold an issue with the `plan-approval-required` label. |
| [core 0003](core/0003-guidance-for-agents-and-contributors-lives-in-the-repository.md) | Guidance for agents and contributors lives in the repository | accepted | repository-wide | `AGENTS.md` is the single entry point and `CLAUDE.md` only imports it; accepted decision records bind humans and agents; guidance is public, with no credentials or tenant details. |
| [core 0004](core/0004-the-repo-concierge-runs-the-issue-plan-and-pr-gates.md) | The Repo Concierge runs the issue, plan and PR gates | accepted | repository-wide | The Repo Concierge runs the issue, plan and PR gates from a pinned release; its managed files are never edited here and gate changes are made in the Concierge repository. |
| [core 0005](core/0005-releases-are-started-by-a-maintainer-through-the-pipeline.md) | Releases are started by a maintainer through the pipeline | accepted | repository-wide | A release starts only when a maintainer runs the pipeline by hand; merging never releases and nobody edits `CHANGELOG.md` in a pull request. |
| [core 0006](core/0006-published-packages-have-no-runtime-dependencies.md) | Published packages have no runtime dependencies | accepted | `package.json`, `tsdown.config.*` | `dependencies` stays empty; packages imported by shipped code are `devDependencies` that the bundler inlines. |
| [core 0007](core/0007-public-api-only-through-the-frodo-facade.md) | The public API is only the frodo facade | accepted | `src/index.ts` | The public API is only the `frodo` facade; the CLI imports library values only from `frodo`, `state`, `FrodoError` and types (an ESLint rule), and removals go into `MIGRATION.md`. |
| [core 0008](core/0008-homebrew-installs-prebuilt-release-binaries.md) | Homebrew installs prebuilt release binaries (binds frodo-cli and the tap, not this repository) | accepted | `Formula/**`, `tools/update-homebrew-formula.mjs` | Homebrew formulas install the prebuilt release zip pinned by sha256; `tools/update-homebrew-formula.mjs` generates them and the pipeline commits them to the tap, never by hand. |
| [core 0009](core/0009-let-the-callback-handler-return-a-promise.md) | Let the callback handler return a promise | proposed | repository-wide | Proposed: the callback handler may return a promise, so the CLI can use its asynchronous prompt and drop the synchronous helper; not yet binding. |
| [core 0010](core/0010-one-toolchain-tsdown-eslint-prettier-typescript-5-9.md) | Both repositories use one toolchain: tsdown, ESLint 10 with Prettier, and TypeScript 5.9 | accepted | `package.json`, `tsdown.config.*`, `eslint.config.*` | One toolchain: tsdown, ESLint 10 with Prettier (Prettier owns formatting and import order; `npm run fix` writes, `npm run check` only reads) and TypeScript 5.9. |
| [core 0011](core/0011-dependency-updates-merge-automatically-only-for-patch-and-minor.md) | Dependency updates merge automatically only when they are patch or minor | accepted | `.github/dependabot.yml`, `.github/workflows/dependabot-auto-merge.yml` | Dependabot patch and minor updates merge automatically once the required checks pass; majors and the tooling set stay manual, and nothing else auto-merges. |
| [core 0012](core/0012-merging-is-gated-by-a-stable-set-of-required-checks.md) | Merging into main is gated by a small, stable set of required checks | accepted | `.github/workflows/pipeline.yml` | Merging needs `Build`, `Test gate` and one platform check; `paths-ignore` is never used on the pull-request trigger, and a pipeline change updates `PIPELINE.md` and `BUILD-ENV.md` in the same pull request. |
| [core 0013](core/0013-secrets-are-never-exported-in-the-clear.md) | Secrets are never exported in the clear, and stored credentials are encrypted | accepted | `src/ops/cloud/SecretsOps.ts`, `src/ops/TokenCacheOps.ts`, `src/ops/ConnectionProfileOps.ts` | Secrets are never exported in the clear and stored credentials are encrypted; credential files get restrictive permissions; no credentials, keys or tokens in the repository, fixtures or recordings. |
| [core 0014](core/0014-the-recording-framework-stays-on-polly-for-now.md) | The recording framework stays on Polly until Node 28 or a real breakage forces a change | accepted | `src/utils/SetupPollyForFrodoLib.ts` | Recordings stay on Polly; a replacement (nock or MSW) is deferred until Node 28 or a real breakage. |
| [core 0015](core/0015-published-packages-ship-only-an-allowlist-of-files.md) | Published packages ship only an allowlist of files | accepted | `package.json` | `package.json` has a `files` allowlist; developer documents, examples and test resources are not published. |
| [core 0016](core/0016-changes-that-are-not-code-still-run-the-checks-that-validate-them.md) | Changes that are not code still run the checks that validate them | accepted | `.github/workflows/pipeline.yml`, `.github/scripts/classify-changes.sh` | Guidance files (entry points, records, skills, instruction files) count as non-code for the test matrix, but whatever a test validates runs the fast guidance job; a new validated path goes into `.github/scripts/classify-changes.sh`. |
| [core 0017](core/0017-security-reports-and-fixes-are-handled-privately-by-a-maintainer.md) | Security reports and fixes are handled privately by a maintainer | accepted | `SECURITY.md`, `.claude/skills/triage-a-security-report/**` | Suspected vulnerabilities are reported privately (see `SECURITY.md`); a maintainer owns security reports and unsolicited security fixes, and coding agents and the Concierge do not act on them. |
| [core 0018](core/0018-core-decision-records-are-kept-in-each-repository.md) | Core decision records are kept in each repository | accepted | `docs/decisions/core/**`, `decisions/core/**` | A decision that binds more than one repository is one identical file in `core/` of every repository it binds, cited as "core NNNN"; a weekly check compares the copies, a Known deviations section is a status note the pull request that fixes the deviation may edit, and the umbrella repository is archived. |
| [core 0019](core/0019-experimental-features-are-not-bound-by-compatibility-records.md) | Experimental features are not bound by compatibility records | accepted | repository-wide | A feature that says it is experimental before release may change or lose commands, options and output in any release; no compatibility rule (the 4.x promise, MIGRATION.md) binds it, every other rule does. |

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
| 0014 | [A recording of a wait may be trimmed of its repeated polls](0014-a-recording-of-a-wait-may-be-trimmed-of-its-repeated-polls.md) | proposed |
