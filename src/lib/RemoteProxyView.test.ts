/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This test needs a working remote proxy on the tenant you record from:
 *    a proxy named 'frodo-dev' (or the name in FRODO_TEST_REMOTE_PROXY) to a
 *    second tenant, with an OAuth client on the receiving tenant that has the
 *    scope fr:idm:* and a static user mapping, see
 *    https://docs.pingidentity.com/pingoneaic/idm-objects/remote-proxy-setup.html
 *    A proxy that works cannot be staged by the test. The test only reads and
 *    changes nothing: it counts the managed objects of one type, and the
 *    response of that count lists the objects. Use a type that holds no
 *    personal data (alpha_role does) and check the recording before you
 *    commit it.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=<sending-tenant> npm run test:record -- src/lib/RemoteProxyView.test.ts
 *
 *    The numbers in the snapshot are the counts of the two tenants.
 *
 * 2. Update snapshots
 *
 *        FRODO_DEBUG=1 npm run test:update -- src/lib/RemoteProxyView.test.ts
 *
 * 3. Test your changes
 *
 *        npm run test:only -- src/lib/RemoteProxyView.test.ts
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { frodo, state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';

const PROXY_ID = process.env.FRODO_TEST_REMOTE_PROXY || 'frodo-dev';

const ctx = autoSetupPolly();

describe('createRemoteProxyView()', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        // Filter recordings
        filterRecording(recording, true, state);
      });
    }
  });

  test('0: Method is implemented', async () => {
    expect(frodo.createRemoteProxyView).toBeDefined();
  });

  test('1: The view counts the roles of the receiving tenant, the instance those of its own tenant', async () => {
    const view = frodo.createRemoteProxyView(PROXY_ID);
    const own = await frodo.idm.managed.countManagedObjects('alpha_role');
    const remote = await view.idm.managed.countManagedObjects('alpha_role');
    const ownAfter = await frodo.idm.managed.countManagedObjects('alpha_role');
    expect(remote).not.toEqual(own);
    expect(ownAfter).toEqual(own);
    expect({ own, remote }).toMatchSnapshot();
  });
});
