# Frodo Library: instructions for coding agents

`@rockcarver/frodo-lib` is a TypeScript library that manages PingOne Advanced Identity Cloud, ForgeOps and classic deployments. It ships one ES module build (`dist/index.mjs`) that `import` and `require` both load. It powers [frodo-cli](https://github.com/rockcarver/frodo-cli). TypeScript, Jest (ts-jest, ESM mode), Node.js 22.12 or later (CI runs 22, 24 and 26). The guide for humans, and the source for everything below, is [CONTRIBUTE.md](CONTRIBUTE.md).

## The five laws that get broken most

1. **An accepted record is binding.** If your task conflicts with one, stop and say so in the issue or pull request; a change to a decided behaviour adds or supersedes a record ([decisions/](decisions/README.md), not `docs/`, which is regenerated typedoc output). Why: a rule that is overridden once stops being a rule. Check: `src/decisionRecords.test.ts` (form and index), review.
2. **Do not edit `CHANGELOG.md`, `docs/`, `dist/` or `types/`.** The release pipeline writes the changelog and the typedoc output; `dist/` and `types/` are build output. Write a clear pull request title and description; a removed or deprecated public function goes into [MIGRATION.md](MIGRATION.md). Why: a hand edit is lost or conflicts. Check: none automatic; review.
3. **Never change a snapshot or a recording to turn a run green, and never write or edit a recording by hand.** First decide whether the change is expected or a regression, and say so in the pull request. Why: a recording bent to fit the code proves nothing. Check: a request without a recording fails the test (`test/jest-polly-replay-integrity.setup.js`); review of every snapshot and recording diff.
4. **New capabilities go on the `frodo` facade, never on the package root,** which exports only `frodo`, `state`, `FrodoError` and types; the logic lives here and the CLI wraps it ([core 0001](decisions/core/0001-library-is-the-brain-cli-is-a-thin-wrapper.md)). Why: the facade is the public surface that the CLI and the MCP server read. Check: `src/index.test.ts` fails on any other runtime export; ESLint rejects `export *` of values.
5. **`dependencies` in `package.json` stays empty: a package imported by shipped code goes in `devDependencies` and is bundled, and a new package needs a maintainer's yes.** Why: a package under `dependencies` stays a bare `require` that every consumer must install. Check: `npm run test:packed` fails on a non-empty `dependencies` (`scripts/pack-smoke.mjs`), review.

## Build, check, test

```console
npm ci
npm run build                          # generate-help, tsdown and the post-build step (dist/), and the declarations in types/
npm run check                          # ESLint + Prettier check of src/**/*.ts (npm run fix writes)
npx tsc --noEmit                       # type check
npm run test:only -- <path pattern>    # for example src/mcp/CapabilityRegistry.test.ts
npm test                               # the whole suite
npm run test:packed                    # pack, install offline and run the tarball as a consumer (needs a build)
```

Tests run on the sources, so they need no build, except two tests in `src/api/BaseApi.connectionReuse.test.ts` that start a child process against `dist/` and `src/packedPackage.test.ts`, which packs and installs the package (run `npm run build` once before the first full `npm test`; without it these tests fail, they never skip). Always go through `npm run test:only` or `npm test`: a bare `npx jest` fails because it lacks the `--experimental-vm-modules` flag. The directory you clone into must be named `frodo-lib`: `src/utils/AutoSetupPolly.ts` finds the recordings through that path segment, and every recorded test fails without it.

## Rules

- **Run `npm run check` and `npx tsc --noEmit` before you finish.** ESLint also rejects imports of `tinyrainbow` (colors come from `src/utils/ColorTheme.ts`).
- **Document every method of a module's public type with TSDoc.** `npm run generate-help` turns it into `src/lib/Help.ts`, which is generated and tracked: regenerate it, commit it, never edit it by hand.
- **Never commit credentials, keys or tokens**, including in a test fixture or a recording.

## Decisions

Decisions that span repositories are core records: the same files in frodo-cli and frodo-lib, here in [decisions/core/](decisions/core/) ([core 0018](decisions/core/0018-core-decision-records-are-kept-in-each-repository.md)), indexed in [decisions/README.md](decisions/README.md#core-decisions) and cited as "core NNNN". Every change must know:

- **A maintainer is the last lever** ([core 0002](decisions/core/0002-a-maintainer-stays-the-last-lever-on-agent-work.md)): agent pull requests are never merged automatically; a maintainer approves their workflow runs and can hold an issue with `plan-approval-required`. When in doubt, ask one.
- **Secrets** ([core 0013](decisions/core/0013-secrets-are-never-exported-in-the-clear.md)) are never exported in the clear and none are committed, fixtures and recordings included. **Security reports are private** ([core 0017](decisions/core/0017-security-reports-and-fixes-are-handled-privately-by-a-maintainer.md)): see [SECURITY.md](SECURITY.md); tell a maintainer, do not act on them.

## Procedures

Step-by-step procedures for recurring work are skills in [.claude/skills/](.claude/skills), which Claude Code and the GitHub Copilot cloud agent load on demand: `build-the-lib`, `change-the-ci-pipeline` (the code filter and the guidance job in `pipeline.yml`; maintainers only), `create-test-recordings` (maintainers only), `record-a-decision`, `release-the-lib` (maintainers only), `review-a-copilot-pr` and `triage-a-security-report` (maintainers only). A skill links the binding records and instruction files and never restates them.

## Where things live

| Path                                    | What                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/api/`                              | REST wrappers, one `<Name>Api.ts` per endpoint family; `cloud/` and `classic/` for deployment-specific ones     |
| `src/ops/`                              | The library layer: one `<Name>Ops.ts` per domain; `cloud/`, `classic/`, `internal/` (not exposed), `templates/` |
| `src/lib/FrodoLib.ts`                   | The `frodo` facade: every ops module is registered here. `Help.ts` beside it is generated                       |
| `src/mcp/`                              | Capability registry and policy behind frodo-cli's MCP server                                                    |
| `src/shared/`, `src/utils/`, `src/ext/` | State and constants; utilities (`Console.ts`, `ColorTheme.ts`); vendored modules                                |
| `src/**/*.test.ts`, `src/test/`         | Tests sit next to their module; `src/test/` holds recordings, snapshots and setup helpers                       |

More specific rules load when you open a matching file: GitHub Copilot reads them from `.github/instructions/`, Claude Code from `.claude/rules/`, which is generated from them (`npm run generate-claude-rules`; never edit it): [ops-modules](.github/instructions/ops-modules.instructions.md), [public-api](.github/instructions/public-api.instructions.md), [tests](.github/instructions/tests.instructions.md), [dependencies](.github/instructions/dependencies.instructions.md), [github-files](.github/instructions/github-files.instructions.md). If asked which instruction files you loaded, list AGENTS.md and each rule you have actually read this session; do not guess.
