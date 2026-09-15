/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        phase 1
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=https://openam-frodo-dev.forgeblocks.com/am npm run test:record RawConfigOps
 *
 *        phase 2
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=https://openam-frodo-dev.forgeblocks.com/am npm run test:record RawConfigOps
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update RawConfigOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only RawConfigOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import { template1, template2 } from '../test/setup/EmailTemplateSetup';
import { requestType1, requestType3 } from '../test/setup/IgaRequestTypeSetup';
import { customNode1, customNode2 } from '../test/setup/NodeSetup';
import * as TestData from '../test/setup/RawConfigSetup';
import { variable1, variable2 } from '../test/setup/VariablesSetup';
import { encode } from '../utils/Base64Utils';
import { EMAIL_TEMPLATE_TYPE } from './EmailTemplateOps';
import * as RawConfigOps from './RawConfigOps';

describe('RawConfigOps', () => {
  TestData.setup();

  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('Cloud Tests', () => {
      describe('exportRawConfig()', () => {
        test('0: Method is implemented', async () => {
          expect(RawConfigOps.exportRawConfig).toBeDefined();
        });

        test('1: Export raw config am', async () => {
          const response = await RawConfigOps.exportRawConfig({
            endpoint: '/am/json/node-designer/node-type/' + customNode1._id,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test('2: Export raw config openidm', async () => {
          const response = await RawConfigOps.exportRawConfig({
            endpoint: `/openidm/config/${EMAIL_TEMPLATE_TYPE}/${template1._id}`,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test('3: Export raw config environment', async () => {
          const response = await RawConfigOps.exportRawConfig({
            endpoint: '/environment/variables/' + variable1._id,
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
            endpoint: '/am/json/node-designer/node-type/' + customNode2._id,
            payload: customNode2,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test(`2: importRawConfig openidm`, async () => {
          const response = await RawConfigOps.importRawConfig({
            endpoint: '/openidm/config/' + template2._id,
            payload: template2,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test(`3: importRawConfig environment`, async () => {
          const variable = { ...variable2 };
          variable.valueBase64 = encode(variable.value);
          delete variable.value;
          const response = await RawConfigOps.importRawConfig({
            endpoint: '/environment/variables/' + variable2._id,
            payload: variable,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    });
  }
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('IGA Tests', () => {
      describe('exportRawConfig()', () => {
        test('4: Export raw config iga', async () => {
          const response = await RawConfigOps.exportRawConfig({
            endpoint: `/iga/governance/requestTypes/${requestType1.id}`,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
      describe('importRawConfig()', () => {
        test(`4: importRawConfig iga`, async () => {
          const response = await RawConfigOps.importRawConfig({
            endpoint: `/iga/governance/requestTypes/${requestType3.id}`,
            payload: requestType3,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    });
  }
});
