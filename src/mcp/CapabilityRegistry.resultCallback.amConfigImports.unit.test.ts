/**
 * A result callback is a JS function reference, which an MCP JSON payload can
 * never carry, so no capability offers it to an MCP caller (excludeParameters).
 * This pins that for the agent group, connector, realm and site imports that
 * take one (the facade methods themselves are tested next to their ops module).
 */

import { frodo } from '../lib/FrodoLib';
import { CAPABILITY_META } from './CapabilityMetadata';
import { buildCapabilityInventory } from './CapabilityRegistry';

const WITH_RESULT_CALLBACK = [
  'agent.importAgentGroups',
  'idm.connector.importConnectors',
  'realm.importRealms',
  'site.importSites',
];

describe('functions with a result callback (agent groups, connectors, realms, sites)', () => {
  const capabilities = buildCapabilityInventory(frodo, { includeUtils: false });
  const parametersOf = (id: string) =>
    (capabilities.find((it) => it.id === id)?.parameters ?? []).map(
      (parameter) => parameter.name
    );

  test.each(WITH_RESULT_CALLBACK)(
    '%s is a capability that does not advertise resultCallback',
    (id) => {
      const capability = capabilities.find((it) => it.id === id);

      expect(capability).toBeDefined();
      expect(CAPABILITY_META[id]?.excludeParameters).toContain(
        'resultCallback'
      );
      expect(parametersOf(id)).not.toContain('resultCallback');
    }
  );

  test('the parameters that remain are the ones an MCP caller can send', () => {
    expect(parametersOf('agent.importAgentGroups')).toEqual(['importData']);
    expect(parametersOf('idm.connector.importConnectors')).toEqual([
      'importData',
      'options',
    ]);
    expect(parametersOf('realm.importRealms')).toEqual([
      'importData',
      'realmId',
      'realmName',
    ]);
    expect(parametersOf('site.importSites')).toEqual([
      'importData',
      'siteId',
      'siteUrl',
    ]);
  });
});
