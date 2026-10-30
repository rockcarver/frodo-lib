/**
 * Run tests
 *
 *        npm run test:only EnvPromotionOps.unit
 *
 * Unit tests of the waiting, error and end-state behaviour of the promotion
 * operations. The API layer is faked, so there are no recordings and no
 * tenant; the recorded tests in EnvPromotionOps.test.ts cover the real
 * requests.
 */
import { jest } from '@jest/globals';
import StateImpl from '../../shared/State';

const api = {
  getLastPromotionReport: jest.fn<any>(),
  getLockStatus: jest.fn<any>(),
  getPromotionReport: jest.fn<any>(),
  getPromotionReports: jest.fn<any>(),
  getPromotionStatus: jest.fn<any>(),
  getProvisionalPromotionReport: jest.fn<any>(),
  getProvisionalRollbackReport: jest.fn<any>(),
  lockEnvironment: jest.fn<any>(),
  promoteConfiguration: jest.fn<any>(),
  rollbackPromotion: jest.fn<any>(),
  unlockEnvironment: jest.fn<any>(),
};
jest.unstable_mockModule('../../api/cloud/EnvPromotionApi', () => api);

const { default: EnvPromotionOps } = await import('./EnvPromotionOps');
const { FrodoError } = await import('../FrodoError');

const state = StateImpl({});
const promotion = EnvPromotionOps(state);

/** Make a mocked function answer one value per call, repeating the last one. */
function answers(mock: jest.Mock<any>, ...values: unknown[]) {
  values.forEach((value) => mock.mockResolvedValueOnce(value));
  mock.mockResolvedValue(values[values.length - 1]);
}

const lock = (result: string) => ({
  description: `lock is ${result}`,
  promotionId: 'promo-1',
  result,
});
const status = (statusName: string) => ({
  blockingError: false,
  globalLock: 'LOCKED',
  message: `status ${statusName}`,
  status: statusName,
  timeStamp: 'now',
});
const config = {
  dryRun: false,
  ignoreEncryptedSecrets: false,
  unlockEnvironmentsAfterPromotion: false,
};

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
});

describe('EnvPromotionOps (faked API)', () => {
  describe('lockEnvironment()', () => {
    test('1: Returns the lock response without checking the status when not waiting', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      expect(await promotion.lockEnvironment()).toEqual(lock('locking'));
      expect(api.getLockStatus).not.toHaveBeenCalled();
    });

    test('2: Waits until the environment is locked, not merely until it stops locking', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      // a state from before the lock began is not the end of the lock
      answers(
        api.getLockStatus,
        lock('unlocked'),
        lock('locking'),
        lock('locked')
      );
      const result = await promotion.lockEnvironment(true, 5, 5000);
      expect(result.result).toBe('locked');
      expect(api.getLockStatus).toHaveBeenCalledTimes(3);
    });

    test('3: Throws when the lock ends in an error', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      answers(api.getLockStatus, lock('error'));
      await expect(promotion.lockEnvironment(true, 5, 5000)).rejects.toThrow(
        'Error locking environment'
      );
    });

    test('4: Throws when the lock does not finish within the timeout', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      answers(api.getLockStatus, lock('locking'));
      await expect(promotion.lockEnvironment(true, 5, 60)).rejects.toThrow(
        'Error locking environment'
      );
    });

    test('5: Keeps the cause of a failed request', async () => {
      api.lockEnvironment.mockRejectedValue(new Error('HTTP 403 Forbidden'));
      const error = await promotion.lockEnvironment().catch((e) => e);
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.originalErrors.map((e: Error) => e.message)).toContain(
        'HTTP 403 Forbidden'
      );
    });
  });

  describe('unlockEnvironment()', () => {
    test('1: Waits until the environment is unlocked', async () => {
      api.unlockEnvironment.mockResolvedValue(lock('unlocking'));
      answers(
        api.getLockStatus,
        lock('locked'),
        lock('unlocking'),
        lock('unlocked')
      );
      const result = await promotion.unlockEnvironment(
        'promo-1',
        true,
        5,
        5000
      );
      expect(result.result).toBe('unlocked');
      expect(api.unlockEnvironment).toHaveBeenCalledWith(
        expect.objectContaining({ promotionId: 'promo-1' })
      );
    });

    test('2: Looks the promotion id up in the lock status when none is given', async () => {
      api.getLockStatus.mockResolvedValue(lock('locked'));
      api.unlockEnvironment.mockResolvedValue(lock('unlocking'));
      await promotion.unlockEnvironment();
      expect(api.unlockEnvironment).toHaveBeenCalledWith(
        expect.objectContaining({ promotionId: 'promo-1' })
      );
    });

    test('3: Says so when the environment has no lock to release', async () => {
      api.getLockStatus.mockResolvedValue({
        ...lock('unlocked'),
        promotionId: '',
      });
      await expect(promotion.unlockEnvironment()).rejects.toThrow(
        'no lock to release'
      );
      expect(api.unlockEnvironment).not.toHaveBeenCalled();
    });
  });

  describe('readLockStatus()', () => {
    test('1: Passes localLockOnly on to the API', async () => {
      api.getLockStatus.mockResolvedValue(lock('locked'));
      await promotion.readLockStatus(true);
      expect(api.getLockStatus).toHaveBeenCalledWith(
        expect.objectContaining({ localLockOnly: true })
      );
    });
  });

  describe('promoteConfiguration()', () => {
    test('1: Does not check the status when not waiting', async () => {
      api.promoteConfiguration.mockResolvedValue({ message: 'started' });
      expect(await promotion.promoteConfiguration(config)).toEqual({
        message: 'started',
      });
      expect(api.getPromotionStatus).not.toHaveBeenCalled();
    });

    test('2: Waits while the promotion is running, locking or unlocking', async () => {
      api.promoteConfiguration.mockResolvedValue({ message: 'started' });
      answers(
        api.getPromotionStatus,
        status('RUNNING'),
        status('UNLOCKING'),
        status('READY')
      );
      const response = await promotion.promoteConfiguration(
        config,
        true,
        5,
        5000
      );
      expect(response).toEqual({ message: 'started' });
      expect(api.getPromotionStatus).toHaveBeenCalledTimes(3);
    });

    test('3: Throws when the promotion ends in an error', async () => {
      api.promoteConfiguration.mockResolvedValue({ message: 'started' });
      answers(api.getPromotionStatus, status('RUNNING'), status('ERROR'));
      await expect(
        promotion.promoteConfiguration(config, true, 5, 5000)
      ).rejects.toThrow('Error promoting configuration');
    });

    test('4: Throws when the promotion is still running at the timeout', async () => {
      api.promoteConfiguration.mockResolvedValue({ message: 'started' });
      answers(api.getPromotionStatus, status('RUNNING'));
      await expect(
        promotion.promoteConfiguration(config, true, 5, 60)
      ).rejects.toThrow('Error promoting configuration');
    });

    test('5: Keeps the cause of a failed request', async () => {
      api.promoteConfiguration.mockRejectedValue(new Error('HTTP 409'));
      const error = await promotion
        .promoteConfiguration(config)
        .catch((e) => e);
      expect(error.originalErrors.map((e: Error) => e.message)).toContain(
        'HTTP 409'
      );
    });
  });

  describe('rollbackPromotion()', () => {
    const rollback = { unlockEnvironmentsAfterPromotion: false };

    test('1: Waits until the rollback is finished', async () => {
      api.rollbackPromotion.mockResolvedValue({ message: 'started' });
      answers(api.getPromotionStatus, status('RUNNING'), status('READY'));
      await promotion.rollbackPromotion(rollback, true, 5, 5000);
      expect(api.getPromotionStatus).toHaveBeenCalledTimes(2);
    });

    test('2: Names the promotion in the error when it has a description', async () => {
      api.rollbackPromotion.mockRejectedValue(new Error('HTTP 500'));
      await expect(
        promotion.rollbackPromotion({
          ...rollback,
          promotionDescription: 'release 7',
        })
      ).rejects.toThrow("Error rolling back promotion 'release 7'");
      await expect(promotion.rollbackPromotion(rollback)).rejects.toThrow(
        /^Error rolling back promotion$/
      );
    });
  });
});
