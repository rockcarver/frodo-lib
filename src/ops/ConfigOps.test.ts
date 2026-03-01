/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record tests that require cloud deployment
 *    Phase 2: Record tests that require classic deployment
 *    Phase 3: Record tests that require iga cloud deployment
 *
 *    Because certain tests can only be successfully ran in classic deployments and/or
 *    cloud deployments, they have to be run in groups so that it is possible to record
 *    each group of tests using their appropriate deployments. Make sure to set the
 *    FRODO_HOST and FRODO_REALM environment variables when recording to ensure you
 *    are using the right deployment (by default these are set to the frodo-dev cloud tenant
 *    and alpha realm respectively). Alternatively, you can use FRODO_DEPLOY=classic to
 *    use the default settings of host/realm for classic deployments.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ConfigOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ConfigOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only ConfigOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */

import { autoSetupPolly, setDefaultState } from "../utils/AutoSetupPolly";
import { filterRecording } from '../utils/PollyUtils';
import * as ConfigOps from "./ConfigOps";
import { state } from "../index";
import Constants from '../shared/Constants';
import { snapshotResultCallback } from "../test/utils/TestUtils";

const ctx = autoSetupPolly();

describe('ConfigOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('Cloud Tests', () => {
      beforeEach(() => {
        setDefaultState();
      });
      describe('exportFullConfiguration()', () => {
        test('0: Method is implemented', async () => {
          expect(ConfigOps.exportFullConfiguration).toBeDefined();
        });

        test('1: Export everything with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: true,
              onlyRealm: false,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });

        test('2: Export everything without string arrays, decoding variables, excluding journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: false,
              noDecode: true,
              coords: false,
              includeDefault: false,
              includeActiveValues: false,
              includeReadOnly: true,
              onlyRealm: false,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });

        test('3: Export only importable config with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: false,
              onlyRealm: false,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });
  
        test('4: Export only alpha realm config with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: true,
              onlyRealm: true,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });
  
        test('5: Export only global config with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: true,
              onlyRealm: false,
              onlyGlobal: true,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });
      });

      describe('importFullConfiguration()', () => {
        test('0: Method is implemented', async () => {
          expect(ConfigOps.importFullConfiguration).toBeDefined();
        });
        // TODO: Write tests for full import
      });
    });
  }

  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('Classic Tests', () => {
      beforeEach(() => {
        setDefaultState(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
      });
      describe('exportFullConfiguration()', () => {
        test('6: Export everything with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: true,
              onlyRealm: false,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });

        test('7: Export everything without string arrays, decoding variables, excluding journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: false,
              noDecode: true,
              coords: false,
              includeDefault: false,
              includeActiveValues: false,
              includeReadOnly: true,
              onlyRealm: false,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });

        test('8: Export only importable with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: false,
              onlyRealm: false,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });

        test('9: Export only root realm config with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: true,
              onlyRealm: true,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });

        test('10: Export only global config with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: true,
              onlyRealm: false,
              onlyGlobal: true,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });
      });

      describe('importFullConfiguration()', () => {
        // TODO: Write tests for full import
      });
    });
  }

  // Phase 3
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3')
  ) {
    describe('IGA Cloud Tests', () => {
      beforeEach(() => {
        state.setIsIGA(true);
        setDefaultState();
      });
      describe('exportFullConfiguration()', () => {
        test('0: Export everything including IGA configuration', async () => {
          const response = await ConfigOps.exportFullConfiguration({
            options: {
              useStringArrays: true,
              noDecode: false,
              coords: true,
              includeDefault: true,
              includeActiveValues: true,
              includeReadOnly: true,
              onlyRealm: false,
              onlyGlobal: false,
            },
            resultCallback: snapshotResultCallback,
            state
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object)
          });
        });
      });

      describe('importFullConfiguration()', () => {
        // TODO: Write tests for full import
      });
    });
  }
});
