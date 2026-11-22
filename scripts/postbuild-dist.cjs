#!/usr/bin/env node
/**
 * Runs after `tsdown` (see the `build` script in package.json) and finishes dist/ for the one ES module build:
 *
 * 1. Copies dist/index.d.mts to dist/index.d.cts. TypeScript programs that `require` the package under
 *    `module: node16` or `nodenext` resolve the `require` condition of `exports` to a `.d.cts` file; the content
 *    is the same, so it is a byte copy.
 * 2. Hardens the one `createRequire(import.meta.url)` line that the bundler emits for the CommonJS-only packages
 *    it inlined. A bundler that turns a program into one CommonJS file (esbuild, for example) leaves
 *    `import.meta.url` undefined, and `createRequire(undefined)` throws when the program starts; the hardened line
 *    falls back to `__filename` and then to the current directory. It must find the line exactly once: a different
 *    count means the bundler changed what it emits and this script has to be looked at.
 * 3. Fails unless dist/ holds exactly the five files the package ships.
 *
 * Idempotent. The pure functions are exported for src/postbuildDist.unit.test.ts. Decision record:
 * decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** The files `npm pack` ships from dist/, and nothing else. */
const DIST_FILES = [
  'index.d.cts',
  'index.d.mts',
  'index.d.mts.map',
  'index.mjs',
  'index.mjs.map',
];

/** What the bundler emits. */
const PLAIN = 'createRequire(import.meta.url)';

/** What this script writes in its place. */
const HARDENED =
  'createRequire(import.meta.url ?? (typeof __filename !== "undefined" ? __filename : process.cwd() + "/x.js"))';

/** The number of non-overlapping occurrences of `needle` in `text`. */
function count(text, needle) {
  return text.split(needle).length - 1;
}

/**
 * Replace the single `createRequire(import.meta.url)` of a bundle by the hardened form.
 * A bundle that already has the hardened form (and no plain one) is returned unchanged.
 * @param {string} source the text of dist/index.mjs
 * @returns {string} the hardened text
 * @throws {Error} when the plain form does not occur exactly once (and the bundle is not already hardened)
 */
function hardenCreateRequire(source) {
  const plain = count(source, PLAIN);
  const hardened = count(source, HARDENED);
  if (plain === 0 && hardened === 1) return source;
  if (plain !== 1 || hardened !== 0) {
    throw new Error(
      `expected exactly one ${PLAIN} in dist/index.mjs, found ${plain} (and ${hardened} hardened); the bundler changed what it emits`
    );
  }
  return source.replace(PLAIN, () => HARDENED);
}

/**
 * Compare the names found in dist/ with the five files the package ships.
 * @param {string[]} names the file names in dist/
 * @returns {string[]} one message per missing or unexpected file; empty when dist/ is as expected
 */
function distProblems(names) {
  const problems = [];
  for (const name of DIST_FILES) {
    if (!names.includes(name)) problems.push(`missing: dist/${name}`);
  }
  for (const name of [...names].sort()) {
    if (!DIST_FILES.includes(name)) problems.push(`unexpected: dist/${name}`);
  }
  return problems;
}

/**
 * Finish dist/ in place.
 * @param {string} distDir the dist directory
 * @returns {string[]} the problems found; empty when dist/ is done
 */
function finishDist(distDir) {
  const mts = path.join(distDir, 'index.d.mts');
  const mjs = path.join(distDir, 'index.mjs');
  if (!fs.existsSync(mts) || !fs.existsSync(mjs)) {
    return distProblems(fs.existsSync(distDir) ? fs.readdirSync(distDir) : []);
  }
  fs.copyFileSync(mts, path.join(distDir, 'index.d.cts'));
  const source = fs.readFileSync(mjs, 'utf8');
  const hardened = hardenCreateRequire(source);
  if (hardened !== source) fs.writeFileSync(mjs, hardened);
  return distProblems(fs.readdirSync(distDir));
}

module.exports = { DIST_FILES, hardenCreateRequire, distProblems, finishDist };

if (require.main === module) {
  try {
    const problems = finishDist(path.join(__dirname, '..', 'dist'));
    if (problems.length > 0) {
      console.error(
        `postbuild-dist: dist/ is not what the package ships:\n  ${problems.join('\n  ')}`
      );
      process.exit(1);
    }
    console.log(
      'postbuild-dist: dist/ holds the five shipped files, index.d.cts added, createRequire hardened'
    );
  } catch (e) {
    console.error(`postbuild-dist: ${e.message}`);
    process.exit(1);
  }
}
