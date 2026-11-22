import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
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
    delete env.NODE_OPTIONS;
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
