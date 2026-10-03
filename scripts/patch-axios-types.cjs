#!/usr/bin/env node
/**
 * Patches node_modules/axios/package.json so the `require` condition's
 * `types` entry points at the bundleable `./index.d.ts` instead of
 * `./index.d.cts`.
 *
 * Why: rolldown-plugin-dts (used by tsdown's declaration builds) cannot
 * bundle CommonJS-style `.d.cts` declaration modules, and axios's exports
 * map sends `require`-condition type resolution to `index.d.cts`. Pointing
 * the require condition at `index.d.ts` (which exports the same API through
 * `export =` via a re-export shim that rolldown-plugin-dts understands) lets
 * the declaration bundler inline axios's types.
 *
 * Idempotent; runs as a postinstall hook (see package.json).
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', 'axios', 'package.json');
if (!fs.existsSync(pkgPath)) {
  // axios not installed (e.g. during publish-only install); nothing to do.
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const types = pkg.exports?.['.']?.types;
if (types?.require === './index.d.ts') {
  console.log('axios exports patch: already applied');
  process.exit(0);
}
if (types && types.require) {
  types.require = './index.d.ts';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('axios exports patch: require-condition types -> ./index.d.ts');
} else {
  console.log('axios exports patch: exports["."].types not found; skipping');
}
