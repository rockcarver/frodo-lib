import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path, { resolve } from 'node:path';
import { isolatedChildEnv } from '../test/support/runWorkers';

/*
 * The packed package, as a consumer gets it: scripts/pack-smoke.mjs packs the working tree, installs the tarball
 * offline into a scratch folder and runs `require`, `import`, TypeScript under five module resolutions and an esbuild
 * bundle against it (decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md).
 * This file runs the script once and asserts one result per check.
 *
 * Unlike the other tests it needs a build: run `npm run build` first. Without `dist/` every test here FAILS (it never
 * skips), and so does the packed run of `npm test`. It uses a loopback fake AM and no recordings, so it is named
 * `.test.ts` like BaseApi.connectionReuse.test.ts, which has the same need. `npm run test:packed` runs the script
 * without Jest.
 */

const SCRIPT = resolve('.', 'scripts', 'pack-smoke.mjs');
const MAX_MS_PER_CHECK = 60_000;
const WHOLE_RUN_TIMEOUT_MS = 600_000;

const EXPECTED_IDS = [
  'T1-tarball',
  'T2-destructure',
  'T2-shape',
  'T3-mutate',
  'T4-single-state',
  'T4-esm-import',
  'T5-roundtrip',
  'T6-require-cache',
  'T7-commonjs-node10',
  'T7-esnext-node10',
  'T7-node16',
  'T7-nodenext',
  'T7-preserve-bundler',
  'T8-esbuild',
  'T9-static',
];

interface CheckResult {
  id: string;
  ok: boolean;
  ms: number;
  detail: unknown;
}
interface Report {
  ok: boolean;
  error?: string;
  results: CheckResult[];
}

let run: Promise<Report> | undefined;

/** Run the script once for the whole file; every test awaits the same run. */
function packedRun(): Promise<Report> {
  run ??= new Promise<Report>((resolveRun, rejectRun) => {
    const env = isolatedChildEnv();
    // The script must not hand these on to what it starts (the first probe fails when it sees one):
    // Node.js options and the proxy settings of the machine.
    env.NODE_OPTIONS = `--no-warnings ${env.NODE_OPTIONS ?? ''}`.trim();
    env.HTTPS_PROXY = 'http://127.0.0.1:9';
    env.HTTP_PROXY = 'http://127.0.0.1:9';
    env.ALL_PROXY = 'http://127.0.0.1:9';
    const child = spawn(process.execPath, [SCRIPT, '--json'], {
      cwd: resolve('.'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', rejectRun);
    child.on('close', (code) => {
      try {
        const report = JSON.parse(stdout) as Report;
        if (report.error) {
          rejectRun(new Error(`pack-smoke: ${report.error}`));
        } else {
          resolveRun(report);
        }
      } catch {
        rejectRun(
          new Error(
            `pack-smoke exited ${code} without a JSON report: ${stderr.slice(-800)}`
          )
        );
      }
    });
  });
  return run;
}

describe('the packed package', () => {
  test(
    'runs exactly the expected checks',
    async () => {
      const report = await packedRun();
      expect(report.results.map((r) => r.id)).toEqual(EXPECTED_IDS);
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test.each(EXPECTED_IDS)(
    '%s passes within a minute',
    async (id) => {
      const report = await packedRun();
      const result = report.results.find((r) => r.id === id);
      if (!result) throw new Error(`no result for ${id}`);
      if (!result.ok) {
        throw new Error(`${id} failed: ${JSON.stringify(result.detail)}`);
      }
      expect(result.ms).toBeLessThan(MAX_MS_PER_CHECK);
    },
    WHOLE_RUN_TIMEOUT_MS
  );
});

/** Pack a fake package that holds only the given dist/index.mjs into a tarball and return its path. */
function fakeTarball(
  folder: string,
  indexMjs: string,
  extraPackageJson: Record<string, unknown> = {},
  extraDist: Record<string, string> = {},
  extraFiles: Record<string, string> = {}
): string {
  const root = path.join(folder, 'package');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: '@rockcarver/frodo-lib',
      version: '0.0.0',
      ...extraPackageJson,
    })
  );
  fs.writeFileSync(path.join(root, 'dist', 'index.mjs'), indexMjs);
  for (const [name, text] of Object.entries(extraDist)) {
    fs.writeFileSync(path.join(root, 'dist', name), text);
  }
  for (const [name, text] of Object.entries(extraFiles)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  const tarball = path.join(folder, 'fake.tgz');
  const r = spawnSync('tar', ['-czf', tarball, '-C', folder, 'package'], {
    env: isolatedChildEnv(),
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`tar failed: ${r.stderr}`);
  return tarball;
}

const HARDENED_LINE =
  'var r = createRequire(import.meta.url ?? (typeof __filename !== "undefined" ? __filename : process.cwd() + "/x.js"));';
const SLOT_LINES = [
  'const commonJsExports = { FrodoError: FrodoError, frodo: frodo, state: state };',
  "export { commonJsExports as 'module.exports' };",
];
const MAP_LINE = '//# sourceMappingURL=index.mjs.map';
/** A small bundle as the build leaves it; the options break one thing at a time. */
const FAKE_BUNDLE = (
  line: string,
  options: {
    slot?: boolean;
    list?: string;
    map?: 'last' | 'missing' | 'before-slot';
  } = {}
) => {
  const {
    slot = true,
    list = 'export { FrodoError, frodo, state };',
    map = 'last',
  } = options;
  return (
    [
      'import { createRequire } from "node:module";',
      line,
      'const FrodoError = 1, frodo = 2, state = 3;',
      list,
      ...(map === 'before-slot' ? [MAP_LINE] : []),
      ...(slot ? SLOT_LINES : []),
      '',
      ...(map === 'last' ? [MAP_LINE] : []),
    ].join('\n') + '\n'
  );
};

describe('the exit code of scripts/pack-smoke.mjs', () => {
  let folder: string;
  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-smoke-test-'));
  });
  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  /** Run the script on a fake tarball; it starts only npm, tar and node, never itself. */
  function runOn(tarball: string, only: string) {
    const r = spawnSync(
      process.execPath,
      [SCRIPT, '--json', '--only', only, '--tarball', tarball],
      {
        cwd: resolve('.'),
        env: isolatedChildEnv(),
        encoding: 'utf8',
        timeout: 120_000,
      }
    );
    return { status: r.status, report: JSON.parse(r.stdout) as Report };
  }
  const staticCheck = (indexMjs: string) =>
    runOn(fakeTarball(folder, indexMjs), 'T9-static');

  test(
    'is 1 and the report says ok: false when a check fails',
    () => {
      const { status, report } = staticCheck(
        FAKE_BUNDLE('var r = createRequire(import.meta.url);')
      );
      expect(status).toBe(1);
      expect(report.ok).toBe(false);
      expect(report.results.map((r) => [r.id, r.ok])).toEqual([
        ['T9-static', false],
      ]);
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test(
    'is 0 and the report says ok: true when the check passes',
    () => {
      const { status, report } = staticCheck(FAKE_BUNDLE(HARDENED_LINE));
      expect(status).toBe(0);
      expect(report.ok).toBe(true);
      expect(report.results.map((r) => [r.id, r.ok])).toEqual([
        ['T9-static', true],
      ]);
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test(
    'names a dependency of the package in T1, which runs before the install that cannot fetch it',
    () => {
      const withDependency = runOn(
        fakeTarball(folder, FAKE_BUNDLE(HARDENED_LINE), {
          dependencies: { 'left-pad': '1.3.0' },
        }),
        'T1-tarball'
      );
      expect(withDependency.status).toBe(1);
      expect(String(withDependency.report.results[0].detail)).toContain(
        'dependencies is not empty'
      );
      // with a check that needs the install selected, the install fails offline (the dependency is not in any
      // cache) and the report still carries the T1 result that names the reason
      fs.rmSync(path.join(folder, 'package'), { recursive: true, force: true });
      const installFails = runOn(
        fakeTarball(folder, FAKE_BUNDLE(HARDENED_LINE), {
          dependencies: { 'left-pad': '1.3.0' },
        }),
        'T1-tarball,T2-shape'
      );
      expect(installFails.status).toBe(1);
      expect(installFails.report.results.map((r) => r.id)).toEqual([
        'T1-tarball',
        'setup',
      ]);
      expect(String(installFails.report.results[0].detail)).toContain(
        'dependencies is not empty'
      );
      // without a dependency the message is not there
      fs.rmSync(path.join(folder, 'package'), { recursive: true, force: true });
      const clean = runOn(
        fakeTarball(folder, FAKE_BUNDLE(HARDENED_LINE)),
        'T1-tarball'
      );
      expect(String(clean.report.results[0].detail)).not.toContain(
        'dependencies is not empty'
      );
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  /** Run T9 on a fake bundle that has a hardened createRequire line; return the exit status and T9's detail. */
  function staticDetail(options: Parameters<typeof FAKE_BUNDLE>[1]) {
    fs.rmSync(path.join(folder, 'package'), { recursive: true, force: true });
    const { status, report } = staticCheck(FAKE_BUNDLE(HARDENED_LINE, options));
    return { status, detail: String(report.results[0].detail) };
  }

  test(
    'T9 fails, naming the slot, when the bundle has no module.exports export',
    () => {
      const { status, detail } = staticDetail({ slot: false });
      expect(status).toBe(1);
      expect(detail).toContain("0 'module.exports' export(s)");
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test(
    'T9 fails when the export list of the bundle exports module.exports as well (the module would not load)',
    () => {
      const { status, detail } = staticDetail({
        list: 'export { FrodoError, frodo, state, state as "module.exports" };',
      });
      expect(status).toBe(1);
      expect(detail).toContain('2 export(s) of that name in all');
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test(
    'T9 fails when the sourceMappingURL comment is not the last line, or is gone',
    () => {
      for (const map of ['before-slot', 'missing'] as const) {
        const { status, detail } = staticDetail({ map });
        expect(status).toBe(1);
        expect(detail).toContain('must end with its //# sourceMappingURL');
      }
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  /** Run T1 on a fake package; return the exit status and T1's detail. */
  function tarballDetail(
    extraPackageJson: Record<string, unknown>,
    extraFiles: Record<string, string> = {}
  ) {
    fs.rmSync(path.join(folder, 'package'), { recursive: true, force: true });
    const { status, report } = runOn(
      fakeTarball(
        folder,
        FAKE_BUNDLE(HARDENED_LINE),
        extraPackageJson,
        {},
        extraFiles
      ),
      'T1-tarball'
    );
    return { status, detail: String(report.results[0].detail) };
  }
  const AXIOS_PATCH = 'node scripts/patch-axios-types.cjs';

  test.each(['preinstall', 'install', 'postinstall'])(
    'T1 names the %s script of the package (a consumer install must run and list none)',
    (name) => {
      const { status, detail } = tarballDetail({
        scripts: { prepare: AXIOS_PATCH, [name]: AXIOS_PATCH },
      });
      expect(status).toBe(1);
      expect(detail).toContain(`scripts.${name} is ${AXIOS_PATCH}`);
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test(
    'T1 names a package without the prepare script that applies the axios patch, and says nothing about scripts when it has it',
    () => {
      const without = tarballDetail({});
      expect(without.status).toBe(1);
      expect(without.detail).toContain('scripts.prepare is undefined');
      const wrong = tarballDetail({ scripts: { prepare: 'node other.cjs' } });
      expect(wrong.detail).toContain('scripts.prepare is node other.cjs');
      const right = tarballDetail({ scripts: { prepare: AXIOS_PATCH } });
      expect(right.detail).not.toContain('scripts.');
      expect(right.detail).not.toContain('scripts/');
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test(
    'T1 names a scripts folder in the tarball (the axios patch is not shipped)',
    () => {
      const { status, detail } = tarballDetail(
        { scripts: { prepare: AXIOS_PATCH } },
        { 'scripts/patch-axios-types.cjs': '// the patch\n' }
      );
      expect(status).toBe(1);
      expect(detail).toContain('scripts/ is in the tarball');
    },
    WHOLE_RUN_TIMEOUT_MS
  );

  test(
    'T1 names a declaration file that carries the module.exports key',
    () => {
      const declaration = 'export { x as "module.exports" };\n';
      const r = runOn(
        fakeTarball(
          folder,
          FAKE_BUNDLE(HARDENED_LINE),
          {},
          {
            'index.d.mts': declaration,
            'index.d.cts': declaration,
          }
        ),
        'T1-tarball'
      );
      expect(r.status).toBe(1);
      expect(String(r.report.results[0].detail)).toContain(
        'index.d.mts names module.exports'
      );
    },
    WHOLE_RUN_TIMEOUT_MS
  );
});
