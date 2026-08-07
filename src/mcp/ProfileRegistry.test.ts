/**
 * Verifies profile registry coverage and subtree mapping completeness.
 */

import { frodo, buildCapabilityInventory } from '../index';
import {
  capabilityMatchesAnyProfile,
  capabilityMatchesDisabled,
  getMcpProfileDefinition,
  listAllMcpProfiles,
  listMcpProfiles,
} from './ProfileRegistry';

describe('MCP profile registry', () => {
  test('derives all from the non-disabled profile universe', () => {
    const all = getMcpProfileDefinition('all');
    const visibleProfiles = listMcpProfiles();

    expect(all.derived).toBe(true);
    expect(all.includePathPrefixes).toBeDefined();
    expect(all.includePathPrefixes?.length).toBeGreaterThan(0);
    expect(visibleProfiles.map((profile) => profile.name)).toContain('all');
    expect(listAllMcpProfiles().map((profile) => profile.name)).toContain(
      'disabled'
    );
  });

  test('covers every discovered capability with a profile or disabled mapping', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeUtils: false,
    });

    const uncovered = capabilities
      .filter((capability) => !capabilityMatchesAnyProfile(capability))
      .filter((capability) => !capabilityMatchesDisabled(capability))
      .map((capability) => capability.id)
      .sort();

    expect(uncovered).toEqual([]);
  });
});
