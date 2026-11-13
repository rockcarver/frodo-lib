/**
 * Unit test for the MCP metadata of the IDM feature diagnosis and repair.
 *
 * Run with:
 *
 *        npm run test:only CapabilityMetadata.idmFeature
 *
 * Origin: frodo-lib#1060. `planIdmFeatureRepair` changes nothing in the tenant, but its result holds the raw backup of the
 * tenant configuration (the whole managed and repo.ds configuration and the OAuth 2.0 providers), so it is not a low-risk
 * read. `repairIdmFeature` writes configuration.
 */
import { CAPABILITY_META } from './CapabilityMetadata';

describe('the MCP metadata of the IDM feature diagnosis and repair', () => {
  test('diagnoseIdmFeature is a low-risk read', () => {
    expect(
      CAPABILITY_META['cloud.idmFeature.diagnoseIdmFeature']
    ).toMatchObject({ mutating: false, riskClass: 'low' });
  });

  test('planIdmFeatureRepair does not write but is medium risk, and the note says what its result holds', () => {
    const meta = CAPABILITY_META['cloud.idmFeature.planIdmFeatureRepair'];
    expect(meta).toMatchObject({ mutating: false, riskClass: 'medium' });
    expect(meta.notes).toContain('raw backup of the tenant configuration');
    expect(meta.notes).toContain('handled like the configuration itself');
  });

  test('repairIdmFeature is a high-risk write', () => {
    expect(CAPABILITY_META['cloud.idmFeature.repairIdmFeature']).toMatchObject({
      mutating: true,
      riskClass: 'high',
    });
  });
});
