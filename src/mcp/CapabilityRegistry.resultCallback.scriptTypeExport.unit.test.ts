/**
 * A result callback is a JS function reference, which an MCP JSON payload can
 * never carry, so no capability offers it to an MCP caller (excludeParameters).
 * This pins that for the script type export that takes one (the facade method
 * itself is tested next to its ops module).
 */

import { frodo } from '../lib/FrodoLib';
import { CAPABILITY_META } from './CapabilityMetadata';
import { buildCapabilityInventory } from './CapabilityRegistry';

describe('scriptType.exportScriptTypes', () => {
  const capabilities = buildCapabilityInventory(frodo, { includeUtils: false });
  const capability = capabilities.find(
    (it) => it.id === 'scriptType.exportScriptTypes'
  );

  test('is a capability that does not advertise resultCallback', () => {
    expect(capability).toBeDefined();
    expect(
      CAPABILITY_META['scriptType.exportScriptTypes']?.excludeParameters
    ).toContain('resultCallback');
    expect(
      (capability?.parameters ?? []).map((parameter) => parameter.name)
    ).not.toContain('resultCallback');
  });

  test('has no parameter left for an MCP caller to send', () => {
    expect(capability?.parameters ?? []).toEqual([]);
  });
});
