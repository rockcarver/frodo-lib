# Frodo Library — Toolchain and Build Environment

This document explains every piece of frodo-lib's toolchain: what it does,
why it is the way it is, and the details you need when something breaks. It
is the companion to [PIPELINE.md](PIPELINE.md); the CLI keeps its own copy
(`docs/BUILD-ENV.md` there) for the pieces that differ (binary packaging,
SEA, Homebrew).

_Last updated: 2026-10-03 (tooling modernization)._

---

## 1. The 30-second map

```
TypeScript sources (src/)
  │
  ├─ jest 30 .............. test (2,433 tests, 927 snapshots, Polly cassettes)
  │
  ├─ generate-help ........ scripts/generate-help.mjs (help data for frodo-cli)
  ├─ tsdown (rolldown) .... bundle src/index.ts -> dist/index.{js,mjs} + dts
  ├─ tsc .................. emit types/ (the public type surface)
  │
  ├─ typedoc .............. docs/ (GitHub Pages on release)
  │
  └─ eslint + prettier .... lint & format (ESLint 9 FlatCompat; a planned migration will move to ESLint 10 with Prettier owning import order)

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

| Output | Format | Role |
|---|---|---|
| `dist/index.js` | CJS | `"require"` condition (~6.6 MB) |
| `dist/index.mjs` | ESM | `"import"` condition (~6.5 MB) |
| `dist/index.d.ts` / `.d.mts` | dts | type surface (tsdown, oxc resolver) |
| `types/` | tsc emit | the full per-file public type tree (kept on tsc deliberately — same emitter as before, per plan) |

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
  `types/` tree. `generate-types` (`tsc`) is deliberately unchanged from the
  pre-tsdown emitter — the public type surface is byte-compatible.

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
- Full suite: 153 suites / 2,433 tests / 927 snapshots (~3 min).
- NOTE (2026-10): the Polly stack is unmaintained (2023); nock migration is
  planned, no longer security-driven (the `qs` advisory closed:
  Polly's tree now resolves patched `qs@6.16.0`).

---

## 5. Lint and format (today, and where we are taking it)

**Today**: ESLint 9.39 FlatCompat (`eslint.config.js`), plugins
`@typescript-eslint`, `prettier` (as a lint rule — ~38 s of the ~43 s lint),
`jest`, `import`. Prettier 3.8 with `importOrder` configured (the ianvs
plugin options are present in `.prettierrc` but the plugin is NOT in
`plugins:` — dead config, import order is enforced by `import/order` in
ESLint, which `lint:fix` does fix here). `eslint-plugin-import` (dead
upstream) crashes on ESLint 10.

**Planned migration**: ESLint 10 native flat config, `eslint-plugin-import-x`,
activate the ianvs Prettier plugin so **Prettier owns import order**, drop
`eslint-plugin-prettier` and `import/order`, scripts `fix = eslint --fix &&
prettier --write` (prettier last) and `check`. ~25 new ESLint 10 findings
get fixed in the migration PR. Pin Prettier exactly (a minor bump reformats
40 of 363 files). One reformat commit in `.git-blame-ignore-revs`.

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
`workflow_dispatch` (prerelease/patch/minor/major, dry-run supported).

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

| Date | Change | PR |
|---|---|---|
| 2026-10-02 | Dependabot configs fixed (were empty template); security updates + secret scanning on | #653 |
| 2026-10-02 | esprima→acorn, jwk-to-pem→node:crypto, replaceall→String.replaceAll, dead deps removed | #671 |
| 2026-10-02 | node-jose→jose; tsup sucrase workaround | #672 |
| 2026-10-02 | node-forge→@peculiar/x509 | #673 |
| 2026-10-03 | FrodoLib↔SecretsOps circular import fixed (unblocks jest 30.5) | #670 |
| 2026-10-03 | paths-ignore removed from PR trigger; Test gate added | #669 |
| 2026-10-03 | tsup→tsdown + axios dts postinstall patch | #674 |
| 2026-10-03 | Branch protection ruleset active | (repo settings) |
| 2026-10-03 | Dependabot auto-merge workflow | #675 |
| 2026-10-03 | TypeScript 5.8→5.9 | #668 |
| 2026-10-03 | npm `files` allowlist | this PR |
| planned | ESLint 10 + Prettier-owns-imports; Polly→nock | — |
