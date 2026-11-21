/**
 * Run tests
 *
 *        npm run test:only StartupOps.applyUpdates.unit
 *
 * What applyUpdates() asks the tenant, in which order, and what it answers.
 * The API layer is faked and the shared wait helper is the real one, so there
 * are no recordings and no tenant; the recorded tests in StartupOps.test.ts
 * cover the real requests.
 */
import { jest } from '@jest/globals';
import StateImpl from '../../shared/State';

const actualApi = await import('../../api/cloud/StartupApi');
const getStatus = jest.fn<any>();
const initiateRestart = jest.fn<any>();
jest.unstable_mockModule('../../api/cloud/StartupApi', () => ({
  ...actualApi,
  getStatus,
  initiateRestart,
}));

const { applyUpdates } = await import('./StartupOps');
const { RestartStatus } = actualApi;

const state = StateImpl({});
// a few milliseconds, so that the tests stay fast
const fast = { pollInterval: 5, initialDelay: 0, timeout: 5000, state };

/** Make a mocked function answer one value per call, repeating the last one. */
function answers(mock: jest.Mock<any>, ...values: unknown[]) {
  values.forEach((value) => mock.mockResolvedValueOnce(value));
  mock.mockResolvedValue(values[values.length - 1]);
}
const before = (first: jest.Mock<any>, second: jest.Mock<any>) =>
  first.mock.invocationCallOrder[0] < second.mock.invocationCallOrder[0];

beforeEach(() => {
  getStatus.mockReset();
  initiateRestart.mockReset();
});

describe('StartupOps.applyUpdates() (faked API)', () => {
  describe('with wait', () => {
    test('1: Reads the status first, then requests the restart of a ready environment, then waits for ready', async () => {
      initiateRestart.mockResolvedValue(RestartStatus.restarting);
      answers(
        getStatus,
        RestartStatus.ready,
        RestartStatus.restarting,
        RestartStatus.ready
      );
      expect(await applyUpdates({ wait: true, ...fast })).toBe(true);
      expect(initiateRestart).toHaveBeenCalledTimes(1);
      // the status read before the request, and the two checks of the wait
      expect(getStatus).toHaveBeenCalledTimes(3);
      expect(before(getStatus, initiateRestart)).toBe(true);
    });

    test('2: Joins a restart that is already under way: no request, waits for ready', async () => {
      answers(
        getStatus,
        RestartStatus.restarting,
        RestartStatus.restarting,
        RestartStatus.ready
      );
      expect(await applyUpdates({ wait: true, ...fast })).toBe(true);
      expect(initiateRestart).not.toHaveBeenCalled();
      expect(getStatus).toHaveBeenCalledTimes(3);
    });

    test('3: A restart that is requested is not complete yet, even when the answer to the request still says ready: the wait keeps its initial delay', async () => {
      const requestedAt: number[] = [];
      const checkedAt: number[] = [];
      initiateRestart.mockImplementation(async () => {
        requestedAt.push(Date.now());
        return RestartStatus.ready;
      });
      getStatus.mockImplementation(async () => {
        // the first call is the status read before the request
        if (requestedAt.length === 0) return RestartStatus.ready;
        checkedAt.push(Date.now());
        return checkedAt.length >= 2
          ? RestartStatus.ready
          : RestartStatus.restarting;
      });
      expect(
        await applyUpdates({ wait: true, ...fast, initialDelay: 80 })
      ).toBe(true);
      expect(checkedAt.length).toBeGreaterThanOrEqual(2);
      // a timer can fire a millisecond or two early
      expect(checkedAt[0] - requestedAt[0]).toBeGreaterThanOrEqual(75);
    });

    test('4: Requests the restart anyway when the status cannot be read before the request', async () => {
      initiateRestart.mockResolvedValue(RestartStatus.restarting);
      getStatus.mockRejectedValueOnce(new Error('HTTP 503'));
      getStatus.mockResolvedValue(RestartStatus.ready);
      expect(await applyUpdates({ wait: true, ...fast })).toBe(true);
      expect(initiateRestart).toHaveBeenCalledTimes(1);
    });

    test('5: Is false when the request is refused, and does not wait', async () => {
      initiateRestart.mockRejectedValue(new Error('HTTP 403'));
      getStatus.mockResolvedValue(RestartStatus.ready);
      expect(await applyUpdates({ wait: true, ...fast })).toBe(false);
      // only the status read before the request
      expect(getStatus).toHaveBeenCalledTimes(1);
    });

    test('6: Is false when the restart does not end in time', async () => {
      getStatus.mockResolvedValue(RestartStatus.restarting);
      expect(await applyUpdates({ wait: true, ...fast, timeout: 60 })).toBe(
        false
      );
      expect(initiateRestart).not.toHaveBeenCalled();
    });
  });

  describe('without wait', () => {
    test('1: Requests the restart at once and reads nothing', async () => {
      initiateRestart.mockResolvedValue(RestartStatus.restarting);
      expect(await applyUpdates({ wait: false, ...fast })).toBe(true);
      expect(initiateRestart).toHaveBeenCalledTimes(1);
      expect(getStatus).not.toHaveBeenCalled();
    });

    test('2: Requests the restart also when one is under way, and fails loudly when the tenant refuses it', async () => {
      // the request itself looks at the status and refuses while restarting
      initiateRestart.mockRejectedValue(
        new Error('Not ready! Current status: restarting')
      );
      expect(await applyUpdates({ wait: false, ...fast })).toBe(false);
      expect(initiateRestart).toHaveBeenCalledTimes(1);
      expect(getStatus).not.toHaveBeenCalled();
    });
  });
});
