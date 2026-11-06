/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This test needs a working remote proxy on the tenant you record from: a
 *    proxy named 'frodo-dev' (or the name in FRODO_TEST_REMOTE_PROXY) to a
 *    second tenant, with an OAuth client on the receiving tenant that has the
 *    scope fr:idm:* and a static user mapping, see
 *    https://docs.pingidentity.com/pingoneaic/idm-objects/remote-proxy-setup.html
 *    The test only reads and changes nothing: it makes one read through the
 *    proxy (GET /openidm/info/login) and one through a name that does not
 *    exist. Check the recording before you commit it.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=<sending-tenant> npm run test:record -- src/lib/RemoteProxyCheck.test.ts
 *
 * 2. Update snapshots
 *
 *        FRODO_DEBUG=1 npm run test:update -- src/lib/RemoteProxyCheck.test.ts
 *
 * 3. Test your changes
 *
 *        npm run test:only -- src/lib/RemoteProxyCheck.test.ts
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { frodo, state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';

const PROXY_ID = process.env.FRODO_TEST_REMOTE_PROXY || 'frodo-dev';

const ctx = autoSetupPolly();

describe('testRemoteProxy()', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        // Filter recordings
        filterRecording(recording, true, state);
      });
    }
  });

  test('0: Method is implemented', async () => {
    expect(frodo.idm.remoteProxy.testRemoteProxy).toBeDefined();
  });

  test('1: A working proxy answers with the identity and roles it acts as on the receiving tenant', async () => {
    const result = await frodo.idm.remoteProxy.testRemoteProxy(PROXY_ID);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('ok');
    expect({
      ok: result.ok,
      status: result.status,
      httpStatus: result.httpStatus,
      authenticationId: result.authenticationId,
      roles: [...result.roles].sort(),
    }).toMatchSnapshot();
  });

  test('2: A proxy that does not exist is reported as not found', async () => {
    const result = await frodo.idm.remoteProxy.testRemoteProxy(
      'frodo-no-such-proxy'
    );
    expect(result.ok).toBe(false);
    expect({
      ok: result.ok,
      status: result.status,
      httpStatus: result.httpStatus,
    }).toMatchSnapshot();
  });
});
