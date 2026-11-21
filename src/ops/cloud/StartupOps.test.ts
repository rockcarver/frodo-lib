/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record all tests against a ready tenant. applyUpdates test #1
 *             initiates a restart without waiting. applyUpdates test #2
 *             requests a restart without waiting, and requests another one
 *             while the tenant is in 'restarting' state: that second request
 *             fails, which records the "already restarting" error path.
 *    Phase 2: Wait for the tenant to return to 'ready', then re-record all
 *             tests. This time applyUpdates test #1 requests a restart and
 *             waits for it to end. applyUpdates test #2 requests a restart
 *             without waiting, then calls applyUpdates again with wait while
 *             the tenant is 'restarting': it joins the restart that is under
 *             way and waits for it to end, without requesting another one.
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record StartupOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record StartupOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update StartupOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only StartupOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 *
 * The recordings of the waits (phase 2, tests 1 and 2) were trimmed of their
 * repeated polls, which this record allows (a recording of a wait may be
 * trimmed of its repeated polls):
 * https://github.com/rockcarver/frodo-lib/blob/main/decisions/0014-a-recording-of-a-wait-may-be-trimmed-of-its-repeated-polls.md
 * The first poll and the last poll stay, in their real order, so the time
 * between two recorded polls is not the time the tenant took. If you re-record
 * them, trim them the same way. The tests poll fast while they replay and at
 * the real interval while they record, so the number of recorded polls does not
 * decide how long a test takes.
 */
import { RestartStatus } from '../../api/cloud/StartupApi';
import { state } from '../../index';
import * as TestData from '../../test/setup/StartupSetup';
import { sleep } from '../../utils/FrodoUtils';
import * as StartupOps from './StartupOps';

// Replaying needs no real waiting between the polls or before the first one,
// and no pause between two calls; recording against a tenant does (a restart
// takes minutes, and the tenant may still read 'ready' just after the request).
const recording = process.env.FRODO_POLLY_MODE === 'record';
const pollInterval = recording ? 5000 : 10;
const initialDelay = recording ? 5000 : 0;
const pause = async (milliseconds: number) => {
  if (recording) await sleep(milliseconds);
};

describe('StartupOps', () => {
  TestData.setup();

  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('readStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(StartupOps.readStatus).toBeDefined();
      });
      test('1: Get restart status', async () => {
        const response = await StartupOps.readStatus({ state });
        expect(Object.values(RestartStatus)).toContain(response);
        expect(response).toMatchSnapshot();
      });
    });

    describe('checkForUpdates()', () => {
      test('0: Method is implemented', async () => {
        expect(StartupOps.checkForUpdates).toBeDefined();
      });
      test('1: Check for updates', async () => {
        const response = await StartupOps.checkForUpdates({ state });
        expect(response).toHaveProperty('secrets');
        expect(response).toHaveProperty('variables');
        expect(Array.isArray(response.secrets)).toBe(true);
        expect(Array.isArray(response.variables)).toBe(true);
        expect(response).toMatchSnapshot();
      });
    });

    describe('applyUpdates()', () => {
      test('0: Method is implemented', async () => {
        expect(StartupOps.applyUpdates).toBeDefined();
      });
      test('1: Apply updates without waiting', async () => {
        const response = await StartupOps.applyUpdates({
          wait: false,
          pollInterval,
          initialDelay,
          state,
        });
        expect(response).toMatchSnapshot();
      });
      test('2: Apply updates during tenant restart without waiting', async () => {
        await StartupOps.applyUpdates({
          wait: false,
          timeout: 10 * 60 * 1000,
          pollInterval,
          initialDelay,
          state,
        });
        // Wait a bit before attempting another update
        await pause(5000);
        const response = await StartupOps.applyUpdates({
          wait: false,
          timeout: 10 * 60 * 1000,
          pollInterval,
          initialDelay,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('applyUpdates()', () => {
      test(
        '1: Apply updates and wait for completion',
        async () => {
          const response = await StartupOps.applyUpdates({
            wait: true,
            timeout: 10 * 60 * 1000,
            pollInterval,
            initialDelay,
            state,
          });
          expect(response).toMatchSnapshot();
        },
        15 * 60 * 1000
      );
      test('2: Apply updates during tenant restart', async () => {
        await StartupOps.applyUpdates({
          wait: false,
          timeout: 10 * 60 * 1000,
          pollInterval,
          initialDelay,
          state,
        });
        // Wait a bit before waiting for it to finish
        await pause(10000);
        const response = await StartupOps.applyUpdates({
          wait: true,
          timeout: 10 * 60 * 1000,
          pollInterval,
          initialDelay,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }
});
