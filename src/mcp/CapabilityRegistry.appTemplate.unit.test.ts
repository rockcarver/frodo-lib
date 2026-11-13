import { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from './CapabilityRegistry';

describe('MCP capabilities of frodo.app.template', () => {
  const ids = buildCapabilityInventory(frodo, {
    includeTopLevelDomains: ['app'],
    includeUtils: false,
  }).map((capability) => capability.id);

  test('1: the whole catalog is not a tool: it is far too large for a tool result', () => {
    expect(ids).not.toContain('app.template.readCatalog');
  });

  test('2: the questions an agent has about templates are tools', () => {
    expect(ids).toEqual(
      expect.arrayContaining([
        'app.template.listTemplates',
        'app.template.readOverrides',
        'app.template.readTemplate',
      ])
    );
  });

  test('3: the other application tools are still there', () => {
    expect(ids).toEqual(
      expect.arrayContaining([
        'app.queryApplications',
        'app.validateApplication',
      ])
    );
  });
});
