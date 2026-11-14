/**
 * Run with:
 *
 *        npm run test:only NoRealHome.workers
 *
 * The guard of `test/jest-no-real-home.setup.js` changes `os.homedir()`, `HOME` and `USERPROFILE` in the test. A process
 * that a test starts does not see that: it gets the environment of the test runner's own process unless the test passes
 * an `env`. `runWorker` of `test/support/runWorkers.ts` passes `isolatedChildEnv()`; this test starts a worker that says
 * which home it sees.
 */
import os from 'os';
import { isolatedChildEnv, runWorker } from '../../test/support/runWorkers';

const testHome = process.env.FRODO_TEST_HOME as string;
const realHome = process.env.FRODO_TEST_REAL_HOME as string;

describe('processes started by a test see the temporary home', () => {
  test('1: isolatedChildEnv sets HOME and USERPROFILE to the temporary home and keeps the rest of the environment', () => {
    expect(os.homedir()).toBe(testHome);
    expect(os.homedir()).not.toBe(realHome);
    process.env.FRODO_GUARD_WORKERS_PROBE = 'kept';
    const before = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    };
    try {
      expect(isolatedChildEnv().HOME).toBe(testHome);
      expect(isolatedChildEnv().USERPROFILE).toBe(testHome);
      // a test that changed the variables in its own environment does not change what a child gets
      process.env.HOME = '/somewhere/else';
      process.env.USERPROFILE = '/somewhere/else';
      const env = isolatedChildEnv();
      expect(env.HOME).toBe(testHome);
      expect(env.USERPROFILE).toBe(testHome);
      expect(env.FRODO_GUARD_WORKERS_PROBE).toBe('kept');
      expect(env.PATH).toBe(process.env.PATH);
    } finally {
      delete process.env.FRODO_GUARD_WORKERS_PROBE;
      process.env.HOME = before.HOME;
      process.env.USERPROFILE = before.USERPROFILE;
    }
  });

  test('2: a worker started with runWorker sees the temporary home as os.homedir(), HOME and USERPROFILE', async () => {
    expect(os.homedir()).toBe(testHome);
    const seen = await runWorker<{
      homedir: string;
      HOME: string;
      USERPROFILE: string;
    }>('homeProbeWorker.ts', {});
    expect(seen.homedir).toBe(testHome);
    expect(seen.HOME).toBe(testHome);
    expect(seen.USERPROFILE).toBe(testHome);
    expect(seen.homedir).not.toBe(realHome);
  });
});
