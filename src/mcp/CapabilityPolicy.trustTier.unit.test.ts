/**
 * Run tests
 *
 *        npm run test:only CapabilityPolicy.trustTier
 *
 * Regression coverage for Phase G's trust-tier policy filtering:
 * applyCapabilityPolicy()'s new allowTrustTiers/denyTrustTiers gates, and
 * the self-service profile that statically pre-filters full-trust-only
 * capabilities out via resolveMcpProfileSelection().
 */
import { McpCapabilityDescriptor } from './CapabilityTypes';
import { applyCapabilityPolicy } from './CapabilityPolicy';
import { resolveMcpProfileSelection } from './ProfileRegistry';

function makeDescriptor(
  overrides: Partial<McpCapabilityDescriptor> = {}
): McpCapabilityDescriptor {
  return {
    id: 'authn.journey.readJourney',
    toolName: 'frodo.authn.journey.readJourney',
    methodName: 'readJourney',
    modulePath: ['authn', 'journey'],
    domain: 'authn',
    objectType: 'Journey',
    operationType: 'read',
    kind: 'generic',
    riskClass: 'low',
    mutating: false,
    destructive: false,
    deploymentTypes: ['any'],
    trustTier: 'full-trust',
    requiredScopes: [],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    ...overrides,
  };
}

describe('applyCapabilityPolicy — trust tier filtering', () => {
  const fullTrust = makeDescriptor({
    id: 'a.fullTrust',
    trustTier: 'full-trust',
  });
  const delegated = makeDescriptor({ id: 'b.delegated', trustTier: 'delegated' });
  const both = makeDescriptor({ id: 'c.both', trustTier: 'both' });

  test('denyTrustTiers excludes only the denied tier', () => {
    const result = applyCapabilityPolicy([fullTrust, delegated, both], {
      name: 'test',
      denyTrustTiers: ['full-trust'],
    });
    expect(result.map((d) => d.id)).toEqual(['b.delegated', 'c.both']);
  });

  test('allowTrustTiers keeps only the allowed tiers', () => {
    const result = applyCapabilityPolicy([fullTrust, delegated, both], {
      name: 'test',
      allowTrustTiers: ['delegated', 'both'],
    });
    expect(result.map((d) => d.id)).toEqual(['b.delegated', 'c.both']);
  });

  test('with neither set, every tier passes through unaffected', () => {
    const result = applyCapabilityPolicy([fullTrust, delegated, both], {
      name: 'test',
    });
    expect(result).toHaveLength(3);
  });
});

describe('self-service profile', () => {
  test('resolves a policyOverride that denies the full-trust tier', () => {
    const selection = resolveMcpProfileSelection('self-service');
    expect(selection.policyOverride?.denyTrustTiers).toEqual(['full-trust']);
  });

  test('is visible in the user-facing profile list', () => {
    const selection = resolveMcpProfileSelection('self-service');
    expect(selection.profile.hidden).not.toBe(true);
  });
});
