/**
 * Run tests
 *
 *        npm run test:only StartupOps.unit
 *
 * applyUpdates() waits through the shared helper. The restart may still read
 * 'ready' for a moment after it was requested, so the first status check has
 * to wait; the recorded tests replay without noticing the difference, so this
 * one looks at what is handed to the helper.
 */
import { jest } from '@jest/globals';
import StateImpl from '../../shared/State';

const actual = await import('../../utils/ForgeRockUtils');
const waitForUpdate = jest.fn<any>().mockResolvedValue(true);
jest.unstable_mockModule('../../utils/ForgeRockUtils', () => ({
  ...actual,
  waitForUpdate,
}));

const { applyUpdates } = await import('./StartupOps');

describe('StartupOps.applyUpdates() (faked wait helper)', () => {
  beforeEach(() => waitForUpdate.mockClear());

  test('1: Waits before the first status check of the restart', async () => {
    await applyUpdates({ wait: true, timeout: 1000, state: StateImpl({}) });
    expect(waitForUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ wait: true, timeout: 1000, initialDelay: 5000 })
    );
  });

  test('2: Returns what the helper returns', async () => {
    waitForUpdate.mockResolvedValueOnce(false);
    expect(
      await applyUpdates({ wait: false, timeout: 1000, state: StateImpl({}) })
    ).toBe(false);
  });
});
