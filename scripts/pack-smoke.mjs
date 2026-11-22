#!/usr/bin/env node
/**
 * Packs the library as `npm pack` does, installs the tarball OFFLINE into a scratch consumer folder and runs what
 * consumers do with it: `require`, `import`, TypeScript under several module resolutions and an esbuild bundle.
 * The packed package is what is tested, not `dist/`, so a wrong `exports` map, a missing file or a missing declaration
 * file shows up here. Decision record:
 * decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md
 *
 * Usage (run `npm run build` first; the script fails when `dist/` is missing, it never skips):
 *   node scripts/pack-smoke.mjs [--json] [--only <ids>] [--node <path>] [--typescript <dir>]
 *   node scripts/pack-smoke.mjs --tarball <file> [--expect-require-error] [...]
 *   node scripts/pack-smoke.mjs --pack-only [--out <dir>]
 *
 *   --json                  print one JSON object to stdout (results with id, ok, ms, detail); progress goes to stderr
 *   --only <ids>            comma separated: a result id (T7-node16), a number (T7) or a group (tarball, require,
 *                           types, bundle, static)
 *   --node <path>           the Node.js that runs the probes and the bundle (default: this one)
 *   --typescript <dir>      a folder with `node_modules/typescript` (default: this repository's TypeScript)
 *   --tarball <file>        test this tarball instead of packing the working tree
 *   --expect-require-error  for a Node.js that cannot require() an ES module: require must fail with
 *                           ERR_REQUIRE_ESM and import must work
 *   --pack-only [--out dir] pack, copy the tarball to <dir> (default: the current folder) and stop
 *   --keep                  keep the scratch folder under test/fs_tmp/
 *
 * Exit code: 0 when every selected check passed, 1 when one failed or dist/ is missing, 2 on a usage error.
 * The children get no NODE_OPTIONS and no proxy variables, and a HOME of their own inside the scratch folder.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBES = path.join(REPO, 'test', 'pack-smoke');
const PKG = '@rockcarver/frodo-lib';
const MAX_UNPACKED_BYTES = 30 * 1024 * 1024;

/** The `exports` map the package must have (decisions/0020). */
const EXPECTED_EXPORTS = {
  '.': {
    import: { types: './dist/index.d.mts', default: './dist/index.mjs' },
    require: { types: './dist/index.d.cts', default: './dist/index.mjs' },
  },
  './types/*': './types/*',
};
const EXPECTED_DIST = [
  'index.d.cts',
  'index.d.mts',
  'index.d.mts.map',
  'index.mjs',
  'index.mjs.map',
];

/** TypeScript consumers: [id, module, moduleResolution, probe files]. */
const COMMON = [
  'a-named',
  'b-importequals',
  'c-namespace',
  'f-require',
  'g-dynamic',
];
const TS_MODES = [
  [
    'commonjs-node10',
    'commonjs',
    'node10',
    [...COMMON, 'e-deeptypes', 'h-esm.mts', 'i-cjs.cts'],
  ],
  [
    'esnext-node10',
    'esnext',
    'node10',
    // `import x = require()` is an error when targeting ES modules, so b-importequals is left out
    COMMON.filter((f) => f !== 'b-importequals').concat([
      'e-deeptypes',
      'h-esm.mts',
      'i-cjs.cts',
    ]),
  ],
  ['node16', 'node16', 'node16', [...COMMON, 'h-esm.mts', 'i-cjs.cts']],
  ['nodenext', 'nodenext', 'nodenext', [...COMMON, 'h-esm.mts', 'i-cjs.cts']],
  [
    'preserve-bundler',
    'preserve',
    'bundler',
    [...COMMON, 'h-esm.mts', 'i-cjs.cts'],
  ],
];

// ---------------------------------------------------------------------------------------------- arguments

function usage(message) {
  if (message) console.error(`pack-smoke: ${message}`);
  console.error(
    'usage: node scripts/pack-smoke.mjs [--json] [--only ids] [--node path] [--typescript dir] [--tarball file]\n' +
      '                                   [--expect-require-error] [--pack-only [--out dir]] [--keep]'
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = {
    json: false,
    only: null,
    node: process.execPath,
    typescript: null,
    tarball: null,
  };
  const value = (i) =>
    i + 1 < argv.length ? argv[i + 1] : usage(`${argv[i]} needs a value`);
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--json':
        opts.json = true;
        break;
      case '--keep':
        opts.keep = true;
        break;
      case '--pack-only':
        opts.packOnly = true;
        break;
      case '--expect-require-error':
        opts.expectRequireError = true;
        break;
      case '--only':
        opts.only = value(i++).split(',').filter(Boolean);
        break;
      case '--node':
        opts.node = path.resolve(value(i++));
        break;
      case '--typescript':
        opts.typescript = path.resolve(value(i++));
        break;
      case '--tarball':
        opts.tarball = path.resolve(value(i++));
        break;
      case '--out':
        opts.out = path.resolve(value(i++));
        break;
      case '-h':
      case '--help':
        usage();
        break;
      default:
        usage(`unknown argument ${argv[i]}`);
    }
  }
  return opts;
}

// -------------------------------------------------------------------------------------------- child processes

/** The environment of every child: no NODE_OPTIONS, no proxy, a HOME of its own. */
function childEnv(home) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(https?_proxy|all_proxy|no_proxy|node_options)$/i.test(key))
      delete env[key];
  }
  env.NO_PROXY = '127.0.0.1,localhost';
  env.no_proxy = '127.0.0.1,localhost';
  env.HOME = home;
  env.USERPROFILE = home;
  return env;
}

function run(command, args, { cwd, env, timeout = 180_000 }) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout,
    maxBuffer: 128 * 1024 * 1024,
    shell: process.platform === 'win32' && command === 'npm',
  });
  return {
    status: result.status,
    signal: result.signal,
    error: result.error,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function describeFailure(label, r) {
  const lines = `${r.stdout}\n${r.stderr}`.trim().split('\n');
  // the first lines hold the message, the last ones the stack's end: keep both
  const shown =
    lines.length > 8
      ? [...lines.slice(0, 4), '...', ...lines.slice(-3)]
      : lines;
  const tail = shown.join(' | ').slice(0, 800);
  return `${label} exited ${r.status ?? r.signal ?? r.error?.message}: ${tail}`;
}

function must(label, r) {
  if (r.status !== 0) throw new Error(describeFailure(label, r));
  return r;
}

/** The last `RESULT {json}` line a probe printed. */
function lastResult(stdout) {
  const lines = stdout.split('\n').filter((l) => l.startsWith('RESULT '));
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1].slice('RESULT '.length));
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------------------------ the checks

/** Every file below `dir`: [relative path, size]. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push([path.relative(base, full), fs.statSync(full).size]);
  }
  return out;
}

const count = (text, needle) => text.split(needle).length - 1;

function checkTarball(ctx) {
  const problems = [];
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ctx.pkgDir, 'package.json'), 'utf8')
  );
  const dist = fs.existsSync(path.join(ctx.pkgDir, 'dist'))
    ? fs.readdirSync(path.join(ctx.pkgDir, 'dist')).sort()
    : [];
  if (dist.join() !== EXPECTED_DIST.join()) {
    problems.push(
      `dist/ holds [${dist.join(', ')}], expected [${EXPECTED_DIST.join(', ')}]`
    );
  }
  if (JSON.stringify(pkg.exports) !== JSON.stringify(EXPECTED_EXPORTS)) {
    problems.push(`exports is ${JSON.stringify(pkg.exports)}`);
  }
  if (pkg.type !== 'commonjs') problems.push(`type is ${pkg.type}`);
  if ('module' in pkg) problems.push('package.json has a "module" field');
  if (pkg.main !== './dist/index.mjs') problems.push(`main is ${pkg.main}`);
  if (pkg.types !== './dist/index.d.mts')
    problems.push(`types is ${pkg.types}`);
  if (pkg.engines?.node !== '>=22.12')
    problems.push(`engines.node is ${pkg.engines?.node}`);
  if (Object.keys(pkg.dependencies ?? {}).length > 0)
    problems.push('dependencies is not empty');
  // The axios patch still runs as a postinstall script of the package; moving it is a separate change.
  if (pkg.scripts?.postinstall !== 'node scripts/patch-axios-types.cjs') {
    problems.push(`scripts.postinstall is ${pkg.scripts?.postinstall}`);
  }
  if (
    !fs.existsSync(path.join(ctx.pkgDir, 'scripts', 'patch-axios-types.cjs'))
  ) {
    problems.push('scripts/patch-axios-types.cjs is not in the tarball');
  }
  if (!fs.existsSync(path.join(ctx.pkgDir, 'dist', 'index.mjs.map')))
    problems.push('dist/index.mjs.map is missing');
  const mts = path.join(ctx.pkgDir, 'dist', 'index.d.mts');
  const cts = path.join(ctx.pkgDir, 'dist', 'index.d.cts');
  if (
    fs.existsSync(mts) &&
    fs.existsSync(cts) &&
    !fs.readFileSync(mts).equals(fs.readFileSync(cts))
  ) {
    problems.push('dist/index.d.cts is not a copy of dist/index.d.mts');
  }
  // TypeScript before 5.6 cannot parse a string-named export: the key lives in the JavaScript only
  for (const file of [mts, cts]) {
    if (
      fs.existsSync(file) &&
      fs.readFileSync(file, 'utf8').includes('module.exports')
    ) {
      problems.push(
        `${path.basename(file)} names module.exports (TypeScript before 5.6 cannot parse it)`
      );
    }
  }
  const unpacked = walk(ctx.pkgDir).reduce((sum, [, size]) => sum + size, 0);
  if (unpacked > MAX_UNPACKED_BYTES) {
    problems.push(
      `unpacked size ${unpacked} bytes is above ${MAX_UNPACKED_BYTES}`
    );
  }
  if (problems.length > 0) throw new Error(problems.join('; '));
  return { unpackedBytes: unpacked };
}

/** Run a probe in the consumer folder; it must exit 0 and report ok. */
function probe(ctx, file, id) {
  const r = run(ctx.node, [path.join(ctx.consumer, file)], {
    cwd: ctx.consumer,
    env: ctx.env,
    timeout: 120_000,
  });
  const result = lastResult(r.stdout);
  if (r.status !== 0 || !result || result.ok !== true || result.id !== id) {
    throw new Error(describeFailure(file, r));
  }
  return result;
}

function checkStatic(ctx) {
  const text = fs.readFileSync(
    path.join(ctx.pkgDir, 'dist', 'index.mjs'),
    'utf8'
  );
  const plain = count(text, 'createRequire(import.meta.url)');
  const hardened = count(text, 'createRequire(import.meta.url ?? ');
  if (plain !== 0 || hardened !== 1) {
    throw new Error(
      `dist/index.mjs has ${plain} plain and ${hardened} hardened createRequire lines, expected 0 and 1`
    );
  }
  // the 'module.exports' export that the post-build step appends: one statement, one object with the three values
  const slots = [
    ...text.matchAll(/^export \{ (\w+) as 'module\.exports' \};$/gm),
  ];
  const declared =
    slots.length === 1
      ? count(text, `\nconst ${slots[0][1]} = { FrodoError: `)
      : 0;
  if (slots.length !== 1 || declared !== 1) {
    throw new Error(
      `dist/index.mjs has ${slots.length} 'module.exports' export(s) and ${declared} slot declaration(s), expected 1 and 1`
    );
  }
  return { plain, hardened, slot: slots[0][1] };
}

function tsVersion(ctx) {
  if (!ctx.tsVersion) {
    const r = must(
      'tsc --version',
      run(ctx.node, [ctx.tsc, '--version'], { cwd: ctx.consumer, env: ctx.env })
    );
    ctx.tsVersion = /Version (\d+)\.(\d+)/
      .exec(r.stdout)
      ?.slice(1)
      .map(Number) ?? [0, 0];
  }
  return ctx.tsVersion;
}

function checkTypes(ctx, [id, module, moduleResolution, files]) {
  const [major] = tsVersion(ctx);
  const compilerOptions = {
    module,
    moduleResolution,
    target: 'es2022',
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    noEmit: true,
    typeRoots: [path.join(REPO, 'node_modules', '@types')],
    types: ['node'],
  };
  // TypeScript 6 deprecates the old resolution and fails without this; earlier versions do not know the value.
  if (major >= 6 && moduleResolution === 'node10')
    compilerOptions.ignoreDeprecations = '6.0';
  const config = {
    compilerOptions,
    files: files.map((f) => `ts/${f.includes('.') ? f : `${f}.ts`}`),
  };
  const file = path.join(ctx.consumer, `tsconfig.${id}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  const r = run(ctx.node, [ctx.tsc, '-p', file, '--pretty', 'false'], {
    cwd: ctx.consumer,
    env: ctx.env,
  });
  if (r.status !== 0) throw new Error(describeFailure(`tsc ${id}`, r));
  return { files: files.length };
}

async function checkEsbuild(ctx) {
  // The JavaScript API, not `node bin/esbuild`: when an install runs the postinstall script of esbuild, that script
  // replaces bin/esbuild by the native executable, which node cannot run as a script.
  let esbuild;
  try {
    esbuild = createRequire(import.meta.url)('esbuild');
  } catch {
    throw new Error('esbuild is not installed: run npm ci');
  }
  const out = path.join(ctx.consumer, 'bundle', 'out.cjs');
  await esbuild.build({
    absWorkingDir: ctx.consumer,
    entryPoints: [path.join(ctx.consumer, 'bundle', 'app.cjs')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: out,
    logLevel: 'error',
  });
  const r = run(ctx.node, [out], {
    cwd: ctx.consumer,
    env: ctx.env,
    timeout: 120_000,
  });
  const result = lastResult(r.stdout);
  if (r.status !== 0 || !result || result.ok !== true)
    throw new Error(describeFailure('bundle', r));
  return result;
}

/** Node.js that cannot require() an ES module: require fails with ERR_REQUIRE_ESM, import works. */
function checkRequireFails(ctx) {
  const r = run(
    ctx.node,
    [path.join(ctx.consumer, 'cjs', 'p01-destructure.js')],
    { cwd: ctx.consumer, env: ctx.env }
  );
  const result = lastResult(r.stdout);
  if (
    r.status === 0 ||
    !result ||
    result.ok !== false ||
    result.code !== 'ERR_REQUIRE_ESM'
  ) {
    throw new Error(
      `expected ERR_REQUIRE_ESM from require(), got ${describeFailure('p01', r)}`
    );
  }
  return { code: result.code };
}

/** The ordered list of checks: [id, group, function]. */
function checksFor(ctx, opts) {
  if (opts.expectRequireError) {
    return [
      ['X1-require-fails', 'require', () => checkRequireFails(ctx)],
      [
        'X2-import-works',
        'require',
        () => probe(ctx, 'esm/m01-import.mjs', 'm01-import'),
      ],
    ];
  }
  return [
    ['T1-tarball', 'tarball', () => checkTarball(ctx)],
    [
      'T2-destructure',
      'require',
      () => probe(ctx, 'cjs/p01-destructure.js', 'p01-destructure'),
    ],
    ['T2-shape', 'require', () => probe(ctx, 'cjs/p02-shape.js', 'p02-shape')],
    [
      'T3-mutate',
      'require',
      () => probe(ctx, 'cjs/p03-mutate.js', 'p03-mutate'),
    ],
    [
      'T4-single-state',
      'require',
      () => probe(ctx, 'cjs/p04-single-state.js', 'p04-single-state'),
    ],
    [
      'T4-esm-import',
      'require',
      () => probe(ctx, 'esm/m01-import.mjs', 'm01-import'),
    ],
    [
      'T5-roundtrip',
      'require',
      () => probe(ctx, 'cjs/p05-roundtrip.js', 'p05-roundtrip'),
    ],
    [
      'T6-require-cache',
      'require',
      () => probe(ctx, 'cjs/p06-require-cache.js', 'p06-require-cache'),
    ],
    ...TS_MODES.map((mode) => [
      `T7-${mode[0]}`,
      'types',
      () => checkTypes(ctx, mode),
    ]),
    ['T8-esbuild', 'bundle', () => checkEsbuild(ctx)],
    ['T9-static', 'static', () => checkStatic(ctx)],
  ];
}

function selected(id, group, only) {
  if (!only) return true;
  return only.some(
    (token) => token === id || token === group || id.startsWith(`${token}-`)
  );
}

// ------------------------------------------------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const log = (line) => console.error(line);

  if (!opts.tarball && !fs.existsSync(path.join(REPO, 'dist', 'index.mjs'))) {
    const message = 'dist/index.mjs is missing: run `npm run build` first';
    if (opts.json)
      console.log(JSON.stringify({ ok: false, error: message, results: [] }));
    log(`pack-smoke: ${message}`);
    process.exit(1);
  }

  const work = path.join(
    REPO,
    'test',
    'fs_tmp',
    `pack-smoke-${process.pid}-${Date.now()}`
  );
  fs.mkdirSync(path.join(work, 'home'), { recursive: true });
  const env = childEnv(path.join(work, 'home'));
  const results = [];
  let tarball = opts.tarball;
  try {
    if (!tarball) {
      const r = must(
        'npm pack',
        run('npm', ['pack', '--ignore-scripts', '--pack-destination', work], {
          cwd: REPO,
          env,
          timeout: 300_000,
        })
      );
      const name = r.stdout.trim().split('\n').pop();
      tarball = path.join(work, name);
    }
    if (opts.packOnly) {
      const outDir = opts.out ?? process.cwd();
      fs.mkdirSync(outDir, { recursive: true });
      const target = path.join(outDir, path.basename(tarball));
      fs.copyFileSync(tarball, target);
      console.log(target);
      return 0;
    }

    const extract = path.join(work, 'extract');
    fs.mkdirSync(extract);
    must(
      'tar',
      run('tar', ['-xzf', tarball, '-C', extract], { cwd: work, env })
    );
    const consumer = path.join(work, 'consumer');
    fs.mkdirSync(consumer);
    fs.writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify({
        name: 'pack-smoke-consumer',
        version: '0.0.0',
        private: true,
      })
    );
    for (const entry of ['cjs', 'esm', 'ts', 'bundle', 'fakeAm.cjs']) {
      fs.cpSync(path.join(PROBES, entry), path.join(consumer, entry), {
        recursive: true,
      });
    }
    must(
      'npm install',
      run(
        'npm',
        [
          'install',
          '--offline',
          '--no-audit',
          '--no-fund',
          '--ignore-scripts',
          '--no-package-lock',
          tarball,
        ],
        { cwd: consumer, env, timeout: 300_000 }
      )
    );

    const tscCandidates = [
      opts.typescript &&
        path.join(opts.typescript, 'node_modules', 'typescript', 'bin', 'tsc'),
      opts.typescript && path.join(opts.typescript, 'bin', 'tsc'),
      path.join(REPO, 'node_modules', 'typescript', 'bin', 'tsc'),
    ].filter(Boolean);
    const ctx = {
      node: opts.node,
      env,
      consumer,
      pkgDir: path.join(extract, 'package'),
      tsc: tscCandidates.find((c) => fs.existsSync(c)) ?? tscCandidates[0],
    };

    for (const [id, group, fn] of checksFor(ctx, opts)) {
      if (!selected(id, group, opts.only)) continue;
      const started = Date.now();
      let entry;
      try {
        entry = { id, ok: true, ms: 0, detail: await fn() };
      } catch (e) {
        entry = {
          id,
          ok: false,
          ms: 0,
          detail: String(e.message ?? e).slice(0, 1500),
        };
      }
      entry.ms = Date.now() - started;
      results.push(entry);
      log(
        `CHECK ${entry.ok ? 'ok  ' : 'FAIL'} ${id} (${entry.ms} ms)${entry.ok ? '' : `: ${entry.detail}`}`
      );
    }
  } catch (e) {
    results.push({
      id: 'setup',
      ok: false,
      ms: 0,
      detail: String(e.message ?? e).slice(0, 1500),
    });
    log(`CHECK FAIL setup: ${results[results.length - 1].detail}`);
  } finally {
    if (!opts.keep) fs.rmSync(work, { recursive: true, force: true });
  }

  if (opts.packOnly) return 0;
  const ok = results.length > 0 && results.every((r) => r.ok);
  if (opts.json) {
    console.log(JSON.stringify({ ok, node: opts.node, results }, null, 2));
  } else {
    console.log(
      `${results.filter((r) => r.ok).length} of ${results.length} checks passed`
    );
  }
  return ok ? 0 : 1;
}

process.exitCode = await main();
