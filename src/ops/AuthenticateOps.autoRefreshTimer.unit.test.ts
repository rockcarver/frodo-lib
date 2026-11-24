/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.autoRefreshTimer
 *
 * The timer that refreshes the credentials ahead of their expiry. Node waits at
 * most 2^31 - 1 ms (about 24.8 days) for a timer and runs a longer one after
 * 1 ms, so a credential that lasts longer must not be given a timer of its own
 * length (frodo-lib#923). The tests log in to a fake AM that runs in the test
 * process and look at the timers that the login sets.
 */
import '../index';
import { jest } from '@jest/globals';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import { MAX_TIMER_DELAY_MS } from './AuthenticateOps';

const DAY = 24 * 60 * 60 * 1000;

let am: FakeAm;
let timers: { callback: unknown; delay: number; args: unknown[] }[];

afterEach(async () => {
  jest.restoreAllMocks();
  await am.close();
});

/** Logs in for a session that lasts `sessionLifetimeMs` and records the long timers that were set. */
async function loginRecordingTimers(sessionLifetimeMs: number) {
  am = await startFakeAm({ sessionLifetimeMs });
  timers = [];
  const setTimeoutOriginal = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation(((
    callback: unknown,
    delay?: number,
    ...args: unknown[]
  ) => {
    // the requests of the login set short timers of their own
    if (delay !== undefined && delay > 60 * 1000) {
      timers.push({ callback, delay, args });
    }
    return setTimeoutOriginal(callback as () => void, delay, ...args);
  }) as unknown as typeof setTimeout);
  const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setUsername('someone');
  frodo.state.setPassword('password');
  await frodo.login.getTokens();
  return frodo;
}

describe('the timer that refreshes the credentials', () => {
  test('1: a credential that lasts as long as most do is refreshed shortly before it expires', async () => {
    const frodo = await loginRecordingTimers(30 * 60 * 1000);
    clearTimeout(frodo.state.getAutoRefreshTimer());

    expect(timers).toHaveLength(1);
    expect(timers[0].args[0]).toMatchObject({
      forceLoginAsUser: false,
      autoRefresh: true,
      state: frodo.state,
    });
    expect(timers[0].delay).toBeGreaterThan(29 * 60 * 1000 - 5000);
    expect(timers[0].delay).toBeLessThan(30 * 60 * 1000);
  });

  test('2: a credential that lasts longer than Node can wait gets a timer for the longest delay', async () => {
    const frodo = await loginRecordingTimers(40 * DAY);
    clearTimeout(frodo.state.getAutoRefreshTimer());

    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(MAX_TIMER_DELAY_MS);
    // that timer does not refresh anything: it looks at the expiry again
    expect(timers[0].args[0]).toBe(false);
  });

  test('3: ... and when it runs, the rest of the time is waited for, up to the expiry', async () => {
    const frodo = await loginRecordingTimers(40 * DAY);
    const { callback, args } = timers[0];
    const requests = am.requests.length;

    // the longest delay has passed
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + MAX_TIMER_DELAY_MS);
    (callback as (...parameters: unknown[]) => void)(...args);
    clearTimeout(frodo.state.getAutoRefreshTimer());

    expect(timers).toHaveLength(2);
    expect(timers[1].args[0]).toMatchObject({
      forceLoginAsUser: false,
      autoRefresh: true,
      state: frodo.state,
    });
    const remaining = 40 * DAY - MAX_TIMER_DELAY_MS;
    expect(timers[1].delay).toBeGreaterThan(remaining - 60 * 1000);
    expect(timers[1].delay).toBeLessThan(remaining);
    // nothing was sent: the credentials are as fresh as before
    expect(am.requests.length).toBe(requests);
  });

  test('4: a credential that lasts more than twice as long is looked at again and again', async () => {
    const frodo = await loginRecordingTimers(60 * DAY);
    const { callback, args } = timers[0];

    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + MAX_TIMER_DELAY_MS);
    (callback as (...parameters: unknown[]) => void)(...args);
    clearTimeout(frodo.state.getAutoRefreshTimer());

    expect(timers).toHaveLength(2);
    expect(timers[1].delay).toBe(MAX_TIMER_DELAY_MS);
    expect(timers[1].args[0]).toBe(false);
  });

  test('5: a failed timer refresh does not throw an unhandled rejection and puts the retry in the place of the fired timer', async () => {
    const frodo = await loginRecordingTimers(30 * 60 * 1000);
    const firedTimer = frodo.state.getAutoRefreshTimer();
    clearTimeout(firedTimer);
    const { callback, args } = timers[0];

    // simulate a transient token-endpoint failure when the proactive refresh fires
    frodo.state.setPassword('wrong');
    await expect(
      (callback as (...parameters: unknown[]) => Promise<void>)(...args)
    ).resolves.toBeUndefined();
    // the fired timer is gone; the one retry of the failed refresh is armed in its place
    const retryTimer = frodo.state.getAutoRefreshTimer();
    expect(retryTimer).toBeDefined();
    expect(retryTimer).not.toBe(firedTimer);
    clearTimeout(retryTimer);
  });

  test('6: a successful timer refresh re-arms a fresh timer', async () => {
    const frodo = await loginRecordingTimers(30 * 60 * 1000);
    const firstTimer = frodo.state.getAutoRefreshTimer();
    clearTimeout(firstTimer);
    const { callback, args, delay } = timers[0];

    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + delay);
    await expect(
      (callback as (...parameters: unknown[]) => Promise<void>)(...args)
    ).resolves.toBeUndefined();
    const secondTimer = frodo.state.getAutoRefreshTimer();
    expect(secondTimer).toBeDefined();
    expect(secondTimer).not.toBe(firstTimer);
    expect(am.logins()).toBe(2);
    clearTimeout(secondTimer);
  });
});
