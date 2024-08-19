import * as EnvPromotionApi from './EnvPromotionApi';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
// import { filterRecording } from '../../utils/PollyUtils';
// import { state } from '../../index';

const ctx = autoSetupPolly();

describe('EnvPromotionApi', () => {
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    // 
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    // 
  });
  beforeEach(async () => {
    // if (process.env.FRODO_POLLY_MODE === 'record') {
    //   ctx.polly.server.any().on('beforePersist', (_req, recording) => {
    //     filterRecording(recording);
    //   });
    // }
  });

    describe('lockEnvironment()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.lockEnvironment
        ).toBeDefined();
      });
    });

    describe('unlockEnvironment()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.unlockEnvironment
        ).toBeDefined();
      });
    });

    describe('getLockStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.getLockStatus
        ).toBeDefined();
      });
    });

    describe('promoteConfiguration()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.promoteConfiguration
        ).toBeDefined();
      });
    });

    describe('getPromotionStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.getPromotionStatus
        ).toBeDefined();
      });
    });

    describe('getLastPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.getLastPromotionReport
        ).toBeDefined();
      });
    });

    describe('getPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.getPromotionReport
        ).toBeDefined();
      });
    });

    describe('getProvisionalPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.getProvisionalPromotionReport
        ).toBeDefined();
      });
    });

    describe('getProvisionalRollbackReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.getProvisionalRollbackReport
        ).toBeDefined();
      });
    });

    describe('getPromotionReports()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.getPromotionReports
        ).toBeDefined();
      });
    });

    describe('rollbackPromotion()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionApi.rollbackPromotion
        ).toBeDefined();
      });
    });
});
