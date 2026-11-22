import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isolatedChildEnv } from '../test/support/runWorkers';

/*
 * scripts/postbuild-dist.cjs finishes dist/ after tsdown: it copies the declarations to index.d.cts, hardens the one
 * createRequire(import.meta.url) line, appends the 'module.exports' export to the JavaScript (never to the
 * declarations) and checks that dist/ holds exactly the five files the package ships
 * (decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md). The pure functions are
 * tested here on text, `finishDist` on a small fake dist/ in a temporary folder, and the script itself by its exit
 * code on a fake dist/. The script starts no process, so these tests cannot start themselves again. No build is needed.
 */

const SCRIPT = path.resolve(process.cwd(), 'scripts/postbuild-dist.cjs');

type Postbuild = {
  DIST_FILES: string[];
  hardenCreateRequire: (source: string) => string;
  addModuleExportsSlot: (source: string) => string;
  distProblems: (names: string[]) => string[];
  declarationProblems: (name: string, text: string) => string[];
  finishDist: (distDir: string) => string[];
};

let postbuild: Postbuild;

beforeAll(async () => {
  const mod = await import(pathToFileURL(SCRIPT).href);
  postbuild = (mod.default ?? mod) as Postbuild;
});

const PLAIN = 'createRequire(import.meta.url)';
const EXPORTS = 'export { FrodoError, frodo, state };';
/** What the bundler writes, in small: a createRequire line, three values and one export list. */
const bundle = (line: string, exportList = EXPORTS, tail = '') =>
  [
    'import { createRequire } from "node:module";',
    `var __require = /* #__PURE__ */ (() => ${line})();`,
    'const FrodoError = class FrodoError extends Error {};',
    'const frodo = { facade: true };',
    "const state = { host: 'https://openam-matrix.example.com/am' };",
    exportList,
    '',
  ].join('\n') + tail;

// The name of the CommonJS bundle that 5.0.0 no longer builds (spelled in parts so that a search for stale
// references to it finds only real ones).
const OLD_BUNDLE = ['index', 'js'].join('.');

const SHIPPED = [
  'index.d.cts',
  'index.d.mts',
  'index.d.mts.map',
  'index.mjs',
  'index.mjs.map',
];

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'postbuild-dist-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Write `text` as a module in the scratch folder and load it. */
async function load(text: string): Promise<Record<string, any>> {
  const file = path.join(
    dir,
    `bundle-${Math.random().toString(36).slice(2)}.mjs`
  );
  fs.writeFileSync(file, text);
  return import(pathToFileURL(file).href);
}

describe('hardenCreateRequire', () => {
  test('replaces the one plain createRequire(import.meta.url) by the hardened form', () => {
    const out = postbuild.hardenCreateRequire(bundle(PLAIN));
    expect(out).not.toContain(PLAIN);
    expect(out).toContain('import.meta.url ?? ');
    expect(out).toContain('typeof __filename');
    expect(out.match(/createRequire\(/g)).toHaveLength(1);
    // the rest of the bundle is untouched
    expect(out.startsWith('import { createRequire } from "node:module";')).toBe(
      true
    );
    expect(out.endsWith(`${EXPORTS}\n`)).toBe(true);
  });

  test('throws when the bundler emitted no createRequire(import.meta.url)', () => {
    expect(() =>
      postbuild.hardenCreateRequire(bundle('createRequire(__filename)'))
    ).toThrow(/exactly one createRequire\(import\.meta\.url\).*found 0/);
  });

  test('throws when the bundler emitted two of them', () => {
    expect(() =>
      postbuild.hardenCreateRequire(`${bundle(PLAIN)}${bundle(PLAIN)}`)
    ).toThrow(/found 2/);
  });

  test('returns input that is already hardened unchanged', () => {
    const once = postbuild.hardenCreateRequire(bundle(PLAIN));
    expect(postbuild.hardenCreateRequire(once)).toBe(once);
  });

  test('the hardened line is valid JavaScript that survives an undefined import.meta.url', () => {
    const hardened = postbuild.hardenCreateRequire(bundle(PLAIN));
    // evaluate the argument the way a bundler leaves it: import.meta.url undefined
    const argument = /createRequire\((.*)\)\)\(\);/.exec(
      hardened
    )?.[1] as string;
    const fn = new Function(
      '__filename',
      `return ${argument.replace('import.meta.url', 'undefined')};`
    );
    // first fallback: the file of the bundle
    expect(fn('/some/where/bundle.cjs')).toBe('/some/where/bundle.cjs');
    // last fallback: an ABSOLUTE path below the current directory (a relative one makes createRequire throw)
    expect(fn(undefined)).toBe(`${process.cwd()}/x.js`);
    expect(path.isAbsolute(fn(undefined))).toBe(true);
  });
});

describe('addModuleExportsSlot', () => {
  test('appends one export of the name module.exports after the bundle and changes nothing before it', () => {
    const source = bundle(PLAIN);
    const out = postbuild.addModuleExportsSlot(source);
    expect(out.startsWith(source)).toBe(true);
    expect(out.match(/as 'module\.exports'/g)).toHaveLength(1);
    expect(out.match(/^const commonJsExports = /gm)).toHaveLength(1);
    expect(
      out.endsWith("export { commonJsExports as 'module.exports' };\n")
    ).toBe(true);
  });

  test('the output is a module whose module.exports is a plain, mutable object with the three named exports', async () => {
    const ns = await load(
      postbuild.addModuleExportsSlot(
        bundle(PLAIN.replace('createRequire(import.meta.url)', '1'))
      )
    );
    const slot = ns['module.exports'];
    expect(Object.keys(ns).sort()).toEqual([
      'FrodoError',
      'frodo',
      'module.exports',
      'state',
    ]);
    expect(Object.getPrototypeOf(slot)).toBe(Object.prototype);
    expect(Object.isFrozen(slot) || Object.isSealed(slot)).toBe(false);
    expect(Object.keys(slot).sort()).toEqual(['FrodoError', 'frodo', 'state']);
    expect(slot.FrodoError).toBe(ns.FrodoError);
    expect(slot.frodo).toBe(ns.frodo);
    expect(slot.state).toBe(ns.state);
    slot.frodo = 'replaced';
    expect(slot.frodo).toBe('replaced');
    expect(ns.frodo).not.toBe('replaced');
  });

  test('takes the local names from the export list instead of guessing them', async () => {
    const source = [
      'const FrodoError = class extends Error {};',
      'const frodo$1 = { facade: true };',
      'const state$1 = { host: undefined };',
      'export { FrodoError, frodo$1 as frodo, state$1 as state };',
      '',
    ].join('\n');
    const out = postbuild.addModuleExportsSlot(source);
    expect(out).toContain(
      'FrodoError: FrodoError, frodo: frodo$1, state: state$1'
    );
    const ns = await load(out);
    expect(ns['module.exports'].frodo).toBe(ns.frodo);
    expect(ns['module.exports'].state).toBe(ns.state);
  });

  test('puts the slot before a sourceMappingURL comment that is the last line, so that the comment stays last', () => {
    const comment = '//# sourceMappingURL=index.mjs.map';
    const out = postbuild.addModuleExportsSlot(bundle(PLAIN, EXPORTS, comment));
    expect(out.endsWith(`\n${comment}`)).toBe(true);
    expect(out.indexOf("as 'module.exports'")).toBeLessThan(
      out.indexOf(comment)
    );
    // the lines of the bundle did not move: everything before the slot is the original text
    expect(out.startsWith(bundle(PLAIN))).toBe(true);
  });

  test('is idempotent: a bundle that has the slot is returned unchanged', () => {
    const once = postbuild.addModuleExportsSlot(
      bundle(PLAIN, EXPORTS, '//# sourceMappingURL=a.map')
    );
    expect(postbuild.addModuleExportsSlot(once)).toBe(once);
  });

  test('throws when a slot export is there without its declaration', () => {
    expect(() =>
      postbuild.addModuleExportsSlot(
        `${bundle(PLAIN)}export { missing as 'module.exports' };\n`
      )
    ).toThrow(/1 'module\.exports' export\(s\) and 0 declaration/);
  });

  test('throws when the bundle has no export list', () => {
    expect(() => postbuild.addModuleExportsSlot(bundle(PLAIN, ''))).toThrow(
      /exactly one export list.*found 0/
    );
  });

  test('throws when the bundle has two export lists', () => {
    expect(() =>
      postbuild.addModuleExportsSlot(
        bundle(PLAIN, `${EXPORTS}\nexport { frodo as again };`)
      )
    ).toThrow(/exactly one export list.*found 2/);
  });

  test('throws, naming the name, when one of the three is not exported', () => {
    expect(() =>
      postbuild.addModuleExportsSlot(bundle(PLAIN, 'export { frodo, state };'))
    ).toThrow(/exports FrodoError 0 time/);
  });

  test('throws when one of the three is exported twice', () => {
    expect(() =>
      postbuild.addModuleExportsSlot(
        bundle(PLAIN, 'export { FrodoError, frodo, frodo as state, state };')
      )
    ).toThrow(/exports state 2 time/);
  });

  test('throws on an export that is not an export list', () => {
    expect(() =>
      postbuild.addModuleExportsSlot(
        bundle(PLAIN, `${EXPORTS}\nexport default 1;`)
      )
    ).toThrow(/not an export list/);
  });

  test('chooses a local name that the bundle does not use yet', async () => {
    const source = `const commonJsExports = 'taken';\n${bundle(PLAIN)}`;
    const out = postbuild.addModuleExportsSlot(source);
    expect(out).toContain('const commonJsExports2 = ');
    const ns = await load(out);
    expect(ns['module.exports'].state).toBe(ns.state);
  });
});

describe('declarationProblems', () => {
  test('accepts a declaration file that does not name the key', () => {
    expect(
      postbuild.declarationProblems('index.d.mts', 'export { frodo, state };')
    ).toEqual([]);
  });

  test('reports a declaration file that names the key', () => {
    const problems = postbuild.declarationProblems(
      'index.d.mts',
      'export { x as "module.exports" };'
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/index\.d\.mts names 'module\.exports'.*5\.6/);
  });
});

describe('distProblems', () => {
  test('accepts exactly the five shipped files, in any order', () => {
    expect(postbuild.DIST_FILES).toEqual(SHIPPED);
    expect(postbuild.distProblems([...SHIPPED].reverse())).toEqual([]);
  });

  test('reports an extra CommonJS bundle', () => {
    expect(postbuild.distProblems([...SHIPPED, OLD_BUNDLE])).toEqual([
      `unexpected: dist/${OLD_BUNDLE}`,
    ]);
  });

  test('reports a missing index.d.cts', () => {
    expect(
      postbuild.distProblems(SHIPPED.filter((n) => n !== 'index.d.cts'))
    ).toEqual(['missing: dist/index.d.cts']);
  });
});

/** A fake dist/ in the scratch folder. */
function fakeDist(files: Record<string, string>) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text);
  }
}
const goodDist = () => ({
  'index.mjs': bundle(PLAIN, EXPORTS, '//# sourceMappingURL=index.mjs.map'),
  'index.mjs.map': '{}',
  'index.d.mts': 'export declare const x: number;\nexport { x };\n',
  'index.d.mts.map': '{}',
});

describe('finishDist', () => {
  test('adds the byte copy index.d.cts, hardens and extends index.mjs, leaves the declarations without the key, and reports no problem', () => {
    fakeDist(goodDist());
    expect(postbuild.finishDist(dir)).toEqual([]);
    expect(fs.readdirSync(dir).sort()).toEqual(SHIPPED);
    const mts = fs.readFileSync(path.join(dir, 'index.d.mts'));
    expect(fs.readFileSync(path.join(dir, 'index.d.cts'))).toEqual(mts);
    expect(mts.toString()).not.toContain('module.exports');
    const mjs = fs.readFileSync(path.join(dir, 'index.mjs'), 'utf8');
    expect(mjs).toContain('import.meta.url ?? ');
    expect(mjs).toContain("as 'module.exports'");
  });

  test('is idempotent: a second run reports nothing and changes no file', () => {
    fakeDist(goodDist());
    postbuild.finishDist(dir);
    const before = SHIPPED.map((n) => fs.readFileSync(path.join(dir, n)));
    expect(postbuild.finishDist(dir)).toEqual([]);
    expect(SHIPPED.map((n) => fs.readFileSync(path.join(dir, n)))).toEqual(
      before
    );
  });

  test('reports a dist/ with a CommonJS bundle left in it', () => {
    fakeDist({ ...goodDist(), [OLD_BUNDLE]: 'module.exports = {};\n' });
    expect(postbuild.finishDist(dir)).toEqual([
      `unexpected: dist/${OLD_BUNDLE}`,
    ]);
  });

  test('reports declarations that name the key', () => {
    fakeDist({
      ...goodDist(),
      'index.d.mts': 'export { x as "module.exports" };\n',
    });
    expect(postbuild.finishDist(dir)).toEqual([
      expect.stringMatching(/index\.d\.mts names 'module\.exports'/),
    ]);
  });

  test('reports the missing file, and creates nothing, when only index.d.mts exists', () => {
    fakeDist({ 'index.d.mts': 'export {};\n' });
    const problems = postbuild.finishDist(dir);
    expect(problems).toContain('missing: dist/index.mjs');
    expect(fs.existsSync(path.join(dir, 'index.d.cts'))).toBe(false);
  });

  test('reports the missing file, and changes no file, when only index.mjs exists', () => {
    const mjs = bundle(PLAIN);
    fakeDist({ 'index.mjs': mjs });
    const problems = postbuild.finishDist(dir);
    expect(problems).toContain('missing: dist/index.d.mts');
    expect(fs.readFileSync(path.join(dir, 'index.mjs'), 'utf8')).toBe(mjs);
    expect(fs.existsSync(path.join(dir, 'index.d.cts'))).toBe(false);
  });

  test('reports every file as missing when tsdown wrote nothing', () => {
    expect(postbuild.finishDist(dir)).toHaveLength(5);
    expect(postbuild.finishDist(path.join(dir, 'no-such-dist'))).toHaveLength(
      5
    );
  });
});

describe('the script, run as the build runs it', () => {
  function runScript(target: string) {
    const r = spawnSync(process.execPath, [SCRIPT, target], {
      encoding: 'utf8',
      env: isolatedChildEnv(),
      timeout: 60_000,
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  }

  test('exits 0 on a good dist/ and has finished it', () => {
    fakeDist(goodDist());
    const r = runScript(dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("'module.exports' added");
    expect(fs.readdirSync(dir).sort()).toEqual(SHIPPED);
    // a second run, as `node scripts/postbuild-dist.cjs` after a build, must not fail
    expect(runScript(dir).status).toBe(0);
  });

  test('exits 1 and names the file when dist/ holds a file that is not shipped', () => {
    fakeDist({ ...goodDist(), [OLD_BUNDLE]: 'module.exports = {};\n' });
    const r = runScript(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`unexpected: dist/${OLD_BUNDLE}`);
  });

  test('exits 1 when the bundle is not what the script expects', () => {
    fakeDist({ ...goodDist(), 'index.mjs': bundle(PLAIN, '') });
    const r = runScript(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('exactly one export list');
  });

  test('exits 1 when there is no dist/', () => {
    const r = runScript(path.join(dir, 'no-such-dist'));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('missing: dist/index.mjs');
  });
});
