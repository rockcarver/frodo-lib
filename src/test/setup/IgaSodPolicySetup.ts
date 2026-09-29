import { PolicySkeleton } from '../../api/cloud/iga/IgaSodPolicyApi';
import { state } from '../../index';
import * as IgaSodPolicyOps from '../../ops/cloud/iga/IgaSodPolicyOps';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';

const policyOwner = {
  givenName: 'Frodo',
  id: 'managed/user/0ece145b-1467-4cac-b472-f8f34dfaeef3',
  mail: 'test@mail.com',
  sn: 'Test',
  userName: 'frodo-test',
};

export const Policy1: PolicySkeleton = {
  name: 'frodo-test-create',
  description: 'this is a test policy',
  policyOwner,
  policyRuleIds: ['df95d487-a251-458d-8299-14f2b131264c'],
  policyRuleNames: ['test rule'],
  active: true,
  id: 'e5b6a80d-a1ae-455f-830d-dc1bcc61b7cf',
  scheduleId: 'policySchedulee5b6a80da1ae455f830ddc1bcc61b7cf',
};

export const Policy2: PolicySkeleton = {
  name: 'frodo-test-existing',
  description: 'this is a test policy',
  policyOwner,
  policyRuleIds: ['df95d487-a251-458d-8299-14f2b131264c'],
  policyRuleNames: ['test rule'],
  active: true,
  id: 'a1111111-1111-1111-1111-111111111111',
  scheduleId: 'policySchedulea1111111111111111111111111111111',
};

export const Policy3: PolicySkeleton = {
  name: 'frodo-test-delete-by-id',
  description: 'this is a test policy',
  policyOwner,
  policyRuleIds: ['df95d487-a251-458d-8299-14f2b131264c'],
  policyRuleNames: ['test rule'],
  active: true,
  id: 'a2222222-2222-2222-2222-222222222222',
  scheduleId: 'policySchedulea2222222222222222222222222222222',
};

export const Policy4: PolicySkeleton = {
  name: 'frodo-test-delete-by-name',
  description: 'this is a test policy',
  policyOwner,
  policyRuleIds: ['df95d487-a251-458d-8299-14f2b131264c'],
  policyRuleNames: ['test rule'],
  active: true,
  id: 'a3333333-3333-3333-3333-333333333333',
  scheduleId: 'policySchedulea3333333333333333333333333333333',
};

export async function stagePolicy(
  policy: PolicySkeleton,
  createNew = false
): Promise<void> {
  try {
    await IgaSodPolicyOps.deletePolicyByName({ name: policy.name, state });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore — policy may not exist yet
  } finally {
    if (createNew) {
      await IgaSodPolicyOps.createPolicy({ policyData: policy, state });
    }
  }
}

export function setup() {
  const ctx = autoSetupPolly();
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      setupPollyRecordingContext(ctx);
    }
  });
  // in recording mode, set up test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicy(Policy1);
      await stagePolicy(Policy2, true);
      await stagePolicy(Policy3, true);
      await stagePolicy(Policy3, true);
      await stagePolicy(Policy4, true);
    }
  });
  // in recording mode, clean up test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicy(Policy1);
      await stagePolicy(Policy2);
      await stagePolicy(Policy3);
      await stagePolicy(Policy4);
    }
  });
}
