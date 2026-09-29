/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record and update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record IgaSodPolicyOps
 *
 *    
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaSodPolicyOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaSodPolicyOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { PolicySkeleton } from '../../../api/cloud/iga/IgaSodPolicyApi';
import { state } from '../../../index';
import * as IgaSodPolicyOps from './IgaSodPolicyOps';
import { PolicyExportInterface } from './IgaSodPolicyOps';

import * as TestData from '../../../test/setup/IgaSodPolicySetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';



const TEST_PREFIX = 'frodo-test';


const normalizePolicies = (policies: PolicySkeleton[]): PolicySkeleton[] =>
  policies
    .filter((p) => p.name.startsWith(TEST_PREFIX))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ ...p, id: '[id]', scheduleId: '[scheduleId]' }));


const normalizeExport = (exp: PolicyExportInterface): PolicyExportInterface => ({
  ...exp,
  policy: Object.fromEntries(
    normalizePolicies(Object.values(exp.policy)).map((p) => [p.name, p])
  ),
});

describe('IgaSodPolicyOps', () => {
  TestData.setup();

  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record')
  ) {
    describe('createPolicyExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.createPolicyExportTemplate).toBeDefined();
      });

      test('1: Create Policy Export Template', async () => {
        const response = IgaSodPolicyOps.createPolicyExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.createPolicy).toBeDefined();
      });

      test('1: Create policy', async () => {
        const response = await IgaSodPolicyOps.createPolicy({
          policyData: TestData.Policy1,
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
          scheduleId: expect.any(String),
        });
      });
    });

    describe('readPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.readPolicy).toBeDefined();
      });

      test('1: Read existing policy by id', async () => {
        const { id } = await IgaSodPolicyOps.readPolicyByName({
          name: TestData.Policy2.name,
          state,
        });
        const response = await IgaSodPolicyOps.readPolicy({ id, state });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
          scheduleId: expect.any(String),
        });
      });

      test('2: Read non-existing policy', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(
          IgaSodPolicyOps.readPolicy({ id: unknownId, state })
        ).rejects.toThrow('Error reading policy ' + unknownId);
      });
    });

    describe('readPolicyByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.readPolicyByName).toBeDefined();
      });

      test('1: Read existing policy by name', async () => {
        const response = await IgaSodPolicyOps.readPolicyByName({
          name: TestData.Policy2.name,
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
          scheduleId: expect.any(String),
        });
      });

      test('2: Read non-existing policy with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(
          IgaSodPolicyOps.readPolicyByName({ name: unknownName, state })
        ).rejects.toThrow('Error reading policy ' + unknownName);
      });
    });

    describe('readPolicies()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.readPolicies).toBeDefined();
      });

      test('1: Read existing policies', async () => {
        const response = await IgaSodPolicyOps.readPolicies({ state });
        expect(normalizePolicies(response)).toMatchSnapshot();
      });
    });

    describe('exportPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.exportPolicy).toBeDefined();
      });

      test('1: Export existing policy by id', async () => {
        const { id } = await IgaSodPolicyOps.readPolicyByName({
          name: TestData.Policy2.name,
          state,
        });
        const response = await IgaSodPolicyOps.exportPolicy({ id, state });
        expect(normalizeExport(response)).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export non-existing policy', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(
          IgaSodPolicyOps.exportPolicy({ id: unknownId, state })
        ).rejects.toThrow('Error exporting policy ' + unknownId);
      });
    });

    describe('exportPoliciesByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.exportPoliciesByName).toBeDefined();
      });

      test('1: Export existing policy by name', async () => {
        const response = await IgaSodPolicyOps.exportPoliciesByName({
          name: TestData.Policy2.name,
          state,
        });
        expect(normalizeExport(response)).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export non-existing policy with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(
          IgaSodPolicyOps.exportPoliciesByName({ name: unknownName, state })
        ).rejects.toThrow('Error exporting policy ' + unknownName);
      });
    });

    describe('exportPolicies()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.exportPolicies).toBeDefined();
      });

      test('1: Export existing policies', async () => {
        const response = await IgaSodPolicyOps.exportPolicies({ state });
        expect(normalizeExport(response)).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('deletePolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.deletePolicy).toBeDefined();
      });

      test('1: Delete existing policy by id', async () => {
        const { id } = await IgaSodPolicyOps.readPolicyByName({
          name: TestData.Policy3.name,
          state,
        });
        const response = await IgaSodPolicyOps.deletePolicy({ id, state });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
          scheduleId: expect.any(String),
        });
      });

      test('2: Delete non-existing policy by id', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(
          IgaSodPolicyOps.deletePolicy({ id: unknownId, state })
        ).rejects.toThrow('Error deleting policy ' + unknownId);
      });
    });

    describe('deletePolicyByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.deletePolicyByName).toBeDefined();
      });

      test('1: Delete existing policy by name', async () => {
        const response = await IgaSodPolicyOps.deletePolicyByName({
          name: TestData.Policy4.name,
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
          scheduleId: expect.any(String),
        });
      });

      test('2: Delete non-existing policy by name', async () => {
        const unknownName = 'unknownName';
        await expect(
          IgaSodPolicyOps.deletePolicyByName({ name: unknownName, state })
        ).rejects.toThrow('Error deleting policy ' + unknownName);
      });
    });


 describe('importPolicy()', () => {
      const importData = IgaSodPolicyOps.createPolicyExportTemplate({ state });
      importData.policy = {
        [TestData.Policy2.id]: TestData.Policy2,
        [TestData.Policy3.id]: TestData.Policy3,
        [TestData.Policy4.id]: TestData.Policy4,
      };
 
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyOps.importPolicy).toBeDefined();
      });
 
      test('1: Import None', async () => {
        const response = await IgaSodPolicyOps.importPolicy({
          importData: IgaSodPolicyOps.createPolicyExportTemplate({ state }),
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizePolicies(response)).toMatchSnapshot();
      });
 
      test('2: Import by id', async () => {
        const response = await IgaSodPolicyOps.importPolicy({
          id: TestData.Policy3.id,
          importData,
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizePolicies(response)).toMatchSnapshot();
      });
 
      test('3: Import by name', async () => {
        const response = await IgaSodPolicyOps.importPolicy({
          name: TestData.Policy4.name,
          importData,
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizePolicies(response)).toMatchSnapshot();
      });
 
      test('4: Import all', async () => {
        const response = await IgaSodPolicyOps.importPolicy({
          importData,
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizePolicies(response)).toMatchSnapshot();
      });
    });
  }
   }
);