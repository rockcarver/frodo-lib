/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.autoRefreshFailure
 *
 * What the library does when the refresh that it runs ahead of the expiry of
 * the credentials fails. That refresh runs in a timer: a rejected promise there
 * has nobody to catch it and ends a long-running process. The tests log in to a
 * fake AM that runs in the test process, take the callback that the library
 * gave to `setTimeout` and run it, as Node does when the timer fires, after
 * they have broken the next login in one of the ways of
 * `test/support/autoRefreshFailures.ts`. One test starts a process of its own
 * to see the rejections that Node reports for the process.
 *
 * A failed refresh is tried once more a few seconds later, while the credentials
 * are still valid, and when that fails too the library prints one warning. The
 * warning is a text that users see, so the tests spell it out.
 */
import '../index';
import http from 'http';
import { AddressInfo } from 'net';
import { jest } from '@jest/globals';
import {
  breakLogin,
  FAILURE_KINDS,
  FAILURE_TEXT,
  type FailureKind,
} from '../../test/support/autoRefreshFailures';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import { runWorker } from '../../test/support/runWorkers';
import FrodoLib from '../lib/FrodoLib';
import { AUTO_REFRESH_RETRY_DELAY_MS } from './AuthenticateOps';

type Armed = {
  callback: (...parameters: unknown[]) => Promise<void>;
  delay: number;
  args: unknown[];
  handle: NodeJS.Timeout;
  /** the one retry of a failed refresh, not the refresh itself */
  retry: boolean;
};

/** The text of the warning, exactly as users read it. */
const WARNING =
  'Could not refresh the access token in the background. The next request will try again.';

let am: FakeAm;
let armed: Armed[];
let debug: string[];
let printed: { message: unknown; type: string }[];
let clockOffset: number;
let frozenNow: number | undefined;
let retryRealDelay: number | undefined;
let helpers: { close(): Promise<void> }[];
let instance: ReturnType<typeof FrodoLib> | undefined;

beforeEach(() => {
  armed = [];
  debug = [];
  printed = [];
  clockOffset = 0;
  frozenNow = undefined;
  retryRealDelay = undefined;
  helpers = [];
  instance = undefined;
});

afterEach(async () => {
  for (const timer of armed) clearTimeout(timer.handle);
  if (instance) clearTimeout(instance.state.getAutoRefreshTimer());
  jest.restoreAllMocks();
  for (const helper of helpers) await helper.close();
  await am.close();
});

/** Time passes in the test only when the test says so. */
function passTime(ms: number) {
  clockOffset += ms;
}

/** The refresh timers, and the retries that follow a failed refresh. */
const refreshTimers = () => armed.filter((timer) => !timer.retry);
const retryTimers = () => armed.filter((timer) => timer.retry);
/** What the library printed as a warning. */
const warnings = () => printed.filter((line) => line.type === 'warn');

/**
 * Logs in to a fake AM for a session that lasts 30 minutes and records the
 * timers of the refresh (the ones that wait longer than a minute) and of the
 * retry. A retry waits as long as `retryRealDelay` says, when a test sets it:
 * the test then sees the retry run by itself.
 */
async function login() {
  am = await startFakeAm();
  const realNow = Date.now.bind(Date);
  jest
    .spyOn(Date, 'now')
    .mockImplementation(() => frozenNow ?? realNow() + clockOffset);
  const setTimeoutOriginal = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation(((
    callback: unknown,
    delay?: number,
    ...args: unknown[]
  ) => {
    const retry = delay === AUTO_REFRESH_RETRY_DELAY_MS;
    const handle = setTimeoutOriginal(
      callback as () => void,
      retry && retryRealDelay !== undefined ? retryRealDelay : delay,
      ...args
    ) as unknown as NodeJS.Timeout;
    if (retry || (delay !== undefined && delay > 60 * 1000)) {
      armed.push({
        callback: callback as Armed['callback'],
        delay,
        args,
        handle,
        retry,
      });
    }
    return handle;
  }) as unknown as typeof setTimeout);
  const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
  instance = frodo;
  frodo.state.setUseTokenCache(false);
  frodo.state.setUsername('someone');
  frodo.state.setPassword('password');
  // the lists of this test: a login that is still running when the test ends
  // must not write into the lists of the next one
  const debugLines = debug;
  const printedLines = printed;
  frodo.state.setDebugHandler((message) =>
    debugLines.push(
      typeof message === 'string' ? message : JSON.stringify(message)
    )
  );
  frodo.state.setPrintHandler((message, type) =>
    printedLines.push({ message, type })
  );
  await frodo.login.getTokens();
  return frodo;
}

/** Runs the callback of a timer, as Node does when the timer fires. */
function fire(timer: Armed) {
  return timer.callback(...timer.args);
}

/** The lines of the debug output that report a failed background refresh. */
const failedLines = () =>
  debug.filter((line) => line.includes('token auto-refresh failed'));

/** A server that holds back every answer until it is told, and then answers 500. */
async function startGate() {
  let requests = 0;
  const waiting: (() => void)[] = [];
  const server = http.createServer((_request, response) => {
    requests++;
    waiting.push(() => {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ code: 500, reason: 'Internal Server Error' })
      );
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const gate = {
    host: `http://127.0.0.1:${(server.address() as AddressInfo).port}/am`,
    requests: () => requests,
    release: () => waiting.forEach((answer) => answer()),
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
  helpers.push(gate);
  return gate;
}

/** Waits (in real time) until the condition holds. */
async function until(condition: () => boolean) {
  for (let i = 0; i < 400 && !condition(); i++) {
    await new Promise((done) => setTimeout(done, 10));
  }
  expect(condition()).toBe(true);
}

/** Breaks the next login of the instance in the way of the kind; returns what repairs it. */
async function breakNextLogin(
  frodo: ReturnType<typeof FrodoLib>,
  kind: FailureKind = 'wrong password'
) {
  const lines = debug;
  const broken = await breakLogin(kind, frodo, (line) => lines.push(line));
  helpers.push(broken);
  return broken;
}

/** Lets the refresh timer fire, with the next login broken; returns what repairs it. */
async function failFirstRefresh(
  frodo: ReturnType<typeof FrodoLib>,
  kind: FailureKind = 'wrong password'
) {
  // the credential is inside the freshness buffer when the timer fires
  passTime(refreshTimers()[0].delay);
  const broken = await breakNextLogin(frodo, kind);
  await fire(refreshTimers()[0]);
  return broken;
}

describe('a background refresh that fails', () => {
  test.each(FAILURE_KINDS)(
    '1: %s: the callback of the timer resolves and the debug output says what failed',
    async (kind: FailureKind) => {
      const frodo = await login();
      passTime(armed[0].delay);
      await breakNextLogin(frodo, kind);

      await expect(fire(armed[0])).resolves.toBeUndefined();

      expect(failedLines()).toHaveLength(1);
      expect(failedLines()[0]).toContain(FAILURE_TEXT[kind]);
      expect(failedLines()[0]).toContain('the next request will retry');
    }
  );

  test('2: a debug handler that throws does not make the callback of the timer reject', async () => {
    const frodo = await login();
    passTime(armed[0].delay);
    frodo.state.setPassword('wrong');
    frodo.state.setDebugHandler(() => {
      throw new Error('the handler of the host is broken');
    });

    await expect(fire(armed[0])).resolves.toBeUndefined();
    // the retry is armed all the same
    expect(retryTimers()).toHaveLength(1);
  });

  test('3: a print handler that throws does not make the callback of the timer or of the retry reject', async () => {
    const frodo = await login();
    frodo.state.setPrintHandler(() => {
      throw new Error('the handler of the host is broken');
    });
    await failFirstRefresh(frodo);

    await expect(fire(retryTimers()[0])).resolves.toBeUndefined();
  });

  test('4: a process that runs the timer sees no unhandled rejection and one warning, whatever the failure was', async () => {
    const results = await Promise.all(
      FAILURE_KINDS.map((kind) =>
        runWorker<{
          kind: string;
          timerArmed: boolean;
          failedLines: number;
          rejections: string[];
          printed: { message: unknown; type: string }[];
        }>('autoRefreshWorker.ts', { kind })
      )
    );

    // two lines: the refresh and its retry failed; one warning, after the retry
    expect(results).toEqual(
      FAILURE_KINDS.map((kind) => ({
        kind,
        timerArmed: true,
        failedLines: 2,
        rejections: [],
        printed: [{ message: WARNING, type: 'warn' }],
        loginsAtTheEnd: 1,
      }))
    );
  }, 120000);

  test.each([
    ['the timer of the refresh', 0],
    ['the retry', 1],
  ])(
    '5: %s: a timer that another login armed while it runs is left alone, and nothing is retried or warned about',
    async (_which, attempts) => {
      const frodo = await login();
      let running = refreshTimers()[0];
      if (attempts === 1) {
        const broken = await failFirstRefresh(frodo);
        broken.repair();
        passTime(AUTO_REFRESH_RETRY_DELAY_MS);
        running = retryTimers()[0];
      } else {
        passTime(running.delay);
      }
      const retriesBefore = retryTimers().length;
      // the refresh asks a server that answers when told
      const gate = await startGate();
      frodo.state.setHost(gate.host);
      const refreshing = fire(running);
      await until(() => gate.requests() === 1);

      // meanwhile another caller logs in and gets a timer of its own
      frodo.state.setHost(am.host);
      await frodo.login.getTokens();
      expect(am.logins()).toBe(2);
      expect(refreshTimers()).toHaveLength(2);
      const newer = refreshTimers()[1].handle;
      expect(frodo.state.getAutoRefreshTimer()).toBe(newer);

      gate.release();
      await expect(refreshing).resolves.toBeUndefined();

      expect(frodo.state.getAutoRefreshTimer()).toBe(newer);
      expect(retryTimers()).toHaveLength(retriesBefore);
      expect(warnings()).toEqual([]);
    }
  );

  test('6: the timer of the refresh and the retry do not keep the process alive', async () => {
    const frodo = await login();

    expect(armed).toHaveLength(1);
    expect(armed[0].handle.hasRef()).toBe(false);
    expect(frodo.state.getAutoRefreshTimer()).toBe(armed[0].handle);
    await failFirstRefresh(frodo);
    expect(retryTimers()).toHaveLength(1);
    expect(retryTimers()[0].handle.hasRef()).toBe(false);
  });

  test('7: the next request after a failed refresh logs in again and arms a new timer', async () => {
    const frodo = await login();
    const broken = await failFirstRefresh(frodo);
    expect(failedLines()).toHaveLength(1);
    expect(am.logins()).toBe(1);
    broken.repair();

    await expect(frodo.authn.journey.readJourneys()).resolves.toEqual([]);

    expect(am.logins()).toBe(2);
    expect(refreshTimers()).toHaveLength(2);
    // the new timer took the place of the retry, which is not needed any more
    expect(frodo.state.getAutoRefreshTimer()).toBe(refreshTimers()[1].handle);
    expect(frodo.state.getAutoRefreshTimer()).not.toBe(retryTimers()[0].handle);
    expect(warnings()).toEqual([]);
  });
});

describe('the one retry of a background refresh that failed', () => {
  test('1: is armed once, five seconds later, and kept in the state; nothing is printed yet', async () => {
    const frodo = await login();

    await failFirstRefresh(frodo);

    expect(AUTO_REFRESH_RETRY_DELAY_MS).toBe(5000);
    expect(retryTimers()).toHaveLength(1);
    expect(retryTimers()[0].delay).toBe(5000);
    expect(retryTimers()[0].args[0]).toMatchObject({
      autoRefresh: true,
      state: frodo.state,
    });
    expect(frodo.state.getAutoRefreshTimer()).toBe(retryTimers()[0].handle);
    expect(printed).toEqual([]);
  });

  test('2: that works re-arms the normal timer and prints nothing', async () => {
    const frodo = await login();
    const broken = await failFirstRefresh(frodo);
    broken.repair();
    passTime(AUTO_REFRESH_RETRY_DELAY_MS);

    await expect(fire(retryTimers()[0])).resolves.toBeUndefined();

    expect(am.logins()).toBe(2);
    expect(refreshTimers()).toHaveLength(2);
    expect(frodo.state.getAutoRefreshTimer()).toBe(refreshTimers()[1].handle);
    // one retry only, and no warning
    expect(retryTimers()).toHaveLength(1);
    expect(printed).toEqual([]);
  });

  test('3: that fails too is not retried and prints one warning, with exactly this text', async () => {
    const frodo = await login();
    await failFirstRefresh(frodo);
    passTime(AUTO_REFRESH_RETRY_DELAY_MS);

    await expect(fire(retryTimers()[0])).resolves.toBeUndefined();

    expect(printed).toEqual([{ message: WARNING, type: 'warn' }]);
    expect(retryTimers()).toHaveLength(1);
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
    // the reason is in the debug output, not in the warning
    expect(failedLines()).toHaveLength(2);
    expect(failedLines()[1]).toContain('Error getting tokens');
  });

  test.each([
    [20_000, 1, 0],
    [10_001, 1, 0],
    [10_000, 0, 1],
    [8_000, 0, 1],
    [-5_000, 0, 1],
  ])(
    '4: with %i ms of validity left: %i retry, %i warning',
    async (remaining, retries, warned) => {
      const frodo = await login();
      const expires = frodo.state.getUserSessionTokenMeta().expires;
      frodo.state.setPassword('wrong');
      frozenNow = expires - remaining;

      await expect(fire(refreshTimers()[0])).resolves.toBeUndefined();

      expect(retryTimers()).toHaveLength(retries);
      expect(warnings()).toEqual(
        warned ? [{ message: WARNING, type: 'warn' }] : []
      );
    }
  );

  test('4b: credentials without a known expiry: no retry, one warning', async () => {
    const frodo = await login();
    frodo.state.setPassword('wrong');
    frodo.state.setUserSessionTokenMeta({
      ...frodo.state.getUserSessionTokenMeta(),
      expires: undefined,
    });

    await expect(fire(refreshTimers()[0])).resolves.toBeUndefined();

    expect(retryTimers()).toHaveLength(0);
    expect(warnings()).toEqual([{ message: WARNING, type: 'warn' }]);
  });

  test('5: a second failure after a success warns again', async () => {
    const frodo = await login();
    let broken = await failFirstRefresh(frodo);
    passTime(AUTO_REFRESH_RETRY_DELAY_MS);
    await fire(retryTimers()[0]);
    expect(warnings()).toHaveLength(1);
    // the next request recovers
    broken.repair();
    await frodo.authn.journey.readJourneys();
    expect(refreshTimers()).toHaveLength(2);

    // and fails again, later
    passTime(refreshTimers()[1].delay);
    broken = await breakNextLogin(frodo);
    await fire(refreshTimers()[1]);
    expect(retryTimers()).toHaveLength(2);
    passTime(AUTO_REFRESH_RETRY_DELAY_MS);
    await fire(retryTimers()[1]);

    expect(printed).toEqual([
      { message: WARNING, type: 'warn' },
      { message: WARNING, type: 'warn' },
    ]);
  });

  test.each(['logout', 'dispose'] as const)(
    '6: %s while the retry waits: the retry does not log in afterwards',
    async (how) => {
      retryRealDelay = 300;
      const frodo = await login();
      const broken = await failFirstRefresh(frodo);
      expect(retryTimers()).toHaveLength(1);
      // were the retry to run, it would log in
      broken.repair();

      await frodo.login[how]();

      expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
      await new Promise((done) => setTimeout(done, 700));
      expect(am.logins()).toBe(1);
      expect(printed).toEqual([]);
    }
  );

  test('7: dispose while the refresh runs: the failure is neither retried nor warned about', async () => {
    const frodo = await login();
    passTime(refreshTimers()[0].delay);
    const gate = await startGate();
    frodo.state.setHost(gate.host);
    const refreshing = fire(refreshTimers()[0]);
    await until(() => gate.requests() === 1);

    // the instance ends while the refresh waits for its answer
    frodo.state.setHost(am.host);
    await frodo.login.dispose();
    gate.release();
    await expect(refreshing).resolves.toBeUndefined();

    expect(failedLines()).toHaveLength(1);
    expect(retryTimers()).toEqual([]);
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
    expect(printed).toEqual([]);
  });

  test.each([['the timer of the refresh'], ['the retry']])(
    '9: %s: after the state was reset it logs in no more',
    async (which) => {
      const frodo = await login();
      let waiting = refreshTimers()[0];
      if (which === 'the retry') {
        await failFirstRefresh(frodo);
        waiting = retryTimers()[0];
      }
      passTime(AUTO_REFRESH_RETRY_DELAY_MS);
      // a reset gives the state an empty slot, and clearTimeout is never called
      frodo.state.reset();
      expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
      const lines: string[] = [];
      frodo.state.setDebugHandler((message) => lines.push(String(message)));
      const requests = am.requests.length;

      await expect(fire(waiting)).resolves.toBeUndefined();

      expect(lines.filter((line) => line.includes('getTokens'))).toEqual([]);
      expect(am.requests).toHaveLength(requests);
      expect(printed).toEqual([]);
    }
  );

  test.each([
    ['works', 'logs in again and prints nothing'],
    ['fails', 'prints one warning and stops'],
  ])(
    '8: that runs by itself, after a delay, and %s: it %s',
    async (outcome) => {
      retryRealDelay = 150;
      const frodo = await login();
      const broken = await failFirstRefresh(frodo);
      if (outcome === 'works') broken.repair();

      if (outcome === 'works') {
        await until(() => refreshTimers().length === 2);
        expect(am.logins()).toBe(2);
        expect(frodo.state.getAutoRefreshTimer()).toBe(
          refreshTimers()[1].handle
        );
      } else {
        await until(() => warnings().length === 1);
        expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
      }
      // nothing else happens afterwards
      await new Promise((done) => setTimeout(done, 400));
      expect(retryTimers()).toHaveLength(1);
      expect(printed).toEqual(
        outcome === 'works' ? [] : [{ message: WARNING, type: 'warn' }]
      );
      expect(am.logins()).toBe(outcome === 'works' ? 2 : 1);
    }
  );
});
