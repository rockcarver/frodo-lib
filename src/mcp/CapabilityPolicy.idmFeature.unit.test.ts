/**
 * Which capabilities of the IDM feature diagnosis and repair each built-in policy preset offers.
 *
 * Run with:
 *
 *        npm run test:only CapabilityPolicy.idmFeature
 *
 * Origin: frodo-lib#1060. `repairIdmFeature` writes the whole managed and repo.ds configuration, deletes secret store
 * mappings, writes OAuth 2.0 providers and runs the enable action of the environment. It is `critical` and
 * `destructive`, so the `agentic` and `standard` presets (which deny only `critical` risk and include special
 * capabilities) do not offer it and only `admin` does. As `high` it was offered by both. This test pins the decision:
 * a change of the class makes it fail. No tenant is needed.
 */
import { frodo } from '../lib/FrodoLib';
import { applyCapabilityPolicy, MCP_POLICY_PRESETS } from './CapabilityPolicy';
import { buildCapabilityInventory } from './CapabilityRegistry';

const DIAGNOSE = 'cloud.idmFeature.diagnoseIdmFeature';
const PLAN = 'cloud.idmFeature.planIdmFeatureRepair';
const REPAIR = 'cloud.idmFeature.repairIdmFeature';
const INSTALL = 'cloud.idmFeature.installIdmFeature';
const ALL = [DIAGNOSE, PLAN, REPAIR, INSTALL];

describe('the IDM feature capabilities under the policy presets', () => {
  const inventory = buildCapabilityInventory(frodo, {
    includeTopLevelDomains: ['cloud'],
    includeUtils: false,
  });
  const ours = inventory.filter((capability) => ALL.includes(capability.id));
  const offered = (preset: keyof typeof MCP_POLICY_PRESETS) =>
    applyCapabilityPolicy(ours, MCP_POLICY_PRESETS[preset])
      .map((capability) => capability.id)
      .sort();

  test('the fixture holds all four capabilities, as special ones', () => {
    expect(ours.map((capability) => capability.id).sort()).toEqual(
      [...ALL].sort()
    );
    expect(ours.every((capability) => capability.kind === 'special')).toBe(
      true
    );
  });

  test('read-only offers none of them: it includes no special capability', () => {
    expect(offered('read-only')).toEqual([]);
  });

  test.each(['agentic', 'standard'] as const)(
    '%s offers the diagnosis and the plan, and neither the repair nor the feature install',
    (preset) => {
      expect(offered(preset)).toEqual([DIAGNOSE, PLAN].sort());
    }
  );

  test('admin offers all four', () => {
    expect(offered('admin')).toEqual([...ALL].sort());
  });

  describe('what a client is told about each', () => {
    const byId = (id: string) =>
      ours.find((capability) => capability.id === id)!;

    test('diagnoseIdmFeature is a low-risk read', () => {
      expect(byId(DIAGNOSE)).toMatchObject({
        riskClass: 'low',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
        },
      });
    });

    test('planIdmFeatureRepair does not write but is medium risk: its result holds the raw backup', () => {
      expect(byId(PLAN)).toMatchObject({
        riskClass: 'medium',
        annotations: { readOnlyHint: true, destructiveHint: false },
      });
    });

    test('repairIdmFeature is critical and destructive, a write that is neither read-only nor idempotent', () => {
      const repair = byId(REPAIR);
      expect(repair.riskClass).toBe('critical');
      expect(repair.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      });
    });

    test('the note of repairIdmFeature says who offers it and why', () => {
      const notes = byId(REPAIR).notes ?? '';
      expect(notes).toContain('agentic and standard policies deny it');
      expect(notes).toContain('only the admin preset offers it');
      expect(notes).toContain('whole-object PUTs');
      expect(notes).toContain('deletes mappings');
    });
  });
});

/**
 * Origin: frodo-lib#1100. `canDiagnoseIdmFeature` and `listDiagnosableIdmFeatures` answer from the library's own
 * registry, with no request and no login. What a client is told about them has to say so: low risk, read-only,
 * nothing destructive. The metadata is reviewed by a person (decisions/0001); this test pins what it says.
 */
describe('the capabilities that say which features the library can diagnose', () => {
  const CAN = 'cloud.idmFeature.canDiagnoseIdmFeature';
  const LIST = 'cloud.idmFeature.listDiagnosableIdmFeatures';
  const inventory = buildCapabilityInventory(frodo, {
    includeTopLevelDomains: ['cloud'],
    includeUtils: false,
  });
  const byId = (id: string) =>
    inventory.find((capability) => capability.id === id)!;
  const offered = (preset: keyof typeof MCP_POLICY_PRESETS) =>
    applyCapabilityPolicy(
      inventory.filter((capability) => [CAN, LIST].includes(capability.id)),
      MCP_POLICY_PRESETS[preset]
    )
      .map((capability) => capability.id)
      .sort();

  test('both are in the inventory', () => {
    expect(byId(CAN)).toBeDefined();
    expect(byId(LIST)).toBeDefined();
  });

  test.each([CAN, LIST])('%s is a low-risk read that changes nothing', (id) => {
    expect(byId(id)).toMatchObject({
      riskClass: 'low',
      annotations: { readOnlyHint: true, destructiveHint: false },
    });
  });

  test('canDiagnoseIdmFeature is a special capability, the list an ordinary list operation', () => {
    expect(byId(CAN).kind).toBe('special');
    expect(byId(LIST)).toMatchObject({
      kind: 'generic',
      operationType: 'list',
    });
  });

  test('every preset offers the list, and every preset but read-only offers canDiagnoseIdmFeature too', () => {
    expect(offered('read-only')).toEqual([LIST]);
    for (const preset of ['agentic', 'standard', 'admin'] as const) {
      expect(offered(preset)).toEqual([CAN, LIST].sort());
    }
  });
});
