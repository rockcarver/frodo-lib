/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record EmailTemplateOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EmailTemplateOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EmailTemplateOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import { customNode1, customNode2 } from '../test/setup/NodeSetup';
import { template1, template2 } from '../test/setup/EmailTemplateSetup';
import { variable1, variable2 } from '../test/setup/VariablesSetup';
import * as TestData from '../test/setup/RawConfigSetup';
import * as RawConfigOps from './RawConfigOps';
import { EMAIL_TEMPLATE_TYPE } from './EmailTemplateOps';
import { encode } from '../utils/Base64Utils';

describe('RawConfigOps', () => {
  TestData.setup();

  describe('exportRawConfig()', () => {
    test('0: Method is implemented', async () => {
      expect(RawConfigOps.exportRawConfig).toBeDefined();
    });

    test('1: Export raw config am', async () => {
      const response = await RawConfigOps.exportRawConfig({
        options: {
          path: '/am/json/node-designer/node-type/' + customNode1._id,
          overrides: { _id: 'test' },
          pushApiVersion: { protocol: '2.1', resource: '2.0' },
        },
        state,
      });
      expect(response._id).toBe('test');
      expect(response).toMatchSnapshot();
    });

    test('2: Export raw config openidm', async () => {
      const response = await RawConfigOps.exportRawConfig({
        options: {
          path: `/openidm/config/${EMAIL_TEMPLATE_TYPE}/${template1._id}`,
        },
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('3: Export raw config environment', async () => {
      const response = await RawConfigOps.exportRawConfig({
        options: { path: '/environment/variables/' + variable1._id },
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('importRawConfig()', () => {
    test('0: Method is implemented', async () => {
      expect(RawConfigOps.importRawConfig).toBeDefined();
    });

    test(`1: importRawConfig am`, async () => {
      const response = await RawConfigOps.importRawConfig({
        options: {
          path: '/am/json/node-designer/node-type/' + customNode2._id,
        },
        data: customNode2,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: importRawConfig openidm`, async () => {
      const response = await RawConfigOps.importRawConfig({
        options: { path: '/openidm/config/' + template2._id },
        data: template2,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: importRawConfig environment`, async () => {
      const variable = { ...variable2 };
      variable.valueBase64 = encode(variable.value);
      delete variable.value;
      const response = await RawConfigOps.importRawConfig({
        options: { path: '/environment/variables/' + variable2._id },
        data: variable,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
