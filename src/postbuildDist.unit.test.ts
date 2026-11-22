import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * scripts/postbuild-dist.cjs finishes dist/ after tsdown: it copies the declarations to index.d.cts, hardens the one
 * createRequire(import.meta.url) line and checks that dist/ holds exactly the five files the package ships
 * (decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md). The pure functions are
 * tested here on text; `finishDist` is tested on a small fake dist/ in a temporary folder. No build is needed.
 */

const SCRIPT = path.resolve(process.cwd(), 'scripts/postbuild-dist.cjs');

type Postbuild = {
  DIST_FILES: string[];
  hardenCreateRequire: (source: string) => string;
  distProblems: (names: string[]) => string[];
  finishDist: (distDir: string) => string[];
};

let postbuild: Postbuild;

beforeAll(async () => {
  const mod = await import(pathToFileURL(SCRIPT).href);
  postbuild = (mod.default ?? mod) as Postbuild;
});

const PLAIN = 'createRequire(import.meta.url)';
const bundle = (line: string) =>
  `import { createRequire } from "node:module";\nvar __require = /* #__PURE__ */ (() => ${line})();\nexport {};\n`;

const SHIPPED = [
  'index.d.cts',
  'index.d.mts',
  'index.d.mts.map',
  'index.mjs',
  'index.mjs.map',
];

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
    expect(out.endsWith('export {};\n')).toBe(true);
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
    expect(fn('/some/where/bundle.cjs')).toBe('/some/where/bundle.cjs');
    expect(fn(undefined)).toContain('x.js');
  });
});

describe('distProblems', () => {
  test('accepts exactly the five shipped files, in any order', () => {
    expect(postbuild.DIST_FILES).toEqual(SHIPPED);
    expect(postbuild.distProblems([...SHIPPED].reverse())).toEqual([]);
  });

  test('reports an extra index.js', () => {
    expect(postbuild.distProblems([...SHIPPED, 'index.js'])).toEqual([
      'unexpected: dist/index.js',
    ]);
  });

  test('reports a missing index.d.cts', () => {
    expect(
      postbuild.distProblems(SHIPPED.filter((n) => n !== 'index.d.cts'))
    ).toEqual(['missing: dist/index.d.cts']);
  });
});

describe('finishDist', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'postbuild-dist-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function fakeDist(files: Record<string, string>) {
    for (const [name, text] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), text);
    }
  }

  test('adds a byte copy of index.d.mts as index.d.cts, hardens index.mjs and reports no problem', () => {
    fakeDist({
      'index.mjs': bundle(PLAIN),
      'index.mjs.map': '{}',
      'index.d.mts': 'export declare const x: number;\n',
      'index.d.mts.map': '{}',
    });
    expect(postbuild.finishDist(dir)).toEqual([]);
    expect(fs.readdirSync(dir).sort()).toEqual(SHIPPED);
    expect(fs.readFileSync(path.join(dir, 'index.d.cts'))).toEqual(
      fs.readFileSync(path.join(dir, 'index.d.mts'))
    );
    expect(fs.readFileSync(path.join(dir, 'index.mjs'), 'utf8')).toContain(
      'import.meta.url ?? '
    );
  });

  test('reports a dist/ with a CommonJS bundle left in it', () => {
    fakeDist({
      'index.mjs': bundle(PLAIN),
      'index.mjs.map': '{}',
      'index.d.mts': 'export {};\n',
      'index.d.mts.map': '{}',
      'index.js': 'module.exports = {};\n',
    });
    expect(postbuild.finishDist(dir)).toEqual(['unexpected: dist/index.js']);
  });

  test('reports every file as missing when tsdown wrote nothing', () => {
    expect(postbuild.finishDist(dir)).toHaveLength(5);
    expect(postbuild.finishDist(path.join(dir, 'no-such-dist'))).toHaveLength(
      5
    );
  });
});
