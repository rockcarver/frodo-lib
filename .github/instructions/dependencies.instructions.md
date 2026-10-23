---
applyTo: 'package.json,package-lock.json,tsdown.config.mts,scripts/**'
---

# Dependencies and the build

This library ships as a zero-dependency package: `dependencies` in `package.json` stays empty.

- **A package imported by shipped code goes in `devDependencies`.** The bundler (tsdown) inlines it into `dist/`. Anything listed under `dependencies` would be left as a bare `require`, and consumers would have to install it.
- **The `devDeps` list in `tsdown.config.mts` is for build and test tooling only** (Jest, ESLint, TypeScript and the like). Never add a package that shipped code imports: it would then be required at runtime and missing.
- **After changing the dependency graph,** run `npm run build` and check that `grep -c 'require("@' dist/index.js` and `grep -c 'from "@' dist/index.mjs` both print 0.
- **Keep npm `overrides` at the root level of `package.json`.** Nested scoped overrides produce lockfiles that `npm ci` on npm 10 rejects.
- **Do not remove the `postinstall` script** (`scripts/patch-axios-types.cjs`): the declaration bundler cannot read axios's CommonJS types without it. See [BUILD-ENV.md](../../BUILD-ENV.md) section 2.3.
- **`types/` is generated** by `npm run generate-types` (`tsc`, then `scripts/deprecate-types-subpath.cjs`) and is gitignored. The `./types/*` export is kept for existing consumers; do not build new code on it.
