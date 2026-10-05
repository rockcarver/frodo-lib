# Frodo Library — Toolchain and Build Environment

This document explains every piece of frodo-lib's toolchain: what it does,
why it is the way it is, and the details you need when something breaks. It
is the companion to [PIPELINE.md](PIPELINE.md); the CLI keeps its own copy
(`docs/BUILD-ENV.md` there) for the pieces that differ (binary packaging,
SEA, Homebrew).

_Last updated: 2026-10-05 (v5.0.0-1 premajor train)._

---

## 1. The 30-second map

```
TypeScript sources (src/)
  │
  ├─ jest 30 .............. test (test counts shift with the suite; see §4)
  │
  ├─ generate-help ........ scripts/generate-help.mjs (help data for frodo-cli)
  ├─ tsdown (rolldown) .... bundle src/index.ts -> dist/index.{js,mjs} + dts
  ├─ tsc .................. emit types/ (the public type surface)
  │
  ├─ typedoc .............. docs/ (GitHub Pages on release)
  │
  └─ eslint + prettier .... lint & format (ESLint 10 native flat config; Prettier owns import order via the ianvs sort-imports plugin)

Dependency/replacement history (2026-10):
  esprima->acorn, jwk-to-pem->node:crypto, replaceall->String.replaceAll,
  node-jose->jose, node-forge->@peculiar/x509, tsup->tsdown

Release automation:
  ├─ dependabot.yml + dependabot-auto-merge.yml
  ├─ ruleset "main-branch-protection": Build + Test gate + Cross-Platform Tests required
  └─ pipeline.yml: version bump -> build -> test -> npm trusted publish -> release -> Pages docs
```

---

## 2. Bundler: tsdown (replaced tsup 2026-10)

**What it does**: bundles `src/index.ts` into a hybrid package:

| Output                       | Format   | Role                                                                                                                                                                                             |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dist/index.js`              | CJS      | `"require"` condition (~6.6 MB)                                                                                                                                                                  |
| `dist/index.mjs`             | ESM      | `"import"` condition (~6.5 MB)                                                                                                                                                                   |
| `dist/index.d.ts` / `.d.mts` | dts      | type surface (tsdown, oxc resolver). Since #687 (4.12.0), re-exports all 120 data-model type names from the root entry — this is the supported consumer type surface                             |
| `types/`                     | tsc emit | the full per-file public type tree (kept on tsc deliberately — same emitter as before, per plan). Serves the deprecated `./types/*` deep-import subpath; scheduled for removal in a future major |

**Why tsdown**: tsup is unmaintained and had a real defect (below). Build
time dropped from ~3.0 s to ~1.75 s. Verified at migration: 62/62 export
keys identical to a fresh tsup build, `are-the-types-wrong` all green.

### 2.1 The tsup defect (why the migration was not optional)

With tsup's default `splitting: true`, CJS output was produced by building
ESM then converting via **sucrase**, whose class-field lowering corrupted
comma-sequenced constructor bodies (jose error classes) into invalid JS —
`SyntaxError: Unexpected token ','` at require time. Workaround
(`splitting: false` for CJS) shipped in #672; the real fix is tsdown (#674).

### 2.2 tsdown configuration facts (the ones that bite)

- **Config must be `tsdown.config.mts`** — this repo is `"type": "commonjs"`
  and Node 24's config loader cannot load an ESM-syntax `.ts` config here
  (the CLI, being `"type": "module"`, uses plain `.ts`).
- Two config objects are exported: ESM (splitting on, default) and CJS
  (`outputOptions: { codeSplitting: false }` — keeps `dist/index.js` a
  single file).
- `dts: { resolver: 'oxc' }` is ~5× faster than `tsc`; `fixedExtension:
false` preserves the `.js`/`.mjs` naming consumers already resolve.
- `deps.neverBundle` lists every devDependency (tsup bundled them too —
  that is why this repo has no `dependencies` field yet effectively ships
  runtime deps inside the bundle).
- `target: 'es2022'`.

### 2.3 The axios dts patch (postinstall — do not remove)

rolldown-plugin-dts **cannot bundle CommonJS `.d.cts` declaration files**,
and axios's exports map sends `require`-condition type resolution to
`index.d.cts`. `scripts/patch-axios-types.cjs` (registered as
`postinstall`) rewrites the require condition's `types` entry to
`./index.d.ts` inside `node_modules/axios/package.json` — idempotent, exits
0 when axios is absent (consumer installs from the packed tarball do not
have it: axios is bundled, not a runtime dependency). If the dts build ever
fails with "CommonJS dts modules cannot be bundled", this patch is the
first thing to check. The CLI does not need this (it does not bundle dts).

### 2.4 Side effect fixed: the ESM entry

tsup's `dist/index.mjs` threw `Dynamic require of "util" is not supported`
on import (unnoticed; all known consumers use CJS). tsdown's ESM output
imports cleanly (verified: namespace import exposes all 62 keys). Note the
ESM surface is a namespace — there is no `default` export; import named
members.

---

## 3. TypeScript

- Lib: `5.9` (exact pin; PR #668). CLI aligned to `^5.9.3`.
- Policy: stay on 5.9.x. Do **not** adopt TS 6/7 until `typedoc` (≤6.0),
  `typescript-eslint` (<6.1) and `ts-jest` (<7) accept them.
- `npm run build` = `generate-help && tsdown && clean-types && generate-types`:
  help data first (it feeds the bundle), then the bundle, then the tsc
  `types/` tree. `generate-types` = `tsc` (deliberately unchanged from the
  pre-tsdown emitter — the public type surface is byte-compatible) followed
  by `scripts/deprecate-types-subpath.cjs`, which stamps the formal
  `@deprecated` banner for the `./types/*` subpath onto every generated
  declaration file (idempotent).

### 3.1 Type surface (post #687, 4.12.0)

- `src/index.ts` carries ~230 lines of explicit `export type {...} from
'./module'` blocks re-exporting the 120 data-model type names consumers
  (frodo-cli) actually import. Before #687, those names were
  declared-but-unexported in `dist/index.d.ts` (TS2459 for deep-import
  consumers).
- The `./types/*` exports subpath (restored in #685 after the #676 allowlist
  dropped it) is DEPRECATED: it only resolves under `moduleResolution:
node` (node10), which TypeScript 6 deprecates and 7 removes. Consumers
  should import from the root entry. Removal is planned for a future
  major (5.0.0 stable notes carry the deprecation).
- Known d.ts imperatives for 5.0.0 cleanup: `dist/index.d.ts` line 1
  `import { Reader } from "properties-reader"` is unresolvable for
  external consumers (properties-reader is a devDependency), and the d.ts
  maps point at unpublished `src/` paths. Two TS2411 index-signature
  errors (sessionToken, installedVersion) are pre-existing.

---

## 4. Tests: jest 30 + Polly

- jest 30.x, `--experimental-vm-modules` (ESM-mode TS via ts-jest).
- jest 30.5 exposed a real circular import (`FrodoLib` ↔ `SecretsOps`) that
  crashed module init under ESM — fixed in #670 with a dynamic import.
- Recording: `test:record` / `test:record_noauth` (Polly replay/record
  modes, cassettes in `test/`).
- jose 6 specifics baked into tests: `importJWK(..., { extractable: true })`
  for private keys, `createLocalJWKSet` for JWKS kid selection,
  `importPKCS8` for the amster PEM flow.
- `@peculiar/x509` requires `reflect-metadata` imported first (tsyringe) —
  test suites that build certificates import it explicitly.
- Full suite: 153 suites / 2,404 tests / 888 snapshots (~3 min) after the v5 deprecation-removal sweep — counts drift with API surface, so treat them as indicative.
- NOTE (2026-10): the Polly stack is unmaintained (2023). A nock/MSW spike
  (2026-10-03) proved replay fidelity on the gnarliest recording (425/425
  exact via a ~60-line HAR converter) but found deep Polly coupling in the
  record-mode harness (`SetupPollyForFrodoLib.ts` per-host routing, shared
  auth cassette, 28 directives); migration DEFERRED — revisit when Node 28
  or a real breakage forces it.
- Dev-tree security pins (2026-10, #679): `qs` bumped to ^6.16.0 (direct
  devDep) and a root-level npm `overrides` pins `basic-ftp` to 6.2.1 (the
  advisory chain `proxy-agent → get-uri → basic-ftp` has no upstream fix).
  Production tree is clean; keep overrides root-level — nested scoped
  overrides produce locks that `npm ci` on npm 10 rejects.

---

## 5. Lint and format (since 2026-10)

**ESLint 10** with native flat config in `eslint.config.js`
(`typescript-eslint` 8.x, no `FlatCompat` — 10 has no compat layer).
Plugins: `@typescript-eslint` (type-checked rules on `src/**/*.ts` via
`parserOptions.project`), `eslint-plugin-import-x` (successor of the
unmaintained `eslint-plugin-import`). `@eslint/js` recommended as the base.

**Prettier owns import order.** `@ianvs/prettier-plugin-sort-imports` runs as
a Prettier plugin (`plugins` in `.prettierrc`), with
`importOrder: ["^node:", "<BUILTIN_MODULES>", "<THIRD_PARTY_MODULES>", "^[./]"]`.
ESLint no longer checks import order (`import-x/first`, `import-x/no-duplicates`
and `import-x/newline-after-import` are the only import rules) — the sorter
and the linter can no longer disagree. Note: in plugin ≥4.7 the old
`importOrderSeparation` / `importOrderSortSpecifiers` options no longer exist;
group separation and specifier sorting are always on.

**Removed plugins**: `eslint-plugin-prettier` (running Prettier as an ESLint
rule made lint slow and turned formatting errors into lint errors),
`eslint-plugin-simple-import-sort`, `eslint-plugin-jest`, `eslint-plugin-import`,
and the standalone `@typescript-eslint/eslint-plugin`/`parser` packages
(`typescript-eslint` provides them). Prettier is pinned exactly — a minor
bump reformats dozens of files.

**Scripts**: `npm run fix` = `eslint --fix && prettier --write "src/**/*.ts"`
(prettier last, so it wins), `npm run check` = `eslint && prettier --check`,
and `lint` / `lint:fix` alias them. CI runs `npm run check`.

**ESLint 10 findings fixed in the migration** (~25): dead initializers on
`let` declarations (`no-useless-assignment`), `preserve-caught-error`
(rethrown errors now carry `{ cause }`), and unused eslint-disable
directives.

---

## 6. npm package contents

`files` allowlist (2026-10): `dist`, `scripts/patch-axios-types.cjs`
(**required** — it is the postinstall hook), LICENSE, README, CHANGELOG —
13 files instead of 450. Dropped from the tarball: the `types/` tree
(consumers resolve `dist/index.d.ts` via the exports map; `types/` was an
internal duplicate surface), `examples/` with their lockfiles, scripts not
needed at install, `RECORD_REPLAY.md`, `CONTRIBUTE.md`. Verified: packed
tarball installs and imports cleanly in CJS and ESM modes; postinstall
gracefully skips when axios is absent.

---

## 7. CI/CD pipeline (summary; details in PIPELINE.md)

`pipeline.yml` — PRs and pushes validate; releases are manual
`workflow_dispatch` (prerelease/premajor/patch/minor/major, dry-run
supported). `premajor` (added #688) starts/continues an X.0.0-1 prerelease
train for the next major — the action maps it to `is_prerelease=true` +
`publish_tag=next`, so the dual-release block, GitHub release prerelease
flag, and changelog action all handle it without further gating.

Jobs: Build (deep checkout with tags, version bump, build + typedoc into
`build.zip`) → Test (Node 22/24/26 + cross-platform credential-file
permission tests; consumes `build.zip`) → npm trusted publish (dual
publish: prerelease to `next`, stable to `latest`) → Release (changelog,
tag, GitHub release) → Doc (Pages).

**Branch protection**: ruleset `main-branch-protection` requires `Build`,
`Test gate`, `Cross-Platform Tests (Credential File Permissions)`. The
`Test gate` job is a stable-named aggregator over the versioned matrix so
Node changes never touch the ruleset. `github-actions[bot]` cannot be a
ruleset bypass actor (only org-owned apps / repository roles); GITHUB_TOKEN
pushes attribute to the dispatching user, so the admin-role bypass covers
release bot commits.

**paths-ignore**: deliberately absent from `pull_request` triggers — a PR
whose required checks never run could never merge.

---

## 8. Dependency automation

- `dependabot.yml`: weekly npm + github-actions; grouped dev minor/patch;
  prettier/typescript/eslint excluded (Prettier minors reformat code; TS/
  ESLint majors need coordinated config work); TS majors ignored.
- `dependabot-auto-merge.yml`: arms `gh pr merge --auto --squash` on
  patch/minor Dependabot PRs once checks pass; majors and tooling stay
  manual. (Dependabot "rules" in settings only triage alerts.)
- Known GitHub quirk (hit 3× on 2026-10-03): mergeability lags behind green
  check-runs — combined commit status `pending` with 0 statuses,
  `mergeStateStatus` BLOCKED/UNKNOWN despite all-success check-runs. Wait
  and retry; admin merge is legitimate once all-green is verified via the
  check-runs API.

---

## 9. Maintenance history (what changed when)

| Date       | Change                                                                                                                                                                                                                                                              | PR              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-10-02 | Dependabot configs fixed (were empty template); security updates + secret scanning on                                                                                                                                                                               | #653            |
| 2026-10-02 | esprima→acorn, jwk-to-pem→node:crypto, replaceall→String.replaceAll, dead deps removed                                                                                                                                                                              | #671            |
| 2026-10-02 | node-jose→jose; tsup sucrase workaround                                                                                                                                                                                                                             | #672            |
| 2026-10-02 | node-forge→@peculiar/x509                                                                                                                                                                                                                                           | #673            |
| 2026-10-03 | FrodoLib↔SecretsOps circular import fixed (unblocks jest 30.5)                                                                                                                                                                                                      | #670            |
| 2026-10-03 | paths-ignore removed from PR trigger; Test gate added                                                                                                                                                                                                               | #669            |
| 2026-10-03 | tsup→tsdown + axios dts postinstall patch                                                                                                                                                                                                                           | #674            |
| 2026-10-03 | Branch protection ruleset active                                                                                                                                                                                                                                    | (repo settings) |
| 2026-10-03 | Dependabot auto-merge workflow                                                                                                                                                                                                                                      | #675            |
| 2026-10-03 | TypeScript 5.8→5.9                                                                                                                                                                                                                                                  | #668            |
| 2026-10-03 | npm `files` allowlist                                                                                                                                                                                                                                               | this PR         |
| 2026-10-03 | ESLint 9→10 (native flat config), Prettier-owns-imports via `@ianvs/prettier-plugin-sort-imports`; `eslint-plugin-prettier`, `simple-import-sort`, `jest`, `import` plugins removed; scripts `fix`/`check`; ~25 dead initializers + 1 `preserve-caught-error` fixed | this PR         |
| 2026-10-04 | Dev-tree security pins: `qs` →^6.16.0, root-level override `basic-ftp` →6.2.1 (no upstream fix in the get-uri chain)                                                                                                                                                | #679            |
| 2026-10-04 | Release job pushes via org-wide `FRODO_CI_PAT` (fine-grained PAT, org secret, selected-repo visibility) — required status checks reject `github-actions[bot]` pushes; PAT-as-repo-admin rides the ruleset bypass                                                    | #684            |
| 2026-10-05 | Root type exports: `src/index.ts` re-exports all 120 cli-consumed data-model type names from the root entry; `./types/*` subpath deprecated (node10-resolution only, dies in TS 7) — removal planned for a future major                                             | #687            |
| 2026-10-05 | `premajor` release-type option in pipeline dispatch (X.0.0-1 train for the next major; first exercised by the 5.0.0-1 release)                                                                                                                                      | #688            |
| planned    | Polly→nock — DEFERRED (deep record-harness coupling; revisit on Node 28 or real breakage)                                                                                                                                                                           | —               |
