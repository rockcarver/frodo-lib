/**
 * Verifies that the manifest builder correctly collapses a capability inventory
 * into the reduced MCP tool surface.
 *
 * @remarks
 * Tests focus on structural correctness (tool counts, shape, property values)
 * and the policy-transparent ceiling guarantee that ensures agent usability.
 * Integration with live Frodo inventory is intentionally lightweight — the
 * `authn` and `idm` domains are used as representative domains rather than
 * the full library surface.
 */

import {
  MCP_POLICY_PRESETS,
  McpToolManifest,
  applyCapabilityPolicy,
  buildCapabilityInventory,
  buildToolManifest,
  frodo,
} from '../index';

describe('MCP tool manifest builder', () => {
  test('produces a valid manifest shape from a domain inventory', () => {
    const inventory = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
    });
    const manifest: McpToolManifest = buildToolManifest(inventory);

    expect(manifest.backingDescriptorCount).toBe(inventory.length);
    expect(manifest.totalToolCount).toBe(
      manifest.genericTools.length + manifest.specialTools.length + 1
    );
    expect(manifest.discoveryTool.toolName).toBe('frodo_discover');
  });

  test('every generic tool has at least one supported object type', () => {
    const inventory = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
    });
    const manifest = buildToolManifest(inventory);

    for (const tool of manifest.genericTools) {
      expect(tool.supportedObjectTypes.length).toBeGreaterThan(0);
    }
  });

  test('generic tool names follow the frodo_<operationType> convention', () => {
    const inventory = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
    });
    const manifest = buildToolManifest(inventory);

    for (const tool of manifest.genericTools) {
      expect(tool.toolName).toBe(`frodo_${tool.operationType}`);
    }
  });

  test('read-only policy restricts generic tools to read/list/search', () => {
    const inventory = applyCapabilityPolicy(
      buildCapabilityInventory(frodo, { includeTopLevelDomains: ['authn'] }),
      MCP_POLICY_PRESETS['read-only']
    );
    const manifest = buildToolManifest(inventory);

    const ops = manifest.genericTools.map((t) => t.operationType);
    expect(ops.every((op) => ['read', 'list', 'search'].includes(op))).toBe(
      true
    );
  });

  test('discovery tool lists all domains present in generic tools', () => {
    const inventory = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
    });
    const manifest = buildToolManifest(inventory);

    const genericDomains = new Set(
      manifest.genericTools.flatMap((t) =>
        t.supportedObjectTypes.map((e) => e.domain)
      )
    );
    for (const domain of genericDomains) {
      expect(manifest.discoveryTool.domains).toContain(domain);
    }
  });

  test('discovery tool operationsByType entries match generic tools', () => {
    const inventory = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
    });
    const manifest = buildToolManifest(inventory);

    for (const tool of manifest.genericTools) {
      expect(
        manifest.discoveryTool.operationsByType[tool.operationType]
      ).toBeDefined();
    }
  });

  test('read-only manifest total tool count stays within agent-usability ceiling', () => {
    const inventory = applyCapabilityPolicy(
      buildCapabilityInventory(frodo),
      MCP_POLICY_PRESETS['read-only']
    );
    const manifest = buildToolManifest(inventory);

    // Plan target: ≤40 tools for the reduced default surface.
    expect(manifest.totalToolCount).toBeLessThanOrEqual(40);
  });

  test('admin manifest exposes more tools than read-only manifest', () => {
    const readOnlyManifest = buildToolManifest(
      applyCapabilityPolicy(
        buildCapabilityInventory(frodo),
        MCP_POLICY_PRESETS['read-only']
      )
    );
    const adminManifest = buildToolManifest(
      applyCapabilityPolicy(
        buildCapabilityInventory(frodo),
        MCP_POLICY_PRESETS['admin']
      )
    );

    // Admin includes special tools and all operation types; it will always exceed read-only.
    expect(adminManifest.totalToolCount).toBeGreaterThan(
      readOnlyManifest.totalToolCount
    );
  });

  test('annotations are conservatively merged on generic tools', () => {
    const inventory = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
    });
    const manifest = buildToolManifest(inventory);

    for (const tool of manifest.genericTools) {
      // openWorldHint is always false.
      expect(tool.annotations.openWorldHint).toBe(false);

      // readOnlyHint must match conservative union of backed descriptors.
      const expectedReadOnly = tool.supportedObjectTypes.every(
        (e) => e.annotations.readOnlyHint
      );
      expect(tool.annotations.readOnlyHint).toBe(expectedReadOnly);
    }
  });

  test('empty inventory produces a manifest with only the discovery tool', () => {
    const manifest = buildToolManifest([]);

    expect(manifest.genericTools).toHaveLength(0);
    expect(manifest.specialTools).toHaveLength(0);
    expect(manifest.totalToolCount).toBe(1);
    expect(manifest.backingDescriptorCount).toBe(0);
    expect(manifest.discoveryTool.domains).toHaveLength(0);
  });
});
