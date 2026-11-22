/**
 * Run tests
 *
 *        npm run test:only -- BaseApi.lazyPolly
 *
 * The record and replay of HTTP traffic (Polly, src/utils/SetupPollyForFrodoLib.ts) is
 * expensive to load, and only a process that sets FRODO_MOCK uses it. BaseApi.ts therefore
 * reaches it through a dynamic import() that it runs only when FRODO_MOCK is set, and every
 * axios instance waits for the setup before it sends its first request.
 *
 * No recordings and no Polly: the setup module is replaced by a counting fake, and the
 * transport of every request is a stub adapter, so nothing leaves the process. The bundle
 * is checked the same way by test/pack-smoke/cjs/p07-polly-lazy.js (npm run test:packed).
 */
import { jest } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { State } from '../shared/State';

type SetupArgs = { state: unknown; argv?: string[] };

let factoryRuns = 0;
let factoryDelayMs = 0;
let setupCalls: SetupArgs[] = [];
let setupBehavior: () => void = () => {};

jest.unstable_mockModule('../utils/SetupPollyForFrodoLib', async () => {
  factoryRuns++;
  if (factoryDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, factoryDelayMs));
  }
  return {
    setupPollyForFrodoLib: (args: SetupArgs) => {
      setupCalls.push(args);
      setupBehavior();
    },
  };
});

const savedMock = process.env.FRODO_MOCK;
const savedArgv = [...process.argv];

/** Load a fresh BaseApi, which is where the FRODO_MOCK hook runs. */
async function loadBaseApi() {
  jest.resetModules();
  return await import('./BaseApi');
}

type BaseApiModule = Awaited<ReturnType<typeof loadBaseApi>>;

/** The number of request interceptors an instance of BaseApi has (axios keeps a hole for a removed one). */
async function requestInterceptorCount(baseApi: BaseApiModule) {
  const { default: StateImpl } = await import('../shared/State');
  const instance = baseApi.generateAmAuthApi({
    resource: {},
    anonymous: true,
    state: StateImpl({}),
  });
  return (instance.interceptors.request as any).handlers.filter(Boolean)
    .length as number;
}

/** A request through a fresh instance of BaseApi whose transport is the given function. */
async function sendRequest(
  baseApi: BaseApiModule,
  onSend: () => void = () => {},
  state?: State
) {
  const { default: StateImpl } = await import('../shared/State');
  const adapter = async (
    config: AxiosRequestConfig
  ): Promise<AxiosResponse> => {
    onSend();
    return {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config as AxiosResponse['config'],
    };
  };
  const instance = baseApi.generateAmAuthApi({
    resource: {},
    anonymous: true,
    state: state ?? StateImpl({}),
    requestOverride: { adapter },
  });
  return await instance.get('http://127.0.0.1:1/am/json/serverinfo/version');
}

describe('BaseApi loads the record and replay setup only when FRODO_MOCK is set', () => {
  beforeEach(() => {
    factoryRuns = 0;
    factoryDelayMs = 0;
    setupCalls = [];
    setupBehavior = () => {};
  });

  afterEach(() => {
    if (savedMock === undefined) delete process.env.FRODO_MOCK;
    else process.env.FRODO_MOCK = savedMock;
    process.argv = [...savedArgv];
  });

  test.each([
    ['is unset', undefined],
    ['is empty', ''],
  ])('1: does not load the setup when FRODO_MOCK %s', async (_name, value) => {
    if (value === undefined) delete process.env.FRODO_MOCK;
    else process.env.FRODO_MOCK = value;
    const baseApi = await loadBaseApi();
    await sendRequest(baseApi);
    expect(factoryRuns).toBe(0);
    expect(setupCalls).toHaveLength(0);
  });

  test('1b: an instance has no gate without FRODO_MOCK and exactly one request interceptor more with it', async () => {
    delete process.env.FRODO_MOCK;
    const without = await requestInterceptorCount(await loadBaseApi());
    process.env.FRODO_MOCK = '1';
    const withMock = await requestInterceptorCount(await loadBaseApi());
    expect(withMock).toBe(without + 1);
  });

  test.each(['1', 'record'])(
    '2: loads the setup once, with the command line of the load time, when FRODO_MOCK is %s',
    async (value) => {
      process.env.FRODO_MOCK = value;
      const argvAtLoad = [...process.argv];
      const baseApi = await loadBaseApi();
      // A program changes its command line after it has loaded the library
      process.argv.push('--late');
      await sendRequest(baseApi);
      await sendRequest(baseApi);
      expect(factoryRuns).toBe(1);
      expect(setupCalls).toHaveLength(1);
      expect(setupCalls[0].state).toBeDefined();
      expect(setupCalls[0].argv).toEqual(argvAtLoad);
      expect(setupCalls[0].argv).not.toBe(process.argv);
    }
  );

  test('3: a request waits until the setup is done', async () => {
    process.env.FRODO_MOCK = '1';
    factoryDelayMs = 50;
    let setupDone = false;
    setupBehavior = () => {
      setupDone = true;
    };
    const baseApi = await loadBaseApi();
    const setupDoneWhenSent: boolean[] = [];
    await sendRequest(baseApi, () => setupDoneWhenSent.push(setupDone));
    expect(setupDoneWhenSent).toEqual([true]);
  });

  test('3b: the gate runs before the curl command is built, curlirize is registered first', async () => {
    process.env.FRODO_MOCK = '1';
    factoryDelayMs = 50;
    let setupDone = false;
    setupBehavior = () => {
      setupDone = true;
    };
    const { default: StateImpl } = await import('../shared/State');
    const state = StateImpl({});
    state.setCurlirize(true);
    const setupDoneWhenPrinted: boolean[] = [];
    state.setCurlirizeHandler(() => setupDoneWhenPrinted.push(setupDone));
    await sendRequest(await loadBaseApi(), () => {}, state);
    expect(setupDoneWhenPrinted[0]).toBe(true);
  });

  describe('when the setup fails', () => {
    const unhandled = jest.fn();

    beforeEach(() => {
      unhandled.mockClear();
      process.on('unhandledRejection', unhandled);
      setupBehavior = () => {
        throw new Error('setup failed');
      };
    });

    afterEach(() => {
      process.off('unhandledRejection', unhandled);
    });

    test('4a: the first request rejects with that error and nothing is sent', async () => {
      process.env.FRODO_MOCK = '1';
      const baseApi = await loadBaseApi();
      const sent = jest.fn();
      await expect(sendRequest(baseApi, sent)).rejects.toThrow('setup failed');
      expect(sent).not.toHaveBeenCalled();
    });

    test('4b: no request, no unhandled rejection', async () => {
      process.env.FRODO_MOCK = '1';
      await loadBaseApi();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(setupCalls).toHaveLength(1);
      expect(unhandled).not.toHaveBeenCalled();
    });
  });
});
