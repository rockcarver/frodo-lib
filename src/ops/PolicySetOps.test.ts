/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record non-conflicting tests
 *    Phase 2: Record conflicting tests - Deletes
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record PolicySetOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record PolicySetOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update PolicySetOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only PolicySetOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as PolicySetApi from '../api/PolicySetApi';
import * as PolicySetOps from './PolicySetOps';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { PolicySetSkeleton } from '../api/ApiTypes';
import { cloneDeep } from './utils/OpsUtils';
import { PolicySetExportInterface } from '../../types/ops/PolicySetOps';

autoSetupPolly();

async function stagePolicySet(policySet: PolicySetSkeleton, create = true) {
  // delete if exists, then create
  try {
    await PolicySetApi.getPolicySet(policySet.name);
    await PolicySetApi.deletePolicySet(policySet.name);
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await PolicySetApi.createPolicySet(policySet);
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

describe('PolicySetOps', () => {
  const urlResourceType = {
    uuid: '76656a38-5f8e-401b-83aa-4ccb74ce88d2',
    name: 'URL',
    description: 'The built-in URL Resource Type available to OpenAMPolicies.',
    patterns: ['*://*:*/*', '*://*:*/*?*'],
    actions: {
      HEAD: true,
      DELETE: true,
      POST: true,
      GET: true,
      OPTIONS: true,
      PUT: true,
      PATCH: true,
    },
    createdBy: 'id=dsameuser,ou=user,ou=am-config',
    creationDate: 1595479030487,
    lastModifiedBy:
      'id=8d9723a9-a439-4cbf-beb4-30e52811789d,ou=user,ou=am-config',
    lastModifiedDate: 1682866321984,
  };
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
  const set3 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet3');
  const set4 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet4');
  const set5 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet5');
  const set6 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet6');
  const set7 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet7');
  const set9 = applyPolicySetTemplate(policySetTemplate, 'FrodoTestPolicySet9');
  const set11 = applyPolicySetTemplate(
    policySetTemplate,
    'FrodoTestPolicySet11'
  );
  const set13 = applyPolicySetTemplate(
    policySetTemplate,
    'FrodoTestPolicySet13'
  );
  const set14 = applyPolicySetTemplate(
    policySetTemplate,
    'FrodoTestPolicySet14'
  );
  const set15 = applyPolicySetTemplate(
    policySetTemplate,
    'FrodoTestPolicySet15'
  );
  const set16 = applyPolicySetTemplate(
    policySetTemplate,
    'FrodoTestPolicySet16'
  );
  const import1: PolicySetExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {},
    policy: {},
    policyset: {
      [set11.name]: set11,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  const import3: PolicySetExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {},
    policy: {},
    policyset: {
      [set13.name]: set13,
      [set14.name]: set14,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  const import4: PolicySetExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {},
    policy: {},
    policyset: {
      [set15.name]: set15,
      [set16.name]: set16,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicySet(set1);
      await stagePolicySet(set3, false);
      await stagePolicySet(set4);
      await stagePolicySet(set5);
      await stagePolicySet(set6, false);
      await stagePolicySet(set7);
      await stagePolicySet(set9);
      await stagePolicySet(set11, false);
      await stagePolicySet(set13, false);
      await stagePolicySet(set14, false);
      await stagePolicySet(set15, false);
      await stagePolicySet(set16, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicySet(set1, false);
      await stagePolicySet(set3, false);
      await stagePolicySet(set4, false);
      await stagePolicySet(set5, false);
      await stagePolicySet(set6, false);
      await stagePolicySet(set7, false);
      await stagePolicySet(set9, false);
      await stagePolicySet(set11, false);
      await stagePolicySet(set13, false);
      await stagePolicySet(set14, false);
      await stagePolicySet(set15, false);
      await stagePolicySet(set16, false);
    }
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('getPolicySets()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.getPolicySets).toBeDefined();
      });

      test('1: Get all policy sets', async () => {
        const response = await PolicySetOps.getPolicySets();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getPolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.getPolicySet).toBeDefined();
      });

      test(`1: Get existing policy set [${set1.name}]`, async () => {
        const response = await PolicySetOps.getPolicySet(set1.name);
        expect(response).toMatchSnapshot();
      });

      test('2: Get non-existing policy set [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicySetOps.getPolicySet('DoesNotExist');
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('createPolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.createPolicySet).toBeDefined();
      });

      test(`1: Create non-existing policy set [${set3.name}]`, async () => {
        const response = await PolicySetOps.createPolicySet(set3);
        expect(response).toMatchSnapshot();
      });

      test(`2: Create existing policy set [${set4.name}]`, async () => {
        expect.assertions(1);
        try {
          await PolicySetOps.createPolicySet(set4);
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('updatePolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.updatePolicySet).toBeDefined();
      });

      test(`1: Update existing policy set [${set5.name}]`, async () => {
        const response = await PolicySetOps.updatePolicySet(set5);
        expect(response).toMatchSnapshot();
      });

      test(`2: Update non-existing policy set [${set6.name}]`, async () => {
        expect.assertions(1);
        try {
          await PolicySetOps.updatePolicySet(set6);
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('exportPolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.exportPolicySet).toBeDefined();
      });

      test(`1: Export existing policy set w/o deps [${set9.name}]`, async () => {
        const response = await PolicySetOps.exportPolicySet(set9.name, {
          deps: false,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing policy set w/ deps [${set9.name}]`, async () => {
        const response = await PolicySetOps.exportPolicySet(set9.name, {
          deps: true,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('3: Export non-existing policy set [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicySetOps.exportPolicySet('DoesNotExist', {
            deps: false,
            prereqs: false,
            useStringArrays: true,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('exportPolicySets()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.exportPolicySets).toBeDefined();
      });

      test('1: Export all policy sets', async () => {
        const response = await PolicySetOps.exportPolicySets({
          deps: true,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('importPolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.importPolicySet).toBeDefined();
      });

      test(`1: Import existing policy set [${set11.name}]`, async () => {
        const response = await PolicySetOps.importPolicySet(
          set11.name,
          import1,
          { deps: true, prereqs: false }
        );
        expect(response).toMatchSnapshot();
      });

      test('2: Import non-existing policy set [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicySetOps.importPolicySet('DoesNotExist', import1, {
            deps: true,
            prereqs: false,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importFirstPolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.importFirstPolicySet).toBeDefined();
      });

      test('1: Import first policy set', async () => {
        const response = await PolicySetOps.importFirstPolicySet(import3, {
          deps: true,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('importPolicySets()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.importPolicySets).toBeDefined();
      });

      test('1: Import all policy sets', async () => {
        const response = await PolicySetOps.importPolicySets(import4, {
          deps: true,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deletePolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicySetOps.deletePolicySet).toBeDefined();
      });

      test(`1: Delete existing policy set [${set7.name}]`, async () => {
        const response = await PolicySetOps.deletePolicySet(set7.name);
        expect(response).toMatchSnapshot();
      });

      test('2: Delete non-existing policy set [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicySetOps.deletePolicySet('DoesNotExist');
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });
  }
});
