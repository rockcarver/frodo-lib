/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record DESTRUCTIVE tests
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record and update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record IgaSodPolicyRuleOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaSodPolicyRuleOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaSodPolicyRuleOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { PolicyRuleSkeleton } from '../../../api/cloud/iga/IgaSodPolicyRulesApi';
import { state } from '../../../index';
import * as IgaSodPolicyRuleOps from './IgaSodPolicyRuleOps';
import { PolicyRuleExportInterface } from './IgaSodPolicyRuleOps';

import * as TestData from '../../../test/setup/IgaSodPolicyRulesSetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';

const TEST_PREFIX = 'trodo-test-rule';


const normalizeRules = (rules: PolicyRuleSkeleton[]): PolicyRuleSkeleton[] =>
  rules
    .filter((r) => r.name.startsWith(TEST_PREFIX))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({ ...r, id: '[id]' }));

const normalizeExport = (
  exp: PolicyRuleExportInterface
): PolicyRuleExportInterface => ({
  ...exp,
  policyRule: Object.fromEntries(
    normalizeRules(Object.values(exp.policyRule)).map((r) => [r.name, r])
  ),
});

describe('IgaSodPolicyRuleOps', () => {
  TestData.setup();

  
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record')
  ) {
    describe('createPolicyRuleExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.createPolicyRuleExportTemplate).toBeDefined();
      });

      test('1: Create Policy Rule Export Template', async () => {
        const response = IgaSodPolicyRuleOps.createPolicyRuleExportTemplate({
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createPolicyRule()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.createPolicyRule).toBeDefined();
      });

      test('1: Create policy rule', async () => {
        const response = await IgaSodPolicyRuleOps.createPolicyRule({
          policyRuleData: TestData.Rule1,
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
        });
      });
    });

    describe('readPolicyRule()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.readPolicyRule).toBeDefined();
      });

      test('1: Read existing policy rule by id', async () => {
        const { id } = await IgaSodPolicyRuleOps.readPolicyRuleByName({
          name: TestData.Rule2.name,
          state,
        });
        const response = await IgaSodPolicyRuleOps.readPolicyRule({ id, state });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
        });
      });

      test('2: Read non-existing policy rule', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(
          IgaSodPolicyRuleOps.readPolicyRule({ id: unknownId, state })
        ).rejects.toThrow('Error reading policy ' + unknownId);
      });
    });

    describe('readPolicyRuleByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.readPolicyRuleByName).toBeDefined();
      });

      test('1: Read existing policy rule by name', async () => {
        const response = await IgaSodPolicyRuleOps.readPolicyRuleByName({
          name: TestData.Rule2.name,
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
        });
      });

      test('2: Read non-existing policy rule with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(
          IgaSodPolicyRuleOps.readPolicyRuleByName({ name: unknownName, state })
        ).rejects.toThrow('Error reading policy ' + unknownName);
      });
    });

    describe('readPolicyRules()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.readPolicyRules).toBeDefined();
      });

      test('1: Read existing policy rules', async () => {
        const response = await IgaSodPolicyRuleOps.readPolicyRules({ state });
        expect(normalizeRules(response)).toMatchSnapshot();
      });
    });

    describe('exportPolicyRule()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.exportPolicyRule).toBeDefined();
      });

      test('1: Export existing policy rule by id', async () => {
        const { id } = await IgaSodPolicyRuleOps.readPolicyRuleByName({
          name: TestData.Rule2.name,
          state,
        });
        const response = await IgaSodPolicyRuleOps.exportPolicyRule({
          id,
          state,
        });
        expect(normalizeExport(response)).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export non-existing policy rule', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(
          IgaSodPolicyRuleOps.exportPolicyRule({ id: unknownId, state })
        ).rejects.toThrow('Error exporting policy rule ' + unknownId);
      });
    });

    describe('exportPolicyRuleByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.exportPolicyRuleByName).toBeDefined();
      });

      test('1: Export existing policy rule by name', async () => {
        const response = await IgaSodPolicyRuleOps.exportPolicyRuleByName({
          name: TestData.Rule2.name,
          state,
        });
        expect(normalizeExport(response)).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export non-existing policy rule with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(
          IgaSodPolicyRuleOps.exportPolicyRuleByName({
            name: unknownName,
            state,
          })
        ).rejects.toThrow('Error exporting policy ' + unknownName);
      });
    });

    describe('exportPolicyRules()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.exportPolicyRules).toBeDefined();
      });

      test('1: Export existing policy rules', async () => {
        const response = await IgaSodPolicyRuleOps.exportPolicyRules({ state });
        expect(normalizeExport(response)).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updatePolicyRules()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.updatePolicyRules).toBeDefined();
      });

      test('1: Update existing policy rule', async () => {
        const existing = await IgaSodPolicyRuleOps.readPolicyRuleByName({
          name: TestData.Rule2.name,
          state,
        });
        const response = await IgaSodPolicyRuleOps.updatePolicyRules({
          id: existing.id,
          policyRuleData: { ...existing, description: 'updated description' },
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
        });
      });

      test('2: Update non-existing policy rule', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(
          IgaSodPolicyRuleOps.updatePolicyRules({
            id: unknownId,
            policyRuleData: { ...TestData.Rule2, id: unknownId },
            state,
          })
        ).rejects.toThrow(`Error updating policy '${unknownId}'`);
      });
    });

    describe('deletePolicyRule()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.deletePolicyRule).toBeDefined();
      });

      test('1: Delete existing policy rule by id', async () => {
        const { id } = await IgaSodPolicyRuleOps.readPolicyRuleByName({
          name: TestData.Rule3.name,
          state,
        });
        const response = await IgaSodPolicyRuleOps.deletePolicyRule({
          id,
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
        });
      });

      test('2: Delete non-existing policy rule by id', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(
          IgaSodPolicyRuleOps.deletePolicyRule({ id: unknownId, state })
        ).rejects.toThrow('Error deleting policy rule ' + unknownId);
      });
    });

    describe('deletePolicyRuleByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.deletePolicyRuleByName).toBeDefined();
      });

      test('1: Delete existing policy rule by name', async () => {
        const response = await IgaSodPolicyRuleOps.deletePolicyRuleByName({
          name: TestData.Rule4.name,
          state,
        });
        expect(response).toMatchSnapshot({
          id: expect.any(String),
        });
      });

      test('2: Delete non-existing policy rule by name', async () => {
        const unknownName = 'unknownName';
        await expect(
          IgaSodPolicyRuleOps.deletePolicyRuleByName({
            name: unknownName,
            state,
          })
        ).rejects.toThrow('Error deleting policy ' + unknownName);
      });
    });

    describe('importPolicyRule()', () => {
      const importData = IgaSodPolicyRuleOps.createPolicyRuleExportTemplate({
        state,
      });
      importData.policyRule = {
        [TestData.Rule2.id]: TestData.Rule2,
        [TestData.Rule3.id]: TestData.Rule3,
        [TestData.Rule4.id]: TestData.Rule4,
      };

      test('0: Method is implemented', async () => {
        expect(IgaSodPolicyRuleOps.importPolicyRule).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await IgaSodPolicyRuleOps.importPolicyRule({
          importData: IgaSodPolicyRuleOps.createPolicyRuleExportTemplate({
            state,
          }),
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizeRules(response)).toMatchSnapshot();
      });

      test('2: Import by id', async () => {
        const response = await IgaSodPolicyRuleOps.importPolicyRule({
          id: TestData.Rule3.id,
          importData,
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizeRules(response)).toMatchSnapshot();
      });

      test('3: Import by name', async () => {
        const response = await IgaSodPolicyRuleOps.importPolicyRule({
          name: TestData.Rule4.name,
          importData,
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizeRules(response)).toMatchSnapshot();
      });

      test('4: Import all', async () => {
        const response = await IgaSodPolicyRuleOps.importPolicyRule({
          importData,
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(normalizeRules(response)).toMatchSnapshot();
      });
    });
  }
});