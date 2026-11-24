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

type Armed = {
  callback: (...parameters: unknown[]) => Promise<void>;
  delay: number;
  args: unknown[];
  handle: NodeJS.Timeout;
};

let am: FakeAm;
let armed: Armed[];
let debug: string[];
let printed: { message: unknown; type: string }[];
let clockOffset: number;
let helpers: { close(): Promise<void> }[];
let instance: ReturnType<typeof FrodoLib> | undefined;

beforeEach(() => {
  armed = [];
  debug = [];
  printed = [];
  clockOffset = 0;
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

/**
 * Logs in to a fake AM for a session that lasts 30 minutes and records the
 * timers of the refresh (the ones that wait longer than a minute).
 */
async function login() {
  am = await startFakeAm();
  const realNow = Date.now.bind(Date);
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + clockOffset);
  const setTimeoutOriginal = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation(((
    callback: unknown,
    delay?: number,
    ...args: unknown[]
  ) => {
    const handle = setTimeoutOriginal(
      callback as () => void,
      delay,
      ...args
    ) as unknown as NodeJS.Timeout;
    if (delay !== undefined && delay > 60 * 1000) {
      armed.push({
        callback: callback as Armed['callback'],
        delay,
        args,
        handle,
      });
    }
    return handle;
  }) as unknown as typeof setTimeout);
  const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
  instance = frodo;
  frodo.state.setUseTokenCache(false);
  frodo.state.setUsername('someone');
  frodo.state.setPassword('password');
  frodo.state.setDebugHandler((message) =>
    debug.push(typeof message === 'string' ? message : JSON.stringify(message))
  );
  frodo.state.setPrintHandler((message, type) =>
    printed.push({ message, type })
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

describe('a background refresh that fails', () => {
  test.each(FAILURE_KINDS)(
    '1: %s: the callback of the timer resolves and the debug output says what failed',
    async (kind: FailureKind) => {
      const frodo = await login();
      passTime(armed[0].delay);
      helpers.push(await breakLogin(kind, frodo, (line) => debug.push(line)));

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
  });

  test('3: a process that runs the timer sees no unhandled rejection, whatever the failure was', async () => {
    const results = await Promise.all(
      FAILURE_KINDS.map((kind) =>
        runWorker<{
          kind: string;
          timerArmed: boolean;
          failedLines: number;
          rejections: string[];
        }>('autoRefreshWorker.ts', { kind })
      )
    );

    expect(
      results.map(({ kind, timerArmed, failedLines, rejections }) => ({
        kind,
        timerArmed,
        failedLines,
        rejections,
      }))
    ).toEqual(
      FAILURE_KINDS.map((kind) => ({
        kind,
        timerArmed: true,
        failedLines: 1,
        rejections: [],
      }))
    );
  }, 120000);

  test('4: a timer that another login armed while the refresh runs is left alone', async () => {
    const frodo = await login();
    passTime(armed[0].delay);
    // the refresh asks a server that answers when told
    const gate = await startGate();
    frodo.state.setHost(gate.host);
    const refreshing = fire(armed[0]);
    await until(() => gate.requests() === 1);

    // meanwhile another caller logs in and gets a timer of its own
    frodo.state.setHost(am.host);
    await frodo.login.getTokens();
    expect(am.logins()).toBe(2);
    expect(armed).toHaveLength(2);
    const newer = armed[1].handle;
    expect(frodo.state.getAutoRefreshTimer()).toBe(newer);

    gate.release();
    await expect(refreshing).resolves.toBeUndefined();

    expect(failedLines()).toHaveLength(1);
    expect(frodo.state.getAutoRefreshTimer()).toBe(newer);
  });

  test('5: the timer of the refresh does not keep the process alive', async () => {
    const frodo = await login();

    expect(armed).toHaveLength(1);
    expect(armed[0].handle.hasRef()).toBe(false);
    expect(frodo.state.getAutoRefreshTimer()).toBe(armed[0].handle);
  });

  test('6: the next request after a failed refresh logs in again and arms a new timer', async () => {
    const frodo = await login();
    // the credential is inside the freshness buffer when the timer fires
    passTime(armed[0].delay);
    const broken = await breakLogin('wrong password', frodo, (line) =>
      debug.push(line)
    );
    await fire(armed[0]);
    expect(failedLines()).toHaveLength(1);
    expect(am.logins()).toBe(1);
    broken.repair();

    await expect(frodo.authn.journey.readJourneys()).resolves.toEqual([]);

    expect(am.logins()).toBe(2);
    expect(armed).toHaveLength(2);
    expect(frodo.state.getAutoRefreshTimer()).toBe(armed[1].handle);
  });
});
