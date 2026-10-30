/**
 * Run tests
 *
 *        npm run test:only ForgeRockUtils.waitForUpdate
 *
 * Unit tests of the shared wait helper: no recordings, no tenant. The
 * intervals are a few milliseconds so the tests stay fast.
 */
import { jest } from '@jest/globals';
import StateImpl from '../shared/State';

// what the user is shown: the real progress indicator calls, recorded
const actualConsole = await import('./Console');
const stopProgressIndicator = jest.fn<any>();
jest.unstable_mockModule('./Console', () => ({
  ...actualConsole,
  createProgressIndicator: () => 'indicator',
  updateProgressIndicator: () => undefined,
  stopProgressIndicator,
}));
const { waitForUpdate } = await import('./ForgeRockUtils');

const state = StateImpl({});
const base = { state, wait: true, pollInterval: 10, timeout: 2000 };
const initiated = async () => undefined;

describe('waitForUpdate()', () => {
  test('0: Method is implemented', async () => {
    expect(waitForUpdate).toBeDefined();
  });

  test('1: Does not poll when not waiting', async () => {
    const isComplete = jest.fn(async () => ({ isComplete: true }));
    const outcome = await waitForUpdate({
      ...base,
      wait: false,
      initiateUpdate: initiated,
      isComplete,
    });
    expect(outcome).toBe(true);
    expect(isComplete).not.toHaveBeenCalled();
  });

  test('2: Reports a failed initiation as false, hands the error to onError and never polls', async () => {
    const failure = new Error('HTTP 403');
    const isComplete = jest.fn(async () => ({ isComplete: true }));
    const onError = jest.fn();
    const outcome = await waitForUpdate({
      ...base,
      initiateUpdate: async () => {
        throw failure;
      },
      isComplete,
      onError,
    });
    expect(outcome).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(isComplete).not.toHaveBeenCalled();
  });

  test('3: Waits one poll interval before the first check', async () => {
    let checkedAfter = -1;
    const start = Date.now();
    const outcome = await waitForUpdate({
      ...base,
      pollInterval: 60,
      initiateUpdate: initiated,
      isComplete: async () => {
        checkedAfter = Date.now() - start;
        return { isComplete: true };
      },
    });
    expect(outcome).toBe(true);
    // a timer can fire a millisecond or two early
    expect(checkedAfter).toBeGreaterThanOrEqual(55);
  });

  test('4: Keeps polling until the update completes', async () => {
    let checks = 0;
    const outcome = await waitForUpdate({
      ...base,
      initiateUpdate: initiated,
      isComplete: async () => ({ isComplete: ++checks >= 3 }),
    });
    expect(outcome).toBe(true);
    expect(checks).toBe(3);
  });

  test('5: Is false when the update reports an error', async () => {
    const errorMessage = jest.fn(() => 'it failed');
    const outcome = await waitForUpdate({
      ...base,
      initiateUpdate: initiated,
      isComplete: async () => ({
        isComplete: true,
        isError: true,
        status: 'bad',
      }),
      errorMessage,
    });
    expect(outcome).toBe(false);
    expect(errorMessage).toHaveBeenCalled();
  });

  describe('timeout', () => {
    test('1: Is false when the update never completes', async () => {
      const timeoutMessage = jest.fn(() => 'timed out');
      const outcome = await waitForUpdate({
        ...base,
        timeout: 80,
        initiateUpdate: initiated,
        isComplete: async () => ({ isComplete: false, status: 'running' }),
        timeoutMessage,
      });
      expect(outcome).toBe(false);
      expect(timeoutMessage).toHaveBeenCalled();
    });

    test('2: Is false when a single check outlasts the timeout and the update is still not complete', async () => {
      // used to be reported as a success because only a runtime measured
      // inside the loop was compared to the timeout
      const outcome = await waitForUpdate({
        ...base,
        timeout: 50,
        initiateUpdate: initiated,
        isComplete: async () => {
          await new Promise((resolve) => setTimeout(resolve, 120));
          return { isComplete: false };
        },
      });
      expect(outcome).toBe(false);
    });

    test('3: Is true when the update completes at the check that passes the deadline', async () => {
      let checks = 0;
      const outcome = await waitForUpdate({
        ...base,
        timeout: 100,
        initiateUpdate: initiated,
        isComplete: async () => {
          if (++checks === 1) return { isComplete: false };
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { isComplete: true, status: 'done' };
        },
      });
      expect(outcome).toBe(true);
    });

    test('4: Does not sleep past the deadline when the poll interval is longer than the timeout', async () => {
      const start = Date.now();
      const outcome = await waitForUpdate({
        ...base,
        pollInterval: 60000,
        timeout: 60,
        initiateUpdate: initiated,
        isComplete: async () => ({ isComplete: false }),
      });
      expect(outcome).toBe(false);
      expect(Date.now() - start).toBeLessThan(5000);
    });

    test('5: Rejects a timeout or poll interval that is not positive', async () => {
      await expect(
        waitForUpdate({
          ...base,
          timeout: 0,
          initiateUpdate: initiated,
          isComplete: async () => ({ isComplete: true }),
        })
      ).rejects.toThrow('must be positive');
      await expect(
        waitForUpdate({
          ...base,
          pollInterval: -1,
          initiateUpdate: initiated,
          isComplete: async () => ({ isComplete: true }),
        })
      ).rejects.toThrow('must be positive');
    });
  });

  describe('failing checks', () => {
    test('1: Tolerates the allowed number of consecutive errors, then completes', async () => {
      let checks = 0;
      const outcome = await waitForUpdate({
        ...base,
        initiateUpdate: initiated,
        isComplete: async () => {
          if (++checks <= 3) throw new Error('flaky');
          return { isComplete: true };
        },
      });
      expect(outcome).toBe(true);
      expect(checks).toBe(4);
    });

    test('2: Gives up after one error more than allowed and hands that error to onError', async () => {
      let checks = 0;
      const onError = jest.fn();
      const outcome = await waitForUpdate({
        ...base,
        initiateUpdate: initiated,
        isComplete: async () => {
          throw new Error(`failure ${++checks}`);
        },
        onError,
      });
      expect(outcome).toBe(false);
      expect(checks).toBe(4);
      expect((onError.mock.calls[0][0] as Error).message).toBe('failure 4');
    });

    test('3: Counts only consecutive errors: a good check resets the count', async () => {
      const results: ('error' | 'pending' | 'done')[] = [
        'error',
        'error',
        'error',
        'pending',
        'error',
        'error',
        'error',
        'done',
      ];
      let checks = 0;
      const outcome = await waitForUpdate({
        ...base,
        initiateUpdate: initiated,
        isComplete: async () => {
          const result = results[checks++];
          if (result === 'error') throw new Error('flaky');
          return { isComplete: result === 'done' };
        },
      });
      expect(outcome).toBe(true);
      expect(checks).toBe(results.length);
    });

    test('4: Honours maxConsecutiveWaitErrors', async () => {
      let checks = 0;
      const outcome = await waitForUpdate({
        ...base,
        maxConsecutiveWaitErrors: 0,
        initiateUpdate: initiated,
        isComplete: async () => {
          checks++;
          throw new Error('flaky');
        },
      });
      expect(outcome).toBe(false);
      expect(checks).toBe(1);
    });
  });

  describe('what the user is shown', () => {
    beforeEach(() => stopProgressIndicator.mockClear());
    const shown = () => stopProgressIndicator.mock.calls[0][0];

    test('1: A success is shown as a success with the success message', async () => {
      await waitForUpdate({
        ...base,
        initiateUpdate: initiated,
        isComplete: async () => ({ isComplete: true, status: 'ready' }),
        waitSuccessMessage: (completed) => `done: ${completed.status}`,
      });
      expect(shown()).toMatchObject({
        status: 'success',
        message: 'done: ready',
      });
    });

    test('2: Not waiting is shown as a success with the no-wait message', async () => {
      await waitForUpdate({
        ...base,
        wait: false,
        initiateUpdate: initiated,
        isComplete: async () => ({ isComplete: true }),
        noWaitSuccessMessage: 'started',
      });
      expect(shown()).toMatchObject({ status: 'success', message: 'started' });
    });

    test('3: A timeout is shown as a warning with the timeout message', async () => {
      await waitForUpdate({
        ...base,
        timeout: 50,
        initiateUpdate: initiated,
        isComplete: async () => ({ isComplete: false, status: 'busy' }),
        timeoutMessage: (completed) => `gave up: ${completed.status}`,
      });
      expect(shown()).toMatchObject({
        status: 'warn',
        message: 'gave up: busy',
      });
    });

    test('4: An error is shown as a failure with the error message', async () => {
      await waitForUpdate({
        ...base,
        initiateUpdate: initiated,
        isComplete: async () => ({
          isComplete: true,
          isError: true,
          status: 'broken',
        }),
        errorMessage: (completed) => `failed: ${completed.status}`,
      });
      expect(shown()).toMatchObject({
        status: 'fail',
        message: 'failed: broken',
      });
    });

    test('5: A failed initiation is shown as a failure with its message and nothing undefined', async () => {
      await waitForUpdate({
        ...base,
        initiateUpdate: async () => {
          throw new Error('HTTP 403');
        },
        isComplete: async () => ({ isComplete: true }),
      });
      expect(shown()).toMatchObject({
        status: 'fail',
        message: 'Error: HTTP 403',
      });
    });

    test('6: A failed initiation shows the code and message of the response', async () => {
      await waitForUpdate({
        ...base,
        initiateUpdate: async () => {
          throw Object.assign(new Error('Request failed'), {
            response: { data: { code: 409, message: 'Already locked' } },
          });
        },
        isComplete: async () => ({ isComplete: true }),
      });
      expect(shown()).toMatchObject({
        status: 'fail',
        message: 'Error: 409 - Already locked',
      });
    });
  });
});
