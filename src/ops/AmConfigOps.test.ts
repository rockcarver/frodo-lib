/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record tests that require cloud deployment
 *    Phase 2: Record tests that require classic deployment
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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record AmConfigOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AmConfigOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only AmConfigOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly, setDefaultState } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as AmConfigOps from "./AmConfigOps";
import { state } from "../lib/FrodoLib";
import Constants from "../shared/Constants";

const ctx = autoSetupPolly();

describe('AmConfigOps', () => {
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
      describe('createConfigEntityExportTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(AmConfigOps.createConfigEntityExportTemplate).toBeDefined();
        });

        test('1: Create AM Config Export Template', async () => {
          const response = await AmConfigOps.createConfigEntityExportTemplate({realms: ['alpha', 'bravo'], state});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('2: Create AM Config Export Template without provided realms', async () => {
          const response = await AmConfigOps.createConfigEntityExportTemplate({state});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportAmConfigEntities()', () => {
        test('0: Method is implemented', async () => {
          expect(AmConfigOps.exportAmConfigEntities).toBeDefined();
        });

        test('1: Export AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: true, onlyRealm: false, onlyGlobal: false, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('2: Export importable AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: false, onlyRealm: false, onlyGlobal: false, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('3: Export alpha realm AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: true, onlyRealm: true, onlyGlobal: false, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('4: Export global AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: true, onlyRealm: false, onlyGlobal: true, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('importAmConfigEntities()', () => {
        test('0: Method is implemented', async () => {
          expect(AmConfigOps.importAmConfigEntities).toBeDefined();
        });

        //TODO: Make tests
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

      describe('exportAmConfigEntities()', () => {
        test('5: Export AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: true, onlyRealm: false, onlyGlobal: false, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('6: Export importable AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: false, onlyRealm: false, onlyGlobal: false, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('7: Export root realm AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: true, onlyRealm: true, onlyGlobal: false, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('8: Export global AM Config Entities', async () => {
          const response = await AmConfigOps.exportAmConfigEntities({ includeReadOnly: true, onlyRealm: false, onlyGlobal: true, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('importAmConfigEntities()', () => {
        //TODO: Make tests
      });
    });
  }
});
