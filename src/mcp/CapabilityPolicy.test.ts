/**
 * Regression coverage for the special-kind gating bug: every built-in preset's
 * `includeSpecial` flag must independently govern `kind: 'special'` capabilities,
 * without being silently overridden by an `allowOperationTypes` list that was
 * never written with `'special'` in mind. `agentic` and `standard` previously
 * declared `includeSpecial: true` while excluding every special capability
 * anyway, because `applyCapabilityPolicy` checked both gates unconditionally.
 */

import { frodo, buildCapabilityInventory } from '../index';
import { applyCapabilityPolicy, MCP_POLICY_PRESETS } from './CapabilityPolicy';

describe('special-kind capability policy gating', () => {
  // utils/factory are excluded at the profile layer, independent of this bug;
  // scoping them out here keeps the assertions focused on the gate under test.
  const inventory = buildCapabilityInventory(frodo, {
    excludeTopLevelDomains: ['utils', 'factory'],
  });
  const specialCapabilities = inventory.filter((c) => c.kind === 'special');

  test('the fixture actually contains special-kind capabilities to exercise', () => {
    expect(specialCapabilities.length).toBeGreaterThan(0);
  });

  test("read-only excludes every special capability, per its includeSpecial: false", () => {
    const filtered = applyCapabilityPolicy(
      specialCapabilities,
      MCP_POLICY_PRESETS['read-only']
    );
    expect(filtered).toEqual([]);
  });

  test('admin includes every special capability, with no operation-type or risk restriction', () => {
    const filtered = applyCapabilityPolicy(
      specialCapabilities,
      MCP_POLICY_PRESETS.admin
    );
    expect(filtered.map((c) => c.id).sort()).toEqual(
      specialCapabilities.map((c) => c.id).sort()
    );
  });

  test.each(['agentic', 'standard'] as const)(
    "%s's includeSpecial: true actually includes special capabilities, gated only by denyRiskClasses",
    (presetName) => {
      const preset = MCP_POLICY_PRESETS[presetName];
      const filtered = applyCapabilityPolicy(specialCapabilities, preset);

      // This is the core regression assertion: under the original bug, this list
      // was always empty for every preset except admin, because 'special' never
      // appeared in allowOperationTypes regardless of includeSpecial.
      expect(filtered.length).toBeGreaterThan(0);

      const expectedIds = specialCapabilities
        .filter(
          (c) => !preset.denyRiskClasses?.includes(c.riskClass)
        )
        .map((c) => c.id)
        .sort();
      expect(filtered.map((c) => c.id).sort()).toEqual(expectedIds);
    }
  );

  test('every built-in preset with includeSpecial !== false surfaces at least every low-risk special capability', () => {
    const lowRiskIds = specialCapabilities
      .filter((c) => c.riskClass === 'low')
      .map((c) => c.id)
      .sort();

    for (const preset of Object.values(MCP_POLICY_PRESETS)) {
      const filtered = applyCapabilityPolicy(specialCapabilities, preset);
      const survivingLowRiskIds = filtered
        .filter((c) => c.riskClass === 'low')
        .map((c) => c.id)
        .sort();

      if (preset.includeSpecial === false) {
        expect(survivingLowRiskIds).toEqual([]);
      } else {
        expect(survivingLowRiskIds).toEqual(lowRiskIds);
      }
    }
  });
});
