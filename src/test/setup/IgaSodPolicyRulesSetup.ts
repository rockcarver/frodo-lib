import { PolicyRuleSkeleton } from '../../api/cloud/iga/IgaSodPolicyRulesApi';
import { state } from '../../index';
import * as IgaSodPolicyRuleOps from '../../ops/cloud/iga/IgaSodPolicyRuleOps';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';

const policyRuleOwner = {
  givenName: 'Dallin',
  id: 'managed/user/5068da35-7971-4f11-becf-ba716b6aadb9',
  mail: 'test@mail.com',
  sn: 'sevy',
  userName: 'Dallin',
};

const baseRule: Omit<PolicyRuleSkeleton, 'name' | 'id'> = {
  description: 'this is a test policy rule',
  active: true,
  policyRuleOwner,
  scanTypes: { preventative: true, detective: true },
  decisionOptions: { exception: true, allow: true, remediate: true },
  maxExceptionDuration: 90,
  remediation: { schemas: ['grantRemoval'] },
  mitigatingControl: '',
  correctionAdvice: '',
  documentationUrl: '',
  violationOwner: policyRuleOwner,
  violationLifecycle: {
    workflow: { action: 'do_nothing' },
    expiration: { expires: false },
    exception: { justificationCheck: true },
  },
  violationOwnerType: 'user',
  userFilter: { operator: 'ALL', operand: [] },
  ruleDefinition: [
    {
      type: ['entitlementGrant'],
      operator: 'OR',
      operand: [
        {
          operator: 'EQUALS',
          operand: {
            targetName: 'entitlement.displayName',
            targetValue: 'aicGroup1',
          },
        },
      ],
    },
    {
      type: ['entitlementGrant'],
      operator: 'AND',
      operand: [
        {
          operator: 'EQUALS',
          operand: {
            targetName: 'entitlement.displayName',
            targetValue: 'aicGroup2',
          },
        },
      ],
    },
  ],
  riskScore: 0,
  ruleDefinitionTags: [
    'targetName=entitlement.displayName&targetValue=aicGroup1',
    'targetValue=aicGroup1&targetName=entitlement.displayName',
    'targetName=entitlement.displayName&targetValue=aicGroup2',
    'targetValue=aicGroup2&targetName=entitlement.displayName',
  ],
};

export const Rule1: PolicyRuleSkeleton = {
  ...baseRule,
  name: 'frodo`-test-rule-create',
  id: 'b0000000-0000-0000-0000-000000000001',
};

export const Rule2: PolicyRuleSkeleton = {
  ...baseRule,
  name: 'frodo`-test-rule-existing',
  id: 'b0000000-0000-0000-0000-000000000002',
};

export const Rule3: PolicyRuleSkeleton = {
  ...baseRule,
  name: 'frodo`-test-rule-delete-by-id',
  id: 'b0000000-0000-0000-0000-000000000003',
};

export const Rule4: PolicyRuleSkeleton = {
  ...baseRule,
  name: 'frodo`-test-rule-delete-by-name',
  id: 'b0000000-0000-0000-0000-000000000004',
};

export async function stagePolicyRule(
  rule: PolicyRuleSkeleton,
  createNew = false
): Promise<void> {
  try {
    await IgaSodPolicyRuleOps.deletePolicyRuleByName({
      name: rule.name,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore — rule may not exist yet
  } finally {
    if (createNew) {
      await IgaSodPolicyRuleOps.createPolicyRule({
        policyRuleData: rule,
        state,
      });
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
      await stagePolicyRule(Rule1);
      await stagePolicyRule(Rule2, true);
      await stagePolicyRule(Rule3, true);
      await stagePolicyRule(Rule4, true);
    }
  });
  // in recording mode, clean up test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicyRule(Rule1);
      await stagePolicyRule(Rule2);
      await stagePolicyRule(Rule3);
      await stagePolicyRule(Rule4);
    }
  });
}
