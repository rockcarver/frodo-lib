---
name: build-the-lib
description: Take frodo-lib from a fresh clone to a working install, build, lint, type check and test run, and know what CI runs. Use when you set up the repository, when a build, lint or test command fails on a fresh checkout, when you regenerate generated files (src/lib/Help.ts, types/, docs/), when you check the capability registry after adding a facade method, or when you link a local library build into frodo-cli.
---

# Build the library

How to get a clean, working frodo-lib checkout and prove it. The rules behind the steps are in [AGENTS.md](../../../AGENTS.md) and [CONTRIBUTE.md](../../../CONTRIBUTE.md); the toolchain background is in [BUILD-ENV.md](../../../BUILD-ENV.md), the pipeline in [PIPELINE.md](../../../PIPELINE.md). This skill does not repeat them, it gives the order of the steps and the traps.

Records that bind this procedure: [decisions/0001](../../../decisions/0001-every-special-capability-has-a-reviewed-risk-entry.md) (capability registry), [decisions/0002](../../../decisions/0002-http-tests-replay-recordings-and-a-missing-recording-fails.md) (recordings and snapshots), [decisions/0003](../../../decisions/0003-method-documentation-is-generated-from-tsdoc.md) (`Help.ts` is generated). Instruction files that load when you edit: [dependencies](../../../.github/instructions/dependencies.instructions.md) and [tests](../../../.github/instructions/tests.instructions.md).

## 1. Prerequisites

- Node.js 22 or later (CI runs 22, 24 and 26; `engines` allows 20 or later) with the npm that ships with it.
- `.nvmrc` still says 18.17.0, which contradicts `engines` and CI: do not trust `nvm use` without an argument, pick 22 or later yourself.
- Clone into a directory named exactly `frodo-lib`. `src/utils/AutoSetupPolly.ts` finds the recordings through the last `frodo-xxx` path segment (`xxx` is any three word characters), so any other name breaks every recorded test. Checked: a clone named `frodo-lib-2` failed 29 of the 39 tests in `src/api/AgentApi.test.ts` with "Polly replay integrity check failed". A suffixed name next to a real `frodo-lib` clone hides the problem, because it silently reads (and when recording, writes) the sibling's recordings. Give a second checkout its own parent folder instead: `~/work/issue-123/frodo-lib`.

## 2. Install

```console
git clone https://github.com/rockcarver/frodo-lib.git
cd frodo-lib
npm ci
```

- Use `npm ci`, not `npm install`: the lockfile is the reference and `npm install` can rewrite it.
- Never `npm ci --ignore-scripts`. The `postinstall` script (`scripts/patch-axios-types.cjs`) fixes axios's type entry; without it `npm run build` fails with "CommonJS dts modules cannot be bundled by rolldown-plugin-dts" (checked). Repair: `node scripts/patch-axios-types.cjs`, then build again. Background: BUILD-ENV.md section 2.3.
- Recent npm versions print "install scripts blocked" for `@parcel/watcher` and `unrs-resolver`. The build and the tests work without them (checked), leave them blocked.

## 3. Build

```console
npm run build
```

It runs `generate-help`, `tsdown`, `clean-types` and `generate-types` and takes seconds. Results: `dist/index.js` (CJS), `dist/index.mjs` (ESM) with declarations, and `types/` (the deprecated deep-import type tree). `dist/` and `types/` are gitignored build output.

How you know it worked:

- `git status` is clean afterwards. `src/lib/Help.ts` is regenerated on every build; a diff there means your TSDoc or method changes are not committed yet (see "Generated files").
- After any change to the dependency graph, both of these print `0` (see the dependencies instruction file):

  ```console
  grep -c 'require("@' dist/index.js
  grep -c 'from "@' dist/index.mjs
  ```

## 4. Lint and type check

```console
npm run check          # ESLint plus Prettier --check on src/**/*.ts
npx tsc --noEmit       # type check
npm run fix            # writes the fixes ESLint and Prettier can make
```

`check` only covers `src/**/*.ts` (test files that sit in `src/` included). Markdown, JSON, `scripts/` and the root `test/` folder are not checked, so review those by hand. Prettier owns import order, do not reorder imports against it.

## 5. Test

```console
npm run test:only -- src/mcp/CapabilityRegistry.test.ts    # a subset, by path pattern
npm test                                                   # everything
```

- Always go through these scripts. A bare `npx jest` fails before running anything with `TypeError: Cannot read properties of undefined (reading 'resolve')`, because the `--experimental-vm-modules` flag is missing (checked).
- Tests run on the sources, with one exception: two tests in `src/api/BaseApi.connectionReuse.test.ts` start a child process against `dist/index.js`. Run `npm run build` once in a fresh clone before the first full `npm test`. Without a build exactly those two fail and everything else passes (checked: 160 of 161 suites). CI builds first.
- The full suite takes about half a minute on a laptop (161 suites, about 2,490 tests and 888 snapshots when this was written; the counts drift).
- A failing run writes `frodo-lib-jest-exceptions.log` (gitignored); CI prints it on failure.
- Two kinds of tests exist: recorded tests (`autoSetupPolly()`, replay HTTP from `src/test/mock-recordings`) and `*.unit.test.ts` files that inject fakes. A recorded test that cannot find its recording fails (decisions/0002). Do not run `npm run test:update` or any `test:record*` script to get a run green: decide first whether a snapshot change is expected or a regression, and say so in the pull request. Recording needs a tenant: see the create-test-recordings skill (maintainers only).
- CI also runs the whole suite once more through a proxy (`HTTPS_PROXY` pointing at a squid container). You cannot reproduce that leg without a proxy, so a failure that only shows there needs one to reproduce.

If a test fails, classify it before you touch anything: caused by your change, flaky, or already failing on a clean checkout of `main`. Run the same test on a clean clone to tell the last two apart.

## 6. Generated files

| File or folder        | Command                    | In git? | Rule |
| --------------------- | -------------------------- | ------- | ---- |
| `src/lib/Help.ts`     | `npm run generate-help`    | yes     | Regenerate and commit it with the change that caused it. Never edit by hand. Every method of an ops module's public type needs TSDoc (`@param`, `@returns`), that is the source (decisions/0003). |
| `dist/`, `types/`     | `npm run build`            | no      | Build output. |
| `docs/` (typedoc)     | `npm run doc`              | yes     | The release job regenerates and commits it. A pull request never does. `npm run doc` rewrites about 500 tracked files and also deletes anything else under `docs/` (checked with a test folder), which is why decision records live in `decisions/`. If you ran it: `git checkout -- docs && git clean -fd docs`. |
| `CHANGELOG.md`        | none                       | yes     | Generated at release time from what merged. Do not edit. |

A removed or deprecated public function is a [MIGRATION.md](../../../MIGRATION.md) item.

## 7. Capability registry

After adding, renaming or removing a method on the `frodo` facade:

```console
npm run test:only -- src/mcp/CapabilityRegistry.test.ts
npm run mcp:contract-gap-summary
```

- Name methods with the CRUDQ prefixes (`create`, `read`, `update`, `delete`, `query`, `search`, `list`, `count`, `export`, `import`; `get`/`set` for one property; `enable`/`disable` for status) and the registry infers what they do.
- Any other name is a special capability and needs an explicit entry in `src/mcp/CapabilityMetadata.ts` that says truthfully whether it mutates and what its risk class is. The test fails until it exists, and it has zero tolerance.
- Never add to `src/mcp/contract-gap-baseline.json`; it stays `[]`. The gap summary prints empty tables when there are no gaps.

## 8. Use your build in frodo-cli

Put the two clones side by side (`frodo-cli` and `frodo-lib` in the same parent folder). In `frodo-cli` run its `link` script, which does this:

```console
npm link ../frodo-lib
```

- `npm link <path>` links the library into the global npm prefix as well as into the CLI, so it re-points a `@rockcarver/frodo-lib` link you may already have from another clone. Check where it points with `npm ls -g --depth=0 --link`.
- The CLI consumes `dist/` through the package exports map. After every library change run `npm run build` in `frodo-lib`, then rebuild the CLI; the CLI's `npm run dev` does not pick up library rebuilds.
- To go back to the library version pinned in the CLI's lockfile, run `npm ci` in `frodo-cli` (checked in a throwaway project: it replaces the link with the registry copy).
- Linking is a local development convenience. The CLI pins an exact library version in its `package.json`, so a CLI change that needs a new library method waits for a library release.

## 9. What CI runs

`.github/workflows/pipeline.yml` (described in PIPELINE.md):

- **Detect code changes**, then **Build**: `npm ci`, `npm run build`, `npm run doc` (output not committed), `npm run check`, a critical-level audit.
- **Test (26, 24, 22)**: `npm test` directly and once more through a proxy, then `npm audit --omit=dev --audit-level high`; **Test gate** aggregates the matrix.
- **Cross-Platform Tests**: a subset of the credential-file-permission tests on Linux, macOS and Windows; **Cross-Platform gate** aggregates them.
- Release jobs only run when a maintainer starts the pipeline by hand (umbrella decision 0005, see AGENTS.md).

Before you open a pull request run what Build and Test run: `npm run build`, `npm run check`, `npx tsc --noEmit` and `npm test`.

## Stop and ask when

- The build fails on a clean tree with Node 22 or later and the right directory name, and BUILD-ENV.md does not explain it.
- A snapshot or recording changed and you cannot say why.
- Your change needs a new package: `dependencies` stays empty and a shipped import goes in `devDependencies` (dependencies instruction file), which a maintainer should confirm.
