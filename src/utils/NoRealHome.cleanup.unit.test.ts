/**
 * Run with:
 *
 *        npm run test:only NoRealHome.cleanup
 *
 * The guard of `test/jest-no-real-home.setup.js` removes the temporary home of a test file after the file. A test file
 * cannot look at what happens after its own last test, so this test runs jest on two small test files
 * (`test/support/noRealHomeFixtureAsks.cjs` and `noRealHomeFixtureQuiet.cjs`) with the same guard, and looks at the
 * directories they leave behind:
 *
 *  - a test file that asks for the home: the directory exists while it runs and is gone afterwards;
 *  - a test file that never asks: the directory is not made at all (a skipped suite leaves nothing).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isolatedChildEnv } from '../../test/support/runWorkers';

const ROOT = path.resolve('.');
const JEST = path.join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js');
const FIXTURES = [
  'noRealHomeFixtureAsks.cjs',
  'noRealHomeFixtureQuiet.cjs',
].map((f) => path.join(ROOT, 'test', 'support', f));

type Seen = { named: string; home?: string; existsDuringTest: boolean };

describe('the guard removes the temporary home of a test file', () => {
  let out: string;
  let result: ReturnType<typeof spawnSync>;
  let asks: Seen;
  let quiet: Seen;

  beforeAll(() => {
    out = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'frodo-guard-fixture-')
    );
    // jest runs in a directory of its own: in the repository it would also report the snapshot files as obsolete
    const rootDir = path.join(out, 'root');
    const seenDir = path.join(out, 'seen');
    fs.mkdirSync(rootDir);
    fs.mkdirSync(seenDir);
    for (const fixture of FIXTURES) {
      fs.copyFileSync(fixture, path.join(rootDir, path.basename(fixture)));
    }
    const config = {
      rootDir,
      testEnvironment: 'node',
      testRunner: path.join(ROOT, 'node_modules', 'jest-jasmine2'),
      testMatch: ['**/*.cjs'],
      setupFilesAfterEnv: [
        path.join(ROOT, 'test', 'jest-no-real-home.setup.js'),
      ],
      transform: {},
    };
    result = spawnSync(
      process.execPath,
      [JEST, '--config', JSON.stringify(config), '--runInBand', '--silent'],
      {
        cwd: rootDir,
        encoding: 'utf8',
        env: { ...isolatedChildEnv(), GUARD_FIXTURE_OUT: seenDir },
        timeout: 120000,
      }
    );
    const read = (name: string) =>
      JSON.parse(fs.readFileSync(path.join(seenDir, name), 'utf8')) as Seen;
    asks = read('asks.json');
    quiet = read('quiet.json');
  });

  afterAll(() => {
    // what a missing cleanup would leave: remove it, so that a failing run does not litter the temporary directory
    for (const seen of [asks, quiet]) {
      if (
        seen?.named &&
        path.basename(seen.named).startsWith('frodo-test-home-')
      ) {
        fs.rmSync(seen.named, { recursive: true, force: true });
      }
    }
    if (out) fs.rmSync(out, { recursive: true, force: true });
  });

  test('1: the two fixture test files ran and passed under the guard', () => {
    expect(result.status).toBe(0);
    expect(asks.named).toBe(asks.home);
    expect(path.basename(asks.named)).toMatch(/^frodo-test-home-/);
    expect(path.dirname(asks.named)).toBe(fs.realpathSync(os.tmpdir()));
  });

  test('2: a test file that asks for the home has the directory while it runs and no directory afterwards', () => {
    expect(asks.existsDuringTest).toBe(true);
    expect(fs.existsSync(asks.named)).toBe(false);
  });

  test('3: a test file that never asks for the home does not get a directory, while it runs or afterwards', () => {
    expect(path.basename(quiet.named)).toMatch(/^frodo-test-home-/);
    expect(quiet.existsDuringTest).toBe(false);
    expect(fs.existsSync(quiet.named)).toBe(false);
  });

  test('4: the two files had different temporary homes', () => {
    expect(asks.named).not.toBe(quiet.named);
  });
});
