/**
 * A result callback is a JS function reference, which an MCP JSON payload can
 * never carry, so no capability offers it to an MCP caller (excludeParameters).
 * This pins that for the IDM and configuration functions that take one (the
 * facade methods themselves are tested next to their ops module).
 */

import { frodo } from '../lib/FrodoLib';
import { CAPABILITY_META } from './CapabilityMetadata';
import { buildCapabilityInventory } from './CapabilityRegistry';

const WITH_RESULT_CALLBACK = [
  'idm.mapping.importMappings',
  'idm.mapping.deleteMappings',
  'idm.remoteProxy.importRemoteProxies',
  'email.template.importEmailTemplates',
];

describe('functions with a result callback', () => {
  const capabilities = buildCapabilityInventory(frodo, { includeUtils: false });

  test.each(WITH_RESULT_CALLBACK)(
    '%s is a capability that does not advertise resultCallback',
    (id) => {
      const capability = capabilities.find((it) => it.id === id);

      expect(capability).toBeDefined();
      expect(CAPABILITY_META[id]?.excludeParameters).toContain(
        'resultCallback'
      );
      expect(
        (capability?.parameters ?? []).map((parameter) => parameter.name)
      ).not.toContain('resultCallback');
    }
  );

  test('the parameters that remain are the ones an MCP caller can send', () => {
    const parametersOf = (id: string) =>
      (capabilities.find((it) => it.id === id)?.parameters ?? []).map(
        (parameter) => parameter.name
      );

    expect(parametersOf('idm.mapping.importMappings')).toEqual([
      'importData',
      'options',
    ]);
    expect(parametersOf('idm.mapping.deleteMappings')).toEqual([
      'connectorId',
      'moType',
    ]);
    expect(parametersOf('idm.remoteProxy.importRemoteProxies')).toEqual([
      'importData',
    ]);
    expect(parametersOf('email.template.importEmailTemplates')).toEqual([
      'importData',
    ]);
  });
});
