---
applyTo: 'package.json,package-lock.json,tsdown.config.mts,scripts/**'
---

# Dependencies and the build

This library ships as a zero-dependency package: `dependencies` in `package.json` stays empty.

- **A package imported by shipped code goes in `devDependencies`.** The bundler (tsdown) inlines it into `dist/`. Anything listed under `dependencies` would be left as a bare `require`, and consumers would have to install it.
- **The `devDeps` list in `tsdown.config.mts` is for build and test tooling only** (Jest, ESLint, TypeScript and the like). Never add a package that shipped code imports: it would then be required at runtime and missing.
- **After changing the dependency graph,** run `npm run build` and check that `grep -c '__require("@' dist/index.mjs` and `grep -c 'from "@' dist/index.mjs` both print 0 (the bundle is an ES module: a bare package left outside it shows up as `from "@..."` or as `__require("@...")`).
- **Keep npm `overrides` at the root level of `package.json`.** Nested scoped overrides produce lockfiles that `npm ci` on npm 10 rejects.
- **Do not remove the `postinstall` script** (`scripts/patch-axios-types.cjs`): the declaration bundler cannot read axios's CommonJS types without it. See [BUILD-ENV.md](../../BUILD-ENV.md) section 2.3.
- **The build writes one JavaScript file.** `tsdown.config.mts` exports one ES module config and `scripts/postbuild-dist.cjs` finishes `dist/` (it copies `index.d.mts` to `index.d.cts`, hardens the one `createRequire(import.meta.url)` line, appends the `'module.exports'` export to `dist/index.mjs`, and fails unless `dist/` holds exactly the five shipped files). Do not add a second build or a `"module"` field; see [decisions/0020](../../decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md).
- **`esbuild` is a development dependency for one test only** (`scripts/pack-smoke.mjs` bundles a CommonJS program that requires the packed package); no shipped code imports it.
- **`types/` is generated** by `npm run generate-types` (`tsc`, then `scripts/deprecate-types-subpath.cjs`) and is gitignored. The `./types/*` export is kept for existing consumers; do not build new code on it.
