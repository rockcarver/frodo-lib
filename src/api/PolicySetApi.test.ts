/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record PolicySetApi
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update PolicySetApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only PolicySetApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as PolicySetApi from './PolicySetApi';
import { state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { PolicySetSkeleton } from './ApiTypes';
import { cloneDeep } from '../utils/JsonUtils';

autoSetupPolly();

async function stagePolicySet(policySet: PolicySetSkeleton, create = true) {
  // delete if exists, then create
  try {
    await PolicySetApi.getPolicySet({ policySetName: policySet.name, state });
    await PolicySetApi.deletePolicySet({
      policySetName: policySet.name,
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await PolicySetApi.createPolicySet({ policySetData: policySet, state });
    }
  }
}

function applyPolicySetTemplate(
  template: PolicySetSkeleton,
  name: string
): PolicySetSkeleton {
  const configured: PolicySetSkeleton = cloneDeep(template);
  configured.name = name;
  return configured;
}

describe('PolicySetApi', () => {
  const policySetTemplate: PolicySetSkeleton = {
    name: 'FrodoTestPolicySetTemplate',
    displayName: 'Frodo Test Policy Set Template',
    description: null,
    attributeNames: [],
    conditions: [
      'Script',
      'AMIdentityMembership',
      'IPv6',
      'IPv4',
      'SimpleTime',
      'LEAuthLevel',
      'LDAPFilter',
      'AuthScheme',
      'Session',
      'AND',
      'AuthenticateToRealm',
      'ResourceEnvIP',
      'Policy',
      'OAuth2Scope',
      'SessionProperty',
      'OR',
      'Transaction',
      'NOT',
      'AuthLevel',
      'AuthenticateToService',
    ],
    resourceTypeUuids: ['76656a38-5f8e-401b-83aa-4ccb74ce88d2'],
    resourceComparator: null,
    editable: true,
    saveIndex: null,
    searchIndex: null,
    applicationType: 'iPlanetAMWebAgentService',
    entitlementCombiner: 'DenyOverride',
    subjects: [
      'AuthenticatedUsers',
      'NOT',
      'Identity',
      'OR',
      'AND',
      'NONE',
      'Policy',
      'JwtClaim',
    ],
  };
  const set1 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet1');
  const set2 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet2');
  const set3 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet3');
  const set4 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet4');
  const set5 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet5');
  const set6 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet6');
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicySet(set1);
      await stagePolicySet(set2, false);
      await stagePolicySet(set3);
      await stagePolicySet(set4);
      await stagePolicySet(set5, false);
      await stagePolicySet(set6);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicySet(set1, false);
      await stagePolicySet(set2, false);
      await stagePolicySet(set3, false);
      await stagePolicySet(set4, false);
      await stagePolicySet(set5, false);
      await stagePolicySet(set6, false);
    }
  });

  describe('getPolicySets()', () => {
    test('0: Method is implemented', async () => {
      expect(PolicySetApi.getPolicySets).toBeDefined();
    });

    test('1: Get all policy sets', async () => {
      const response = await PolicySetApi.getPolicySets({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getPolicySet()', () => {
    test('0: Method is implemented', async () => {
      expect(PolicySetApi.getPolicySet).toBeDefined();
    });

    test(`1: Get existing policy set [${set1.name}]`, async () => {
      const response = await PolicySetApi.getPolicySet({
        policySetName: set1.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing policy set by uuid [DoesNotExist]', async () => {
      expect.assertions(1);
      try {
        await PolicySetApi.getPolicySet({
          policySetName: 'DoesNotExist',
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('createPolicySet()', () => {
    test('0: Method is implemented', async () => {
      expect(PolicySetApi.createPolicySet).toBeDefined();
    });

    test(`1: Create non-existing policy set [${set2.name}]`, async () => {
      const response = await PolicySetApi.createPolicySet({
        policySetData: set2,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Create existing policy set [${set3.name}]`, async () => {
      expect.assertions(1);
      try {
        await PolicySetApi.createPolicySet({ policySetData: set3, state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('updatePolicySet()', () => {
    test('0: Method is implemented', async () => {
      expect(PolicySetApi.updatePolicySet).toBeDefined();
    });

    test(`1: Update existing policy set [${set4.name}]`, async () => {
      const response = await PolicySetApi.updatePolicySet({
        policySetData: set4,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Update non-existing policy set [${set5.name}]`, async () => {
      expect.assertions(1);
      try {
        await PolicySetApi.updatePolicySet({ policySetData: set5, state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deletePolicySet()', () => {
    test('0: Method is implemented', async () => {
      expect(PolicySetApi.deletePolicySet).toBeDefined();
    });

    test(`1: Delete existing policy set [${set6.name}]`, async () => {
      const node = await PolicySetApi.deletePolicySet({
        policySetName: set6.name,
        state,
      });
      expect(node).toMatchSnapshot();
    });

    test('2: Delete non-existing policy set [DoesNotExist]', async () => {
      expect.assertions(1);
      try {
        await PolicySetApi.deletePolicySet({
          policySetName: 'DoesNotExist',
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
