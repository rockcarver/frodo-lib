/*
 * Keeps the proxy settings of the machine out of the tests.
 *
 * Why this exists:
 * - frodo-lib sends every request through proxy-agent, which reads HTTP_PROXY,
 *   HTTPS_PROXY, ALL_PROXY and NO_PROXY from the environment when a request is
 *   made. A developer behind a corporate proxy, or a CI job that sets one, would
 *   otherwise send the requests of every test with a real socket (a loopback
 *   server, say) to that proxy, and those tests fail.
 * - Recorded tests replay from disk and never open a socket, so they are not
 *   affected. Only the tests with real sockets are.
 *
 * What this does, before each test file:
 * - Removes the proxy variables, in upper and lower case (proxy-from-env reads
 *   the lower case one first), and the npm_config_ ones it also reads.
 * - Sets NO_PROXY so that the loopback interface is never proxied, whatever a
 *   test sets afterwards.
 * - Keeps what it removed as JSON in FRODO_TEST_AMBIENT_PROXY, for the one test
 *   that wants the proxy of the machine: the live probe in
 *   src/api/BaseApi.proxy.live.test.ts.
 *
 * A test of the proxy support sets the variables it needs itself, in the test,
 * and restores them. See decisions/0017-proxy-support-is-guarded-by-a-short-named-set-of-tests.md.
 */
const PROXY_VARIABLES = [
  'HTTP_PROXY',
  'http_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NO_PROXY',
  'no_proxy',
  'npm_config_proxy',
  'npm_config_http_proxy',
  'npm_config_https_proxy',
  'npm_config_no_proxy',
];

const LOOPBACK = '127.0.0.1,localhost,::1';

const ambient = {};
for (const name of PROXY_VARIABLES) {
  if (process.env[name] !== undefined) ambient[name] = process.env[name];
  delete process.env[name];
}
process.env.NO_PROXY = LOOPBACK;
process.env.FRODO_TEST_AMBIENT_PROXY = JSON.stringify(ambient);
