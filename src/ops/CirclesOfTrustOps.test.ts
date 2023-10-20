/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    This step breaks down into phases:
 *
 *    Phase 1: non-destructive and non-conflicting tests
 *    Phase 2: Delete by id and import single
 *    Phase 3: Import all
 *    Phase 4: Delete all
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state variables required to connect to the
 *    env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record CirclesOfTrustOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record CirclesOfTrustOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record CirclesOfTrustOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record CirclesOfTrustOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        npm run test:update CirclesOfTrustOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only CirclesOfTrustOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as CirclesOfTrustOps from './CirclesOfTrustOps';
import * as Saml2Ops from './Saml2Ops';
import Constants from '../shared/Constants';
import { Saml2ProiderLocation } from '../api/Saml2Api';
import {
  getCircleOfTrustRawData,
  getCirclesOfTrustImportData,
  getSaml2ProviderImportData,
  getSaml2ProvidersImportData,
} from '../test/mocks/ForgeRockApiMockEngine';
import { encodeBase64Url } from '../utils/Base64Utils';
import { autoSetupPolly, filterRecording } from '../utils/AutoSetupPolly';
import { CircleOfTrustSkeleton } from '../api/CirclesOfTrustApi';
import { getCircleOfTrustImportData } from '../test/mocks/ForgeRockApiMockEngine';

const ctx = autoSetupPolly();

state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);

async function stageProviders(create = true) {
  // delete if exists, then create
  try {
    await Saml2Ops.deleteSaml2Providers({ state });
  } catch (error) {
    if (error.isAxiosError) {
      console.log(`Error deleting providers: ${error.message}`);
      console.dir(error.response?.data);
    }
  } finally {
    if (create) {
      try {
        await Saml2Ops.importSaml2Providers({
          importData: getSaml2ProvidersImportData('cotTestProviders.saml.json'),
          state,
        });
      } catch (error) {
        console.log(`Error importing providers: ${error.message}`);
        console.dir(error.response?.data);
      }
    }
  }
}

async function stageCircleOfTrust(cotId, create = true) {
  // delete if exists, then create
  try {
    await CirclesOfTrustOps.readCircleOfTrust({ cotId, state });
    await CirclesOfTrustOps.deleteCircleOfTrust({ cotId, state });
  } catch (error) {
    if (error.isAxiosError) {
      console.log(
        `Error deleting circle of trust '${cotId}': ${error.message}`
      );
      console.dir(error.response?.data);
    }
  } finally {
    if (create) {
      try {
        await CirclesOfTrustOps.importCircleOfTrust({
          cotId,
          importData: getCircleOfTrustImportData(cotId),
          state,
        });
      } catch (error) {
        console.log(
          `Error importing circle of trust '${cotId}': ${error.message}`
        );
        console.dir(error.response?.data);
      }
    }
  }
}

describe('CirclesOfTrustOps', () => {
  const cot1 = 'AzureCOT';
  const cot2 = 'FR_COT';
  const cot3 = '2f04818d-561e-4f8a-82e8-af2426112138';
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await stageProviders(true);
      await stageCircleOfTrust(cot1, false);
      await stageCircleOfTrust(cot2, true);
      await stageCircleOfTrust(cot3, true);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await stageProviders(true);
      await stageCircleOfTrust(cot1, false);
      await stageCircleOfTrust(cot2, true);
      await stageCircleOfTrust(cot3, false);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3'
    ) {
      await stageProviders(true);
      await stageCircleOfTrust(cot1, false);
      await stageCircleOfTrust(cot2, false);
      await stageCircleOfTrust(cot3, false);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4'
    ) {
      await stageProviders(true);
      await stageCircleOfTrust(cot1, true);
      await stageCircleOfTrust(cot2, true);
      await stageCircleOfTrust(cot3, true);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // leave behind the providers such as to not have an empty frodo-dev
      await stageProviders(true);
      await stageCircleOfTrust(cot1, true);
      await stageCircleOfTrust(cot2, true);
      await stageCircleOfTrust(cot3, true);
    }
  });
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
    describe('createCirclesOfTrustExportTemplate()', () => {
      test('0: Method is implemented', () => {
        expect(
          CirclesOfTrustOps.createCirclesOfTrustExportTemplate
        ).toBeDefined();
      });

      test('1: Create circles of trust export template', () => {
        const response = CirclesOfTrustOps.createCirclesOfTrustExportTemplate({
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createCircleOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.createCircleOfTrust).toBeDefined();
      });

      test(`1: Create circle of trust '${cot1}'`, async () => {
        const response = await CirclesOfTrustOps.createCircleOfTrust({
          cotId: cot1,
          cotData: getCircleOfTrustRawData(cot1),
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readCirclesOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.readCirclesOfTrust).toBeDefined();
      });

      test('1: Read circles of trust', async () => {
        const response = await CirclesOfTrustOps.readCirclesOfTrust({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readCircleOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.readCircleOfTrust).toBeDefined();
      });

      test(`1: Read circle of trust '${cot2}'`, async () => {
        const response = await CirclesOfTrustOps.readCircleOfTrust({
          cotId: cot2,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('updateCircleOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.updateCircleOfTrust).toBeDefined();
      });

      test(`1: Update circle of trust '${cot3}'`, async () => {
        const response = await CirclesOfTrustOps.updateCircleOfTrust({
          cotId: cot3,
          cotData: getCircleOfTrustRawData(cot3),
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportCirclesOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.exportCirclesOfTrust).toBeDefined();
      });

      test('1: Export circles of trust', async () => {
        const response = await CirclesOfTrustOps.exportCirclesOfTrust({
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('exportCircleOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.exportCircleOfTrust).toBeDefined();
      });

      test(`1: Export circle of trust '${cot2}'`, async () => {
        const response = await CirclesOfTrustOps.exportCircleOfTrust({
          cotId: cot2,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });
  }

  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('importCircleOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.importCircleOfTrust).toBeDefined();
      });

      test(`1: Import circle of trust '${cot1}'`, async () => {
        const response = await CirclesOfTrustOps.importCircleOfTrust({
          cotId: cot1,
          importData: getCircleOfTrustImportData(cot1),
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('deleteCircleOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.deleteCircleOfTrust).toBeDefined();
      });

      test(`1: Delete circle of trust '${cot2}'`, async () => {
        const response = await CirclesOfTrustOps.deleteCircleOfTrust({
          cotId: cot2,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 3
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3')
  ) {
    describe('importCirclesOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.importCirclesOfTrust).toBeDefined();
      });

      test('1: Import circles of trust', async () => {
        const response = await CirclesOfTrustOps.importCirclesOfTrust({
          importData: getCirclesOfTrustImportData(),
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 4
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4')
  ) {
    describe('deleteCirclesOfTrust()', () => {
      test('0: Method is implemented', async () => {
        expect(CirclesOfTrustOps.deleteCirclesOfTrust).toBeDefined();
      });

      test(`1: Delete all circles of trust`, async () => {
        const response = await CirclesOfTrustOps.deleteCirclesOfTrust({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }
});
