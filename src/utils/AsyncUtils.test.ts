/**
 * Run tests
 *
 *        npm run test:only AsyncUtils
 */
import { dedupeAsync } from './AsyncUtils';

describe('AsyncUtils.dedupeAsync', () => {
  test('0: Method is implemented', () => {
    expect(dedupeAsync).toBeDefined();
  });

  test('1: Concurrent calls share a single in-flight invocation', async () => {
    let calls = 0;
    const fn = dedupeAsync(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    });

    const [a, b, c] = await Promise.all([fn(), fn(), fn()]);

    expect(calls).toBe(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(1);
  });

  test('2: A call after the in-flight one settles starts a fresh invocation', async () => {
    let calls = 0;
    const fn = dedupeAsync(async () => {
      calls++;
      return calls;
    });

    const first = await fn();
    const second = await fn();

    expect(calls).toBe(2);
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  test('3: A rejection is shared by every concurrent caller, then clears for the next call', async () => {
    let calls = 0;
    const fn = dedupeAsync(async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
      return 'ok';
    });

    await expect(Promise.all([fn(), fn()])).rejects.toThrow('boom');
    expect(calls).toBe(1);

    await expect(fn()).resolves.toBe('ok');
    expect(calls).toBe(2);
  });
});
