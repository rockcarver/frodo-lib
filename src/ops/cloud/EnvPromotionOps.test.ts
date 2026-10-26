  /**
   * When recording tests, make sure to increase the jest test timeout to something like 2400000 (45 minutes, maybe even longer). For the wait tests, we recorded each test by itself by commenting out the rest since we ran 
   * into issues with running them back to back since future tests would start before the previous tests would finish, although we believe it was caused by the timeout being set to 3 minutes originally. Regardless, you will need
   * the timeout to be longer since locking and tenant promotion takes more than 3 minutes, but if you run into issues recording them back to back just record them separately.
   *
   * The other thing is that we deleted most of the duplicate requests from the recordings for the wait tests to help speed up the tests so they don't take long, we only leave a few in there to simulate the waiting for about 20-30 seconds
   * so the tests don't take ages to run. If you re-record these, make sure to do the same.
   * 
   * The other thing is to make sure to use the staging tenant as the host when recording all the requests. All promotion functions should be run against the staging tenant if promoting from dev to staging.
   */

import { state } from '../../index';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';
import { orderedMatchRequestsBy } from '../../utils/PollyUtils';
import * as EnvPromotionOps from './EnvPromotionOps';

const ctx = autoSetupPolly(orderedMatchRequestsBy());

describe('EnvPromotionOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      setupPollyRecordingContext(ctx);
    }
  });
  // Read tests
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('readLockStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.readLockStatus).toBeDefined();
      });
      test('1: Read lock status', async () => {
        expect(
          await EnvPromotionOps.readLockStatus({ localLockOnly: false, state })
        ).toMatchSnapshot();
      });
      test('2: Read lock status (local lock only)', async () => {
        expect(
          await EnvPromotionOps.readLockStatus({ localLockOnly: true, state })
        ).toMatchSnapshot();
      });
    });

    describe('readPromotionStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.readPromotionStatus).toBeDefined();
      });
      test('1: Read promotion status', async () => {
        expect(
          await EnvPromotionOps.readPromotionStatus({ state })
        ).toMatchSnapshot();
      });
    });

    describe('readLastPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.readLastPromotionReport).toBeDefined();
      });
      test('1: Read last promotion report', async () => {
        expect(
          await EnvPromotionOps.readLastPromotionReport({ state })
        ).toMatchSnapshot();
      });
    });

    describe('readPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.readPromotionReport).toBeDefined();
      });
      test('1: Read promotion report', async () => {
        expect(
          await EnvPromotionOps.readPromotionReport({
            reportId: '9b827cbd-d19b-4a5c-a78e-1d383b811d95',
            state,
          })
        ).toMatchSnapshot();
      });
    });

    describe('runProvisionalPromotionReport()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.runProvisionalPromotionReport).toBeDefined();
      });
      test('1: Run provisional promotion report', async () => {
        expect(
          await EnvPromotionOps.runProvisionalPromotionReport({ state })
        ).toMatchSnapshot();
      });
    });

    describe('runProvisionalRollbackReport()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.runProvisionalRollbackReport).toBeDefined();
      });
      test('1: Run provisional rollback report', async () => {
        expect(
          await EnvPromotionOps.runProvisionalRollbackReport({ state })
        ).toMatchSnapshot();
      });
    });

    describe('readPromotionReports()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.readPromotionReports).toBeDefined();
      });
      test('1: Read promotion reports', async () => {
        expect(
          await EnvPromotionOps.readPromotionReports({ state })
        ).toMatchSnapshot();
      });
    });
  }

  // Lock test
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('lockEnvironment()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.lockEnvironment).toBeDefined();
      });
      test('1: Lock environment without waiting', async () => {
        expect(
          await EnvPromotionOps.lockEnvironment({
            wait: false,
            state,
          })
        ).toMatchSnapshot();
      });
    });
  }

  // Dry-run test
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3')
  ) {
    describe('promoteConfiguration()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.promoteConfiguration).toBeDefined();
      });
      test('1: Dry-run promotion', async () => {
        expect(
          await EnvPromotionOps.promoteConfiguration({
            config: {
              dryRun: true,
              ignoreEncryptedSecrets: true,
              removeOrphanedConfig: true,
              promoter: 'provisional-report',
              unlockEnvironmentsAfterPromotion: false,
            },
            wait: false,
            state,
          })
        ).toMatchSnapshot();
      });
    });
  }

  // Real promotion test
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4')
  ) {
    describe('promoteConfiguration()', () => {
      test('2: Real promotion', async () => {
        expect(
          await EnvPromotionOps.promoteConfiguration({
            config: {
              dryRun: false,
              ignoreEncryptedSecrets: true,
              removeOrphanedConfig: true,
              promoter: 'provisional-report',
              unlockEnvironmentsAfterPromotion: false,
            },
            wait: false,
            state,
          })
        ).toMatchSnapshot();
      });
    });
  }

  // Rollback promotion test
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '5')
  ) {
    describe('rollbackPromotion()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.rollbackPromotion).toBeDefined();
      });
      test('1: Rollback promotion', async () => {
        expect(
          await EnvPromotionOps.rollbackPromotion({
            config: {
              promoter: 'provisional-report',
              unlockEnvironmentsAfterPromotion: false,
            },
            wait: false,
            state,
          })
        ).toMatchSnapshot();
      });
    });
  }

  // Unlock test
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '6')
  ) {
    describe('unlockEnvironment()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvPromotionOps.unlockEnvironment).toBeDefined();
      });
      test('1: Unlock environment without waiting', async () => {
        expect(
          await EnvPromotionOps.unlockEnvironment({
            wait: false,
            state,
          })
        ).toMatchSnapshot();
      });
    });
  }

  // Wait tests
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '7')
  ) {
    describe('Wait tests', () => {
      test('0: Lock environment', async () => {
        expect(
          await EnvPromotionOps.lockEnvironment({
            wait: true,
            state,
          })
        ).toMatchSnapshot();
      });

      test('1: Dry-run promotion', async () => {
        expect(
          await EnvPromotionOps.promoteConfiguration({
            config: {
              dryRun: true,
              ignoreEncryptedSecrets: true,
              removeOrphanedConfig: true,
              promoter: 'provisional-report',
              unlockEnvironmentsAfterPromotion: false,
            },
            wait: true,
            state,
          })
        ).toMatchSnapshot();
      });

      test('2: Real promotion', async () => {
        expect(
          await EnvPromotionOps.promoteConfiguration({
            config: {
              dryRun: false,
              ignoreEncryptedSecrets: true,
              removeOrphanedConfig: true,
              promoter: 'provisional-report',
              unlockEnvironmentsAfterPromotion: false,
            },
            wait: true,
            state,
          })
        ).toMatchSnapshot();
      });

      test('3: Rollback promotion', async () => {
        expect(
          await EnvPromotionOps.rollbackPromotion({
            config: {
              promoter: 'provisional-report',
              unlockEnvironmentsAfterPromotion: false,
            },
            wait: true,
            state,
          })
        ).toMatchSnapshot();
      });

      test('4: Unlock environment', async () => {
        expect(
          await EnvPromotionOps.unlockEnvironment({
            wait: true,
            state,
          })
        ).toMatchSnapshot();
      });
    });
  }
});
