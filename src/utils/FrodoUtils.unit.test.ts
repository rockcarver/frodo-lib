/**
 * Run tests
 *
 *        npm run test:only FrodoUtils.unit
 */
import FrodoUtils, { sleep } from './FrodoUtils';

describe('FrodoUtils sleep()', () => {
  test('0: Method is implemented', () => {
    expect(sleep).toBeDefined();
    expect(FrodoUtils().sleep).toBeDefined();
  });

  test('1: Resolves after at least the given time', async () => {
    const start = Date.now();
    await sleep(40);
    // a timer can fire a millisecond or two early
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
  });

  test('2: Is the same helper on the facade', async () => {
    const start = Date.now();
    await FrodoUtils().sleep(40);
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
  });
});
