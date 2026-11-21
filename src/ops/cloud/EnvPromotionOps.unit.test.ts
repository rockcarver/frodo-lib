/**
 * Run tests
 *
 *        npm run test:only EnvPromotionOps.unit
 *
 * Unit tests of the waiting, error and end-state behaviour of the promotion
 * operations, and of the requests they send and the order they send them in
 * (the status read before a lock or unlock request that waits, the request
 * that a promotion or rollback always sends). The API layer is faked, so there
 * are no recordings and no tenant; the recorded tests in
 * EnvPromotionOps.test.ts cover the real requests, but a replay in order hands
 * a status read the recorded answer of a poll, so it cannot tell which request
 * a function sent first: these tests do.
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
/** True when the first call of one mock came before the first call of another. */
const before = (first: jest.Mock<any>, second: jest.Mock<any>) =>
  first.mock.invocationCallOrder[0] < second.mock.invocationCallOrder[0];
/** The messages of the errors that a FrodoError carries as its cause. */
const causes = (error: { originalErrors: Error[] }) =>
  error.originalErrors.map((e) => e.message);
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
      // the first answer is the status read before the request; the second is
      // a state from before the lock began, which is not the end of the lock
      answers(
        api.getLockStatus,
        lock('unlocked'),
        lock('unlocked'),
        lock('locking'),
        lock('locked')
      );
      const result = await promotion.lockEnvironment(true, 5, 5000);
      expect(result.result).toBe('locked');
      expect(api.getLockStatus).toHaveBeenCalledTimes(4);
    });

    test('3: Throws when the lock ends in an error', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      answers(api.getLockStatus, lock('unlocked'), lock('error'));
      const error = await promotion
        .lockEnvironment(true, 5, 5000)
        .catch((e) => e);
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error locking environment');
      // the status text is the cause
      expect(causes(error)).toContain('lock is error');
    });

    test('4: Throws when the lock does not finish within the timeout', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      answers(api.getLockStatus, lock('unlocked'), lock('locking'));
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

    test('6: With wait, reads the status first, then requests the lock of an unlocked environment, then waits', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      answers(
        api.getLockStatus,
        lock('unlocked'),
        lock('locking'),
        lock('locked')
      );
      const result = await promotion.lockEnvironment(true, 5, 5000);
      expect(result.result).toBe('locked');
      expect(api.lockEnvironment).toHaveBeenCalledTimes(1);
      expect(api.getLockStatus).toHaveBeenCalledTimes(3);
      expect(before(api.getLockStatus, api.lockEnvironment)).toBe(true);
    });

    test('7: With wait, joins an environment that is already locking: no request, waits for the lock', async () => {
      answers(
        api.getLockStatus,
        lock('locking'),
        lock('locking'),
        lock('locked')
      );
      const result = await promotion.lockEnvironment(true, 5, 5000);
      expect(result.result).toBe('locked');
      expect(api.lockEnvironment).not.toHaveBeenCalled();
      expect(api.getLockStatus).toHaveBeenCalledTimes(3);
    });

    test('8: With wait, an environment that is already locked is returned without a request and without another check', async () => {
      answers(api.getLockStatus, lock('locked'));
      const result = await promotion.lockEnvironment(true, 5, 5000);
      expect(result).toEqual(lock('locked'));
      expect(api.lockEnvironment).not.toHaveBeenCalled();
      expect(api.getLockStatus).toHaveBeenCalledTimes(1);
    });

    test('9: With wait, requests the lock anyway when the status cannot be read first', async () => {
      api.lockEnvironment.mockResolvedValue(lock('locking'));
      api.getLockStatus.mockRejectedValueOnce(new Error('HTTP 503'));
      answers(api.getLockStatus, lock('locked'));
      const result = await promotion.lockEnvironment(true, 5, 5000);
      expect(result.result).toBe('locked');
      expect(api.lockEnvironment).toHaveBeenCalledTimes(1);
    });

    test('10: Without wait, an answer of the request that says error throws, and the status text is the cause', async () => {
      api.lockEnvironment.mockResolvedValue(lock('error'));
      const error = await promotion.lockEnvironment().catch((e) => e);
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error locking environment');
      expect(causes(error)).toContain('lock is error');
      expect(api.getLockStatus).not.toHaveBeenCalled();
    });

    test('11: With wait, an answer of the request that says error throws at once, without a check', async () => {
      api.lockEnvironment.mockResolvedValue(lock('error'));
      answers(api.getLockStatus, lock('unlocked'));
      const error = await promotion
        .lockEnvironment(true, 5, 5000)
        .catch((e) => e);
      expect(causes(error)).toContain('lock is error');
      // only the status read before the request
      expect(api.getLockStatus).toHaveBeenCalledTimes(1);
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
      // the status read before the request, then the request, then the checks
      expect(api.getLockStatus).toHaveBeenCalledTimes(3);
      expect(before(api.getLockStatus, api.unlockEnvironment)).toBe(true);
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

    test('3b: Still says so with wait when no promotion id is given and the environment is unlocked', async () => {
      api.getLockStatus.mockResolvedValue({
        ...lock('unlocked'),
        promotionId: '',
      });
      await expect(
        promotion.unlockEnvironment(undefined, true, 5, 5000)
      ).rejects.toThrow('no lock to release');
      expect(api.unlockEnvironment).not.toHaveBeenCalled();
    });

    test('4: With wait, an environment that is already unlocked is returned without a request and without another check', async () => {
      answers(api.getLockStatus, lock('unlocked'));
      const result = await promotion.unlockEnvironment(
        'promo-1',
        true,
        5,
        5000
      );
      expect(result).toEqual(lock('unlocked'));
      expect(api.unlockEnvironment).not.toHaveBeenCalled();
      expect(api.getLockStatus).toHaveBeenCalledTimes(1);
    });

    test('5: With wait, joins an environment that is already unlocking: no request, waits for the unlock', async () => {
      answers(
        api.getLockStatus,
        lock('unlocking'),
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
      expect(api.unlockEnvironment).not.toHaveBeenCalled();
      expect(api.getLockStatus).toHaveBeenCalledTimes(3);
    });

    test('6: Without a promotion id, the status that gave the id is also the status read before the request', async () => {
      api.unlockEnvironment.mockResolvedValue(lock('unlocking'));
      answers(
        api.getLockStatus,
        lock('locked'),
        lock('unlocking'),
        lock('unlocked')
      );
      const result = await promotion.unlockEnvironment(
        undefined,
        true,
        5,
        5000
      );
      expect(result.result).toBe('unlocked');
      // the read for the id (also the status before the request) and two checks
      expect(api.getLockStatus).toHaveBeenCalledTimes(3);
      expect(api.unlockEnvironment).toHaveBeenCalledTimes(1);
      expect(before(api.getLockStatus, api.unlockEnvironment)).toBe(true);
    });

    test('7: With wait, requests the unlock anyway when the status cannot be read first', async () => {
      api.unlockEnvironment.mockResolvedValue(lock('unlocking'));
      api.getLockStatus.mockRejectedValueOnce(new Error('HTTP 503'));
      answers(api.getLockStatus, lock('unlocked'));
      const result = await promotion.unlockEnvironment(
        'promo-1',
        true,
        5,
        5000
      );
      expect(result.result).toBe('unlocked');
      expect(api.unlockEnvironment).toHaveBeenCalledTimes(1);
    });

    test('8: Without wait and with an id, requests the unlock at once and reads nothing', async () => {
      api.unlockEnvironment.mockResolvedValue(lock('unlocking'));
      expect(await promotion.unlockEnvironment('promo-1')).toEqual(
        lock('unlocking')
      );
      expect(api.getLockStatus).not.toHaveBeenCalled();
    });

    test('9: An answer of the request that says error throws, and the status text is the cause', async () => {
      api.unlockEnvironment.mockResolvedValue(lock('error'));
      const withoutWait = await promotion
        .unlockEnvironment('promo-1')
        .catch((e) => e);
      expect(withoutWait).toBeInstanceOf(FrodoError);
      expect(withoutWait.message).toBe('Error unlocking environment');
      expect(causes(withoutWait)).toContain('lock is error');
      answers(api.getLockStatus, lock('locked'));
      const withWait = await promotion
        .unlockEnvironment('promo-1', true, 5, 5000)
        .catch((e) => e);
      expect(causes(withWait)).toContain('lock is error');
    });

    test('10: Throws when the unlock ends in an error that is found while waiting, and the status text is the cause', async () => {
      api.unlockEnvironment.mockResolvedValue(lock('unlocking'));
      answers(api.getLockStatus, lock('locked'), lock('error'));
      const error = await promotion
        .unlockEnvironment('promo-1', true, 5, 5000)
        .catch((e) => e);
      expect(error.message).toBe('Error unlocking environment');
      expect(causes(error)).toContain('lock is error');
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
