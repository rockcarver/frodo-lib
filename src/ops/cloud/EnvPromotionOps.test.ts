import * as EnvPromotionOps from './EnvPromotionOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
// import { filterRecording } from '../../utils/PollyUtils';
// import { state } from '../../index';

const ctx = autoSetupPolly();

describe('EnvPromotionOps', () => {
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
          EnvPromotionOps.lockEnvironment
        ).toBeDefined();
      });
    });

    describe('unlockEnvironment()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.unlockEnvironment
        ).toBeDefined();
      });
    });

    describe('readLockStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.readLockStatus
        ).toBeDefined();
      });
    });

    describe('promoteConfiguration()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.promoteConfiguration
        ).toBeDefined();
      });
    });

    describe('readPromotionStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.readPromotionStatus
        ).toBeDefined();
      });
    });

    describe('readLastPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.readLastPromotionReport
        ).toBeDefined();
      });
    });

    describe('readPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.readPromotionReport
        ).toBeDefined();
      });
    });

    describe('runProvisionalPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.runProvisionalPromotionReport
        ).toBeDefined();
      });
    });

    describe('runProvisionalRollbackReport()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.runProvisionalRollbackReport
        ).toBeDefined();
      });
    });

    describe('readPromotionReports()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.readPromotionReports
        ).toBeDefined();
      });
    });

    describe('rollbackPromotion()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvPromotionOps.rollbackPromotion
        ).toBeDefined();
      });
    });
});
