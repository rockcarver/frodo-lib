/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record all tests against a ready tenant. applyUpdates test #1
 *             initiates a restart, so applyUpdates test #2 runs while the
 *             tenant is in 'restarting' state and records the "already
 *             restarting" error path.
 *    Phase 2: Wait for the tenant to return to 'ready', then re-record all
 *             tests. This time applyUpdates test #2 runs against a ready
 *             tenant, initiates a restart, and waits for completion.
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
 */
import { state } from '../../index';
import * as TestData from '../../test/setup/StartupSetup';
import * as StartupOps from './StartupOps';
import { RestartStatus } from '../../api/cloud/StartupApi';

describe('StartupOps', () => {
  TestData.setup();

  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('getStatus()', () => {
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
          state,
        });
        expect(response).toMatchSnapshot();
      });
      test('2: Apply updates during tenant restart', async () => {
        const response = await StartupOps.applyUpdates({
          wait: true,
          timeout: 10 * 60 * 1000,
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
            state,
          });
          expect(response).toMatchSnapshot();
        },
        15 * 60 * 1000
      );
    });
  }
});