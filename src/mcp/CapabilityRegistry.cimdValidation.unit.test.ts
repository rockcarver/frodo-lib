/**
 * Unit test for the MCP capability of the offline validation of a CIMD profile.
 *
 * Run with:
 *
 *        npm run test:only CapabilityRegistry.cimdValidation
 *
 * Origin: frodo-lib#1020. `validateCIMDProfile` reads nothing from the tenant and changes nothing, so it is a low-risk,
 * non-mutating capability with a reviewed entry (record 0001), takes named arguments and is not realm-bound. The
 * `create` and `update` capabilities of the module stay high-risk writes.
 */
import { frodo } from '../lib/FrodoLib';
import { CAPABILITY_META } from './CapabilityMetadata';
import { buildCapabilityInventory } from './CapabilityRegistry';

const ID = 'oauth2oidc.cimd.validateCIMDProfile';

describe('the capability oauth2oidc.cimd.validateCIMDProfile', () => {
  const capabilities = buildCapabilityInventory(frodo, {
    includeUtils: false,
  });
  const capability = capabilities.find((candidate) => candidate.id === ID);

  test('1: it has a reviewed entry: special, not mutating, low risk', () => {
    expect(CAPABILITY_META[ID]).toMatchObject({
      operationType: 'special',
      objectType: 'CIMDProfile',
      argumentMode: 'named',
      mutating: false,
      riskClass: 'low',
    });
    expect(CAPABILITY_META[ID].notes).toContain(
      'reads nothing from the tenant and changes nothing'
    );
  });

  test('2: the inventory offers it with named arguments and the three parameters', () => {
    expect(capability).toBeDefined();
    expect(capability).toMatchObject({
      operationType: 'special',
      argumentMode: 'named',
      mutating: false,
      riskClass: 'low',
    });
    expect((capability?.parameters ?? []).map((p) => p.name)).toEqual([
      'profileData',
      'otherProfiles',
      'schema',
    ]);
  });

  test('3: the writes of the module are still high risk', () => {
    for (const id of [
      'oauth2oidc.cimd.createCIMDProfile',
      'oauth2oidc.cimd.updateCIMDProfile',
    ]) {
      expect(
        capabilities.find((candidate) => candidate.id === id)
      ).toMatchObject({ mutating: true, riskClass: 'high' });
    }
  });

  test('4: the facade method returns the findings of the function and makes no request', () => {
    const findings = frodo.oauth2oidc.cimd.validateCIMDProfile({
      cimdConfig: { cimdClientIdUrlPatterns: ['https://*/*'] },
    });
    expect(findings.map((finding) => finding.code)).toEqual([
      'PATTERN_WHOLE_HOST_WILDCARD',
    ]);
    expect(
      frodo.oauth2oidc.cimd.validateCIMDProfile({
        cimdConfig: { cimdClientIdUrlPatterns: ['https://a.invalid/x/*'] },
      })
    ).toEqual([]);
  });

  test('5: the facade method passes the other profiles and the schema on', () => {
    const mine = {
      cimdConfig: { cimdClientIdUrlPatterns: ['https://a.invalid/x/*'] },
      coreOAuth2ClientConfig: { status: 'Suspended' },
    };
    const others = [
      {
        _id: 'other',
        cimdConfig: { cimdClientIdUrlPatterns: ['https://a.invalid/*'] },
      },
    ];
    const schema = {
      type: 'object' as const,
      properties: {
        coreOAuth2ClientConfig: {
          properties: { status: { enum: ['Active', 'Suspended'] } },
        },
        cimdConfig: {
          properties: { cimdClientIdUrlPatterns: {} },
        },
      },
    };
    const codes = (findings: { code: string }[]) =>
      findings.map((finding) => finding.code);
    expect(codes(frodo.oauth2oidc.cimd.validateCIMDProfile(mine))).toEqual([
      'ENUM_VALUE',
    ]);
    expect(
      codes(frodo.oauth2oidc.cimd.validateCIMDProfile(mine, others))
    ).toEqual(['PATTERN_OVERLAPS_PROFILE', 'ENUM_VALUE']);
    expect(
      codes(frodo.oauth2oidc.cimd.validateCIMDProfile(mine, undefined, schema))
    ).toEqual([]);
  });
});
