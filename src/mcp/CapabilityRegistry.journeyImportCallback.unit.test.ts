/**
 * `importJourneys` takes a result callback, a JS function that an MCP JSON payload can never carry. The capability
 * descriptor must not offer it to MCP callers, as for `exportJourneys`, `validateJourneys` and `removeOrphanedNodes`
 * (frodo-lib#957).
 */
import { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from './CapabilityRegistry';

describe('the capability descriptors of the journey bulk operations', () => {
  const capabilities = buildCapabilityInventory(frodo, { includeUtils: false });
  const parametersOf = (id: string): string[] => {
    const capability = capabilities.find((candidate) => candidate.id === id);
    expect(capability).toBeDefined();
    return (capability?.parameters ?? []).map((parameter) => parameter.name);
  };

  test('importJourneys does not offer the result callback, and keeps its other parameters', () => {
    expect(parametersOf('authn.journey.importJourneys')).toEqual([
      'importData',
      'options',
    ]);
  });

  test.each([
    'authn.journey.exportJourneys',
    'authn.journey.validateJourneys',
    'authn.node.removeOrphanedNodes',
  ])('%s does not offer the result callback either', (id) => {
    expect(parametersOf(id)).not.toContain('resultCallback');
  });
});
