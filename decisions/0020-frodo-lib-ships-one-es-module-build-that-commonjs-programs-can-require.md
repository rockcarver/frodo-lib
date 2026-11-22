---
status: proposed
date: 2026-11-21
decision-makers:
  - maintainers
applies-to:
  - package.json
  - tsdown.config.*
  - scripts/**
---

# frodo-lib ships one ES module build, and CommonJS programs load it with require

## Context and problem statement

Until 5.0.0 the package carried two builds of the same code, one for `require` and one for `import`. Each had its own `state` object and its own `FrodoError` class, so a program that loaded both got two of each, and the second bundle doubled the size of the package (on 2026-11-21: 45.2 MB unpacked with two builds, 24.6 MB with one build and its declarations). Since Node.js 22.12, `require()` loads an ES module without a flag. On 2026-11-21 the maintainer decided to ship one ES module build, provided that plain CommonJS programs keep the documented `require('@rockcarver/frodo-lib')`; sixteen consumer patterns were measured against the packed package.

## Decision

- The package ships one JavaScript build, `dist/index.mjs`, with the declarations `dist/index.d.mts` and a byte copy `dist/index.d.cts` for TypeScript programs that `require`. `package.json` keeps `"type": "commonjs"`, points `main` and both the `import` and the `require` condition of `exports` at the `.mjs` file, and has no `module` field. A second build (a `.js` or `.cjs` bundle) comes back only through a record that supersedes this one.
- `engines.node` names the first Node.js 22 release that can `require()` an ES module without a flag (22.12 when this was decided); that is what the package claims and tests. Node.js 20.19 can also do it and works, but `engines` does not promise it. Versions that cannot get Node's own `ERR_REQUIRE_ESM`; the package does not ship a stub that hides it.
- The build adds one extra export, `'module.exports'`, to `dist/index.mjs` (the post-build step appends it; `src/index.ts` is not changed): a plain, mutable object that holds the three values of the root. Node.js hands it to `require()` callers, so `lib.hasOwnProperty`, `String(lib)` and assigning a top-level export keep working, while `import` callers see the same `state` and `FrodoError`. It is in the JavaScript only, never in the declaration files: TypeScript before 5.6 cannot parse a string-named export in a declaration file. The source of the root still exports `frodo`, `state`, `FrodoError` and types ([the public API is only the frodo facade](https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0007-public-api-only-through-the-frodo-facade.md)); the key is an interoperability slot, not a capability, and new capabilities still go on the facade. The build refuses to run unless the bundle exports exactly those three values once each.
- The build rewrites the single `createRequire(import.meta.url)` that the bundler emits so that it still works when a bundler leaves `import.meta.url` undefined, and it fails when the expected text is not found exactly once. The build fails when `dist/` holds anything but the files listed here, or when a declaration file names the key.
- The packed tarball, installed offline, is what the packaging tests consume: `require`, `import`, TypeScript under `node10`, `node16`, `nodenext` and `bundler` resolution, and an esbuild bundle. `npm run test:packed` runs them.

## Consequences

- Four breaks, named in `MIGRATION.md` and the release notes: Jest in CommonJS mode cannot load the real library; Node.js older than the floor, or run with `--no-experimental-require-module`, gets `ERR_REQUIRE_ESM`; clearing `require.cache` no longer resets the state; `import * as ns` shows the extra key (in the JavaScript, not in the types), and assigning to the object `require` returns does not change what `import` callers read.
- One `state` and one `FrodoError` for every consumer in a process, and one bundle to build, test and publish.
- The `./types/*` deep-import subpath is unchanged, and the declaration files were checked with TypeScript 5.4.5 and later. The packed tests and the unit tests of the post-build step guard the key; coverage of the oldest Node.js, other TypeScript versions and a Jest canary needs network and sits in the pipeline, which a maintainer changes.
- A consumer that fails on the ES module build is fixed by hardening the build step, not by a second build.

## Alternatives considered

- Keep both builds until a later major, with a deprecation notice: keeps Jest in CommonJS mode and older Node.js working, at the price of the second bundle and two copies of the state.
- A small CommonJS entry that requires the ES module: still fails Jest and `require.cache` busting, and keeps a second entry file.
- Make the repository `"type": "module"`: renames six configuration files and changes the tests that spawn scripts, and is not needed to ship one ES module build.
- Build the key in `src/index.ts` (`export { slot as 'module.exports' }`): one place to read and a guard test in Jest, but the key then appears in the declaration files, which TypeScript before 5.6 cannot parse, and every module that the facade imports must avoid importing the root.
- Conditional `exports` that give old Node.js a CommonJS stub with a readable message: esbuild bundles the stub, and the bundle then fails on every Node.js.
