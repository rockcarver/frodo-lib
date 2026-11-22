import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isolatedChildEnv } from '../test/support/runWorkers';

/*
 * scripts/patch-axios-types.cjs is the `prepare` script of the package: it points the `require` condition of the
 * `types` entry in node_modules/axios/package.json at ./index.d.ts, which the declaration bundler can read
 * (BUILD-ENV.md section 2.3). It finds axios through its own location, so each test copies it into a small fake
 * project in a temporary folder and runs it there; the real node_modules is never touched. The script starts no
 * process, so these tests cannot start themselves again. No build is needed.
 */

const SCRIPT = path.resolve(process.cwd(), 'scripts/patch-axios-types.cjs');

let project: string;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-axios-types-'));
  fs.mkdirSync(path.join(project, 'scripts'));
  fs.copyFileSync(
    SCRIPT,
    path.join(project, 'scripts', 'patch-axios-types.cjs')
  );
});
afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

/** The part of axios's package.json that the script reads, in the shape of the real one. */
const axiosPackage = (types: Record<string, string> | undefined) => ({
  name: 'axios',
  version: '0.0.0-test',
  exports: {
    '.': {
      ...(types ? { types } : {}),
      default: { require: './dist/node/axios.cjs', default: './index.js' },
    },
  },
});
const UNPATCHED = { require: './index.d.cts', default: './index.d.ts' };

const axiosFile = () =>
  path.join(project, 'node_modules', 'axios', 'package.json');
function installAxios(content: object): string {
  fs.mkdirSync(path.dirname(axiosFile()), { recursive: true });
  const text = JSON.stringify(content, null, 2) + '\n';
  fs.writeFileSync(axiosFile(), text);
  return text;
}
function runScript() {
  const r = spawnSync(
    process.execPath,
    [path.join(project, 'scripts', 'patch-axios-types.cjs')],
    { cwd: project, env: isolatedChildEnv(), encoding: 'utf8', timeout: 60_000 }
  );
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('scripts/patch-axios-types.cjs', () => {
  test('exits 0 and says nothing when axios is not installed (an install without dev dependencies)', () => {
    const r = runScript();
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('');
    expect(fs.existsSync(path.join(project, 'node_modules'))).toBe(false);
  });

  test('points the require condition of the types entry at ./index.d.ts and changes nothing else', () => {
    installAxios(axiosPackage(UNPATCHED));
    const r = runScript();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('require-condition types -> ./index.d.ts');
    expect(JSON.parse(fs.readFileSync(axiosFile(), 'utf8'))).toEqual(
      axiosPackage({ require: './index.d.ts', default: './index.d.ts' })
    );
  });

  test('is idempotent: the second run says so, exits 0 and leaves the file as the first run wrote it', () => {
    installAxios(axiosPackage(UNPATCHED));
    expect(runScript().status).toBe(0);
    const afterFirst = fs.readFileSync(axiosFile(), 'utf8');
    const second = runScript();
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('already applied');
    expect(fs.readFileSync(axiosFile(), 'utf8')).toBe(afterFirst);
  });

  test('leaves a file that is already patched byte for byte alone', () => {
    const text = installAxios(
      axiosPackage({ require: './index.d.ts', default: './index.d.ts' })
    );
    const r = runScript();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('already applied');
    expect(fs.readFileSync(axiosFile(), 'utf8')).toBe(text);
  });

  test('exits 0 and leaves the file alone when axios has no types entry to patch', () => {
    const text = installAxios(axiosPackage(undefined));
    const r = runScript();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('not found; skipping');
    expect(fs.readFileSync(axiosFile(), 'utf8')).toBe(text);
  });
});
