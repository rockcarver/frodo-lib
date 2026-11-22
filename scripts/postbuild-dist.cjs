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
 * 3. Appends the `'module.exports'` export to dist/index.mjs: one plain, mutable object that holds the three values
 *    of the root (`FrodoError`, `frodo`, `state`). Node.js returns it from `require()` instead of the sealed,
 *    null-prototype module namespace object. It is added to the JavaScript only: a declaration file that names it
 *    cannot be parsed by TypeScript before 5.6, so the declarations stay without it and the source of the root
 *    (src/index.ts) still exports the three values and types only. The local names come from the bundle's own
 *    `export { ... }` statement, which must exist exactly once and must export each of the three names exactly once.
 *    The appended lines come after the bundle (and before its `//# sourceMappingURL` comment), so no line of the
 *    source map moves. A bundle whose own export list already exports that name is refused.
 * 4. Fails unless dist/ holds exactly the five files the package ships and the declarations do not name the key.
 *
 * Usage: node scripts/postbuild-dist.cjs [dist-directory]   (default: dist/ of this repository). Exit code 1 and a
 * message on stderr when anything is not as expected. Idempotent. The pure functions are exported for
 * src/postbuildDist.unit.test.ts. Decision record:
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

/** The three values the root exports at runtime, and the name of the extra export. */
const ROOT_NAMES = ['FrodoError', 'frodo', 'state'];
const SLOT_NAME = 'module.exports';

/** An `export { a, b as c };` statement at the start of a line (the form the bundler writes). */
const EXPORT_LIST = /^export \{([^}]*)\};?[ \t]*$/gm;
/** Any other export at the start of a line. */
const OTHER_EXPORT = /^export (?!\{)/m;
/** The comment line that opens the three lines this script appends: it marks them as this script's own. */
const SLOT_COMMENT =
  '// Interoperability slot for require(), added by scripts/postbuild-dist.cjs (decisions/0020): not a capability.';
const IDENTIFIER = '[A-Za-z_$][\\w$]*';
/** The three lines this script appends (comment, declaration, export), as a whole. */
const SLOT_BLOCK = new RegExp(
  `^${SLOT_COMMENT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nconst (${IDENTIFIER}) = \\{ FrodoError: [^\\n]* \\};\\nexport \\{ \\1 as '${SLOT_NAME.replace('.', '\\.')}' \\};$`,
  'gm'
);
/** The comment that points at the source map, when it is the last line of the bundle. */
const SOURCE_MAP_LINE = /\n\/\/# sourceMappingURL=[^\n]*\n?$/;
const SPECIFIER = new RegExp(
  `^(${IDENTIFIER}|"[^"]*"|'[^']*')(?:\\s+as\\s+(${IDENTIFIER}|"[^"]*"|'[^']*'))?$`
);
const unquote = (name) => name.replace(/^(["'])(.*)\1$/, '$2');

/**
 * Read an export list: the local name behind every exported name.
 * @param {string} list the text between the braces
 * @returns {Map<string, string[]>} exported name to the local names exported under it (one each when it is valid)
 */
function readExportList(list) {
  const exported = new Map();
  for (const raw of list.split(',')) {
    const text = raw.trim();
    if (text === '') continue;
    const match = SPECIFIER.exec(text);
    if (!match) throw new Error(`cannot read the export specifier "${text}"`);
    const local = unquote(match[1]);
    const name = unquote(match[2] ?? match[1]);
    exported.set(name, [...(exported.get(name) ?? []), local]);
  }
  return exported;
}

/**
 * Append the 'module.exports' export to the bundle: one plain object with the three root values, built from the
 * local names of the bundle's own export list. A bundle that has the three lines this script appended is returned
 * unchanged; a bundle whose own export list exports that name is refused.
 * @param {string} source the text of dist/index.mjs
 * @returns {string} the text with the slot
 * @throws {Error} when the bundle has no export list, more than one, another form of export, an export list that
 * does not export each of FrodoError, frodo and state exactly once, or an export of 'module.exports' that is not
 * the single one this script appended
 */
function addModuleExportsSlot(source) {
  const other = OTHER_EXPORT.exec(source);
  if (other) {
    throw new Error(
      `found an export that is not an export list (${source.slice(other.index, other.index + 40).split('\n')[0]}); the bundler changed what it emits`
    );
  }
  const lists = [...source.matchAll(EXPORT_LIST)].map((match) => ({
    text: match[0],
    exported: readExportList(match[1]),
  }));
  const slotExports = lists.reduce(
    (sum, list) => sum + (list.exported.get(SLOT_NAME)?.length ?? 0),
    0
  );
  const appended = [...source.matchAll(SLOT_BLOCK)].length;
  if (slotExports > 0) {
    // the only 'module.exports' export that may be there is the one this script appended, once
    if (slotExports !== 1 || appended !== 1 || lists.length !== 2) {
      throw new Error(
        `found ${slotExports} export(s) of '${SLOT_NAME}' in ${lists.length} export list(s), ${appended} of them appended by this script; expected none (the bundle's own export list must not export it) or exactly the one this script appended`
      );
    }
    return source;
  }
  const plain = lists;
  if (plain.length !== 1) {
    throw new Error(
      `expected exactly one export list in dist/index.mjs, found ${plain.length}; the bundler changed what it emits`
    );
  }
  const exported = plain[0].exported;
  const locals = {};
  for (const root of ROOT_NAMES) {
    const found = exported.get(root) ?? [];
    if (found.length !== 1) {
      throw new Error(
        `the export list of dist/index.mjs exports ${root} ${found.length} time(s), expected once (it exports: ${[...exported.keys()].join(', ')})`
      );
    }
    locals[root] = found[0];
  }
  let name = 'commonJsExports';
  for (let n = 2; source.includes(name); n++) name = `commonJsExports${n}`;
  const members = ROOT_NAMES.map((root) => `${root}: ${locals[root]}`).join(
    ', '
  );
  const slot =
    `${SLOT_COMMENT}\n` +
    `const ${name} = { ${members} };\n` +
    `export { ${name} as '${SLOT_NAME}' };\n`;
  const mapLine = SOURCE_MAP_LINE.exec(source);
  if (mapLine) {
    return `${source.slice(0, mapLine.index)}\n${slot}${source.slice(mapLine.index)}`;
  }
  return `${source}${source.endsWith('\n') ? '' : '\n'}${slot}`;
}

/**
 * The problems of a declaration file: it must not name the 'module.exports' key.
 * @param {string} name the file name, for the message
 * @param {string} text the content of the declaration file
 * @returns {string[]} the problems; empty when the file is as expected
 */
function declarationProblems(name, text) {
  return text.includes(SLOT_NAME)
    ? [
        `${name} names '${SLOT_NAME}': TypeScript before 5.6 cannot parse a string-named export, add the key to the JavaScript only`,
      ]
    : [];
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
 * Finish dist/ in place and say what was done.
 * @param {string} distDir the dist directory
 * @returns {{problems: string[], hardened: boolean, slot: 'added' | 'present' | null, appendedLines: number}}
 * the problems found (empty when dist/ is done), whether the createRequire line was rewritten by this run, and
 * whether the 'module.exports' export was added by this run or was there already (null when nothing could be done)
 */
function finishDistReport(distDir) {
  const mts = path.join(distDir, 'index.d.mts');
  const mjs = path.join(distDir, 'index.mjs');
  if (!fs.existsSync(mts) || !fs.existsSync(mjs)) {
    return {
      problems: distProblems(
        fs.existsSync(distDir) ? fs.readdirSync(distDir) : []
      ),
      hardened: false,
      slot: null,
      appendedLines: 0,
    };
  }
  fs.copyFileSync(mts, path.join(distDir, 'index.d.cts'));
  const source = fs.readFileSync(mjs, 'utf8');
  const hardened = hardenCreateRequire(source);
  const finished = addModuleExportsSlot(hardened);
  if (finished !== source) fs.writeFileSync(mjs, finished);
  return {
    problems: [
      ...distProblems(fs.readdirSync(distDir)),
      ...declarationProblems('index.d.mts', fs.readFileSync(mts, 'utf8')),
    ],
    hardened: hardened !== source,
    slot: finished !== hardened ? 'added' : 'present',
    appendedLines: finished.split('\n').length - hardened.split('\n').length,
  };
}

/**
 * Finish dist/ in place.
 * @param {string} distDir the dist directory
 * @returns {string[]} the problems found; empty when dist/ is done
 */
function finishDist(distDir) {
  return finishDistReport(distDir).problems;
}

module.exports = {
  DIST_FILES,
  hardenCreateRequire,
  addModuleExportsSlot,
  distProblems,
  declarationProblems,
  finishDist,
  finishDistReport,
};

if (require.main === module) {
  try {
    const distDir = process.argv[2]
      ? path.resolve(process.argv[2])
      : path.join(__dirname, '..', 'dist');
    const report = finishDistReport(distDir);
    if (report.problems.length > 0) {
      console.error(
        `postbuild-dist: dist/ is not what the package ships:\n  ${report.problems.join('\n  ')}`
      );
      process.exit(1);
    }
    console.log(
      [
        'postbuild-dist: index.d.cts copied from index.d.mts',
        report.hardened
          ? 'createRequire hardened'
          : 'createRequire was hardened already',
        report.slot === 'added'
          ? `'module.exports' added (${report.appendedLines} lines appended: ${ROOT_NAMES.join(', ')})`
          : `'module.exports' was there already, nothing appended`,
        'dist/ holds the five shipped files',
      ].join('; ')
    );
  } catch (e) {
    console.error(`postbuild-dist: ${e.message}`);
    process.exit(1);
  }
}
