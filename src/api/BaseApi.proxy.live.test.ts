/**
 * Live probe of the proxy support: one unauthenticated request to a real tenant
 * through a real proxy, and a negative control that proves the proxy mattered.
 *
 * It is skipped (the tests are listed as skipped) unless FRODO_PROXY_LIVE=1, so
 * `npm test` and a developer's machine never need a tenant or a proxy. CI sets
 * it in the `Proxy Tests` step of the `Test` job, next to a squid service, and
 * runs it through `npm run test:proxy`:
 *
 *        FRODO_PROXY_LIVE=1 HTTPS_PROXY=http://127.0.0.1:3128 \
 *        FRODO_HOST=https://<tenant>/am npm run test:proxy
 *
 * When it is on, both FRODO_HOST and HTTPS_PROXY (or https_proxy) must be set,
 * and the test fails if one is not: a probe that skips itself for want of
 * configuration is a probe nobody notices has stopped running.
 *
 * It sends `GET <FRODO_HOST>/json/serverinfo/*` and nothing else, through the
 * library's own request path (`getServerInfo()`, the call the library makes
 * before it logs in). It never logs in and never writes. The jest setup file
 * test/jest-no-ambient-proxy.setup.js hides the proxy variables from the
 * tests; this file puts back what the setup file kept in
 * FRODO_TEST_AMBIENT_PROXY, because here the proxy of the environment is the
 * thing under test.
 *
 * Each call imports the library afresh, so that no agent of an earlier call is
 * reused.
 */
import { jest } from '@jest/globals';

const LIVE = process.env.FRODO_PROXY_LIVE === '1';
const liveDescribe = LIVE ? describe : describe.skip;

/** The proxy variables of the environment that started the run. */
const ambient: Record<string, string> = JSON.parse(
  process.env.FRODO_TEST_AMBIENT_PROXY || '{}'
);

/** Every variable the tests below set, to restore. */
const TOUCHED = [
  ...Object.keys(ambient),
  'HTTP_PROXY',
  'http_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NO_PROXY',
  'no_proxy',
];

/** The dead proxy of the negative control: nothing listens on the discard port of the loopback interface. */
const DEAD_PROXY = 'http://127.0.0.1:9';

async function serverInfoFrom(host: string): Promise<any> {
  jest.resetModules();
  const { getServerInfo } = await import('./ServerInfoApi');
  const StateImpl = (await import('../shared/State')).default;
  const state = StateImpl({});
  state.setHost(host);
  return getServerInfo({ state });
}

liveDescribe('BaseApi through the proxy of the environment (live)', () => {
  const host = process.env.FRODO_HOST as string;
  const saved = new Map<string, string | undefined>();

  beforeAll(() => {
    const missing: string[] = [];
    if (!host) missing.push('FRODO_HOST (the tenant, https://<tenant>/am)');
    if (!ambient.HTTPS_PROXY && !ambient.https_proxy) {
      missing.push('HTTPS_PROXY (the proxy, http://<proxy>:<port>)');
    }
    if (missing.length) {
      throw new Error(
        `FRODO_PROXY_LIVE=1 needs ${missing.join(' and ')}. ` +
          'Set them, or leave FRODO_PROXY_LIVE unset to skip this probe.'
      );
    }
  });

  beforeEach(() => {
    for (const name of TOUCHED) saved.set(name, process.env[name]);
    // the environment of the run, as it was before the jest setup file hid it
    for (const name of TOUCHED) delete process.env[name];
    Object.assign(process.env, ambient);
  });

  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    saved.clear();
  });

  test('an unauthenticated serverinfo request through the configured proxy succeeds', async () => {
    // a 2xx answer with the body of /json/serverinfo/*: the library rejects any other status
    const info = await serverInfoFrom(host);
    expect(typeof info.cookieName).toBe('string');
    expect(info.cookieName).not.toBe('');
  }, 60000);

  test('negative control: with the proxy replaced by a dead one, the same request fails', async () => {
    process.env.HTTPS_PROXY = DEAD_PROXY;
    // the lower case variable takes precedence over the upper case one
    process.env.https_proxy = DEAD_PROXY;

    let error: any;
    try {
      await serverInfoFrom(host);
    } catch (e) {
      error = e;
    }

    // If this fails, the request did not use the proxy variables (or NO_PROXY
    // excludes the tenant), and the probe above proves nothing.
    expect(error).toBeDefined();
    expect(String(error.message)).toContain('127.0.0.1:9');
  }, 60000);
});
