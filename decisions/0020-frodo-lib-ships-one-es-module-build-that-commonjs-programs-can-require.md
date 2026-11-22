---
status: proposed
date: 2026-11-21
decision-makers:
  - maintainers
applies-to:
  - package.json
  - tsdown.config.*
  - src/index.ts
  - scripts/**
---

# frodo-lib ships one ES module build, and CommonJS programs load it with require

## Context and problem statement

Until 5.0.0 the package carried two builds of the same code, one for `require` and one for `import`. Each had its own `state` object and its own `FrodoError` class, so a program that loaded both got two of each, and the second bundle doubled the size of the package (on 2026-11-21: 45.2 MB unpacked against 23.9 MB with one build). Since Node.js 22.12, `require()` loads an ES module without a flag. On 2026-11-21 the maintainer decided to ship one ES module build, provided that plain CommonJS programs keep the documented `require('@rockcarver/frodo-lib')`; sixteen consumer patterns were measured against the packed package.

## Decision

- The package ships one JavaScript build, `dist/index.mjs`, with the declarations `dist/index.d.mts` and a byte copy `dist/index.d.cts` for TypeScript programs that `require`. `package.json` keeps `"type": "commonjs"`, points `main` and both the `import` and the `require` condition of `exports` at the `.mjs` file, and has no `module` field. A second build (a `.js` or `.cjs` bundle) comes back only through a record that supersedes this one.
- `engines.node` names the oldest Node.js that can `require()` an ES module without a flag (22.12 when this was decided). Older versions get Node's own `ERR_REQUIRE_ESM`; the package does not ship a stub that hides it.
- `src/index.ts` exports one extra key, `'module.exports'`: a plain, mutable object that holds the three values of the root. Node.js hands it to `require()` callers, so `lib.hasOwnProperty`, `String(lib)` and assigning a top-level export keep working, while `import` callers see the same `state` and `FrodoError`. It is an interoperability slot, not a capability: new capabilities still go on the facade ([the public API is only the frodo facade](https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0007-public-api-only-through-the-frodo-facade.md)), and the guard test of the root exports names this key as the one allowed addition.
- The build rewrites the single `createRequire(import.meta.url)` that the bundler emits so that it still works when a bundler leaves `import.meta.url` undefined, and it fails when the expected text is not found exactly once. The build fails when `dist/` holds anything but the files listed here.
- The packed tarball, installed offline, is what the packaging tests consume: `require`, `import`, TypeScript under `node10`, `node16`, `nodenext` and `bundler` resolution, and an esbuild bundle. `npm run test:packed` runs them.

## Consequences

- Four breaks, named in `MIGRATION.md` and the release notes: Jest in CommonJS mode cannot load the real library; Node.js older than the floor, or run with `--no-experimental-require-module`, gets `ERR_REQUIRE_ESM`; clearing `require.cache` no longer resets the state; `import * as ns` shows the extra key, and assigning to the object `require` returns does not change what `import` callers read.
- One `state` and one `FrodoError` for every consumer in a process, and one bundle to build, test and publish.
- The `./types/*` deep-import subpath is unchanged. Coverage of the oldest Node.js, older TypeScript versions and a Jest canary needs network and sits in the pipeline, which a maintainer changes.
- A consumer that fails on the ES module build is fixed by hardening the build step, not by a second build.

## Alternatives considered

- Keep both builds until a later major, with a deprecation notice: keeps Jest in CommonJS mode and older Node.js working, at the price of the second bundle and two copies of the state.
- A small CommonJS entry that requires the ES module: still fails Jest and `require.cache` busting, and keeps a second entry file.
- Make the repository `"type": "module"`: renames six configuration files and changes the tests that spawn scripts, and is not needed to ship one ES module build.
- Conditional `exports` that give old Node.js a CommonJS stub with a readable message: esbuild bundles the stub, and the bundle then fails on every Node.js.
