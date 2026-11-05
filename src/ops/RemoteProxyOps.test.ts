/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    To record and update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record -- src/ops/RemoteProxyOps.test.ts
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine. Recording stages the test
 *    proxies FrodoTestRemoteProxy1 to 3 on the tenant and removes them again.
 *    The tenant may have other remote proxies; they show up in the list and
 *    the export of all proxies, so check the recording before you commit it.
 *
 * 2. Update snapshots
 *
 *        FRODO_DEBUG=1 npm run test:update -- src/ops/RemoteProxyOps.test.ts
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only -- src/ops/RemoteProxyOps.test.ts
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as TestData from '../test/setup/RemoteProxySetup';
import * as RemoteProxyOps from './RemoteProxyOps';
import { RemoteProxyExportInterface } from './RemoteProxyOps';

describe('RemoteProxyOps', () => {
  TestData.setup();

  describe('readRemoteProxy()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.readRemoteProxy).toBeDefined();
    });

    test(`1: Read remote proxy '${TestData.proxy1Id}'`, async () => {
      const response = await RemoteProxyOps.readRemoteProxy({
        proxyId: TestData.proxy1Id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readRemoteProxies()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.readRemoteProxies).toBeDefined();
    });

    test('1: Read all remote proxies', async () => {
      const response = await RemoteProxyOps.readRemoteProxies({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportRemoteProxy()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.exportRemoteProxy).toBeDefined();
    });

    test(`1: Export remote proxy '${TestData.proxy1Id}'`, async () => {
      const response = await RemoteProxyOps.exportRemoteProxy({
        proxyId: TestData.proxy1Id,
        state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportRemoteProxies()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.exportRemoteProxies).toBeDefined();
    });

    test('1: Export all remote proxies', async () => {
      const response = await RemoteProxyOps.exportRemoteProxies({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('createRemoteProxy()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.createRemoteProxy).toBeDefined();
    });

    test(`1: Create remote proxy '${TestData.proxy2Id}'`, async () => {
      const response = await RemoteProxyOps.createRemoteProxy({
        proxyId: TestData.proxy2Id,
        proxyData: TestData.proxy2,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Create remote proxy '${TestData.proxy2Id}' that already exists`, async () => {
      expect.assertions(1);
      try {
        await RemoteProxyOps.createRemoteProxy({
          proxyId: TestData.proxy2Id,
          proxyData: TestData.proxy2,
          state,
        });
      } catch (error) {
        expect(error.message).toMatchSnapshot();
      }
    });
  });

  describe('updateRemoteProxy()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.updateRemoteProxy).toBeDefined();
    });

    test(`1: Update remote proxy '${TestData.proxy2Id}'`, async () => {
      const response = await RemoteProxyOps.updateRemoteProxy({
        proxyId: TestData.proxy2Id,
        proxyData: { ...TestData.proxy2, enabled: false },
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('importRemoteProxies()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.importRemoteProxies).toBeDefined();
    });

    test('1: Import remote proxies', async () => {
      const importData: RemoteProxyExportInterface = {
        remoteProxy: { [TestData.proxy3Id]: TestData.proxy3 },
      };
      const response = await RemoteProxyOps.importRemoteProxies({
        importData,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteRemoteProxy()', () => {
    test('0: Method is implemented', async () => {
      expect(RemoteProxyOps.deleteRemoteProxy).toBeDefined();
    });

    test(`1: Delete remote proxy '${TestData.proxy3Id}'`, async () => {
      const response = await RemoteProxyOps.deleteRemoteProxy({
        proxyId: TestData.proxy3Id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
