/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record PoliciesApi
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update PoliciesApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only PoliciesApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as PolicySetApi from './PolicySetApi';
import * as PoliciesApi from './PoliciesApi';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { PolicySetSkeleton, PolicySkeleton } from './ApiTypes';
import { cloneDeep } from '../ops/utils/OpsUtils';
import { state } from '../index';

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

async function stagePolicy(policy: PolicySkeleton, create = true) {
  // delete if exists, then create
  try {
    await PoliciesApi.getPolicy({ policyId: policy._id, state });
    await PoliciesApi.deletePolicy({ policyId: policy._id, state });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await PoliciesApi.putPolicy({
        policyId: policy._id,
        policyData: policy,
        state,
      });
    }
  }
}

function applyPolicyTemplate(
  template: PolicySkeleton,
  policyId: string
): PolicySkeleton {
  const configured: PolicySkeleton = cloneDeep(template);
  configured._id = policyId;
  configured.name = policyId;
  return configured;
}

describe('PoliciesApi', () => {
  const set1: PolicySetSkeleton = {
    name: 'FrodoTestPolicySet1',
    displayName: 'Frodo Test Policy Set',
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
  const policyTemplate: PolicySkeleton = {
    _id: 'FrodoTestPolicyTemplate',
    name: 'FrodoTestPolicyTemplate',
    active: true,
    description: 'Frodo Test Policy',
    resources: ['*://*:*/forgerock/app2/*', '*://*:*/app2/*'],
    applicationName: set1.name,
    actionValues: {
      GET: true,
    },
    subject: {
      type: 'AuthenticatedUsers',
    },
    resourceTypeUuid: '76656a38-5f8e-401b-83aa-4ccb74ce88d2',
  };
  const policy1 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy1');
  const policy2 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy2');
  const policy3 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy3');
  const policy4 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy4');
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicySet(set1);
      await stagePolicy(policy1);
      await stagePolicy(policy2);
      await stagePolicy(policy3, false);
      await stagePolicy(policy4);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicy(policy1, false);
      await stagePolicy(policy2, false);
      await stagePolicy(policy3, false);
      await stagePolicy(policy4, false);
      await stagePolicySet(set1, false);
    }
  });

  describe('getPolicies()', () => {
    test('0: Method is implemented', async () => {
      expect(PoliciesApi.getPolicies).toBeDefined();
    });

    test('1: Get all policies', async () => {
      const response = await PoliciesApi.getPolicies({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getPoliciesByPolicySet()', () => {
    test('0: Method is implemented', async () => {
      expect(PoliciesApi.getPoliciesByPolicySet).toBeDefined();
    });

    test(`1: Get policies in existing policy set [${set1.name}]`, async () => {
      const response = await PoliciesApi.getPoliciesByPolicySet({
        policySetId: set1.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get policies in non-existing policy set [DoesNotExist]', async () => {
      const response = await PoliciesApi.getPoliciesByPolicySet({
        policySetId: 'DoesNotExist',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getPolicy()', () => {
    test('0: Method is implemented', async () => {
      expect(PoliciesApi.getPolicy).toBeDefined();
    });

    test(`1: Get existing policy [${policy1._id}]`, async () => {
      const response = await PoliciesApi.getPolicy({
        policyId: policy1._id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing policy [DoesNotExist]', async () => {
      expect.assertions(1);
      try {
        await PoliciesApi.getPolicy({ policyId: 'DoesNotExist', state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putPolicy()', () => {
    test('0: Method is implemented', async () => {
      expect(PoliciesApi.putPolicy).toBeDefined();
    });

    test(`1: Update existing policy [${policy2._id}]`, async () => {
      const response = await PoliciesApi.putPolicy({
        policyId: policy2._id,
        policyData: policy2,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Create non-existing policy [${policy3._id}]`, async () => {
      const response = await PoliciesApi.putPolicy({
        policyId: policy3._id,
        policyData: policy3,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('deletePolicy()', () => {
    test('0: Method is implemented', async () => {
      expect(PoliciesApi.deletePolicy).toBeDefined();
    });

    test(`1: Delete existing policy [${policy4.name}]`, async () => {
      const node = await PoliciesApi.deletePolicy({
        policyId: policy4.name,
        state,
      });
      expect(node).toMatchSnapshot();
    });

    test('2: Delete non-existing policy [DoesNotExist]', async () => {
      expect.assertions(1);
      try {
        await PoliciesApi.deletePolicy({ policyId: 'DoesNotExist', state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
