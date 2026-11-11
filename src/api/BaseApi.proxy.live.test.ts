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
 * configuration is a probe nobody notices has stopped running. A tenant that
 * does not answer is a different matter, see below.
 *
 * It sends `GET <FRODO_HOST>/json/serverinfo/*` and nothing else, through the
 * library's own request path (`getServerInfo()`, the call the library makes
 * before it logs in). It never logs in and never writes. The jest setup file
 * test/jest-no-ambient-proxy.setup.js hides the proxy variables from the
 * tests; this file puts back what the setup file kept in
 * FRODO_TEST_AMBIENT_PROXY, because here the proxy of the environment is the
 * thing under test.
 *
 * A tenant that is down must not fail a pull request, and a failure of the
 * request through the proxy would then say nothing about the proxy. So the
 * probe first sends the same request without the proxy (src/test/utils/
 * ProxyProbe.ts decides what the answer means):
 *
 * - the direct request answers 2xx: the request through the proxy must answer
 *   2xx too;
 * - it does not (no answer, a timeout, a 5xx, a 429, any other status): the
 *   probe says so in the log and as an annotation of the run, and does not send
 *   the request through the proxy.
 *
 * The negative control needs no tenant: a dead proxy must fail the request
 * with an error that names the dead proxy and says that the proxy refused the
 * connection (`proxyFailure`, frodo-lib#986), whatever the tenant does, so it
 * always runs.
 *
 * Each call imports the library afresh, so that no agent of an earlier call is
 * reused.
 */
import { jest } from '@jest/globals';
import { runProxyProbe } from '../test/utils/ProxyProbe';

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

/**
 * Say that the probe did not run. `jest --silent`, which the test:proxy script
 * uses, discards console output, so the line is also written to stderr as a
 * workflow command: it shows in the log and as a warning of the run.
 */
function announce(message: string) {
  console.warn(message);
  process.stderr.write(`::warning title=Proxy probe not run::${message}\n`);
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

  test('when the tenant answers directly, an unauthenticated serverinfo request through the configured proxy succeeds too', async () => {
    await runProxyProbe({
      askDirect: async () => {
        // no proxy variable at all: the request the proxy is compared with
        for (const name of TOUCHED) delete process.env[name];
        try {
          return await serverInfoFrom(host);
        } finally {
          Object.assign(process.env, ambient);
        }
      },
      askThroughProxy: async () => {
        // a 2xx answer with the body of /json/serverinfo/*: the library rejects any other status
        const info = await serverInfoFrom(host);
        expect(typeof info.cookieName).toBe('string');
        expect(info.cookieName).not.toBe('');
      },
      announce,
    });
  }, 120000);

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
    // and the error says the proxy was the one that refused
    expect(error.proxyFailure).toMatchObject({
      code: 'PROXY_CONNECTION_REFUSED',
      proxy: { host: '127.0.0.1', port: 9 },
      target: 'https',
    });
  }, 60000);
});
