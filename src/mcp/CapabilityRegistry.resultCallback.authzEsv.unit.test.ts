/**
 * A result callback is a JS function reference, which an MCP JSON payload can
 * never carry, so no capability offers it to an MCP caller (excludeParameters).
 * This pins that for the authorization, ESV and administration functions that
 * take one (the facade methods themselves are tested next to their ops module).
 */

import { frodo } from '../lib/FrodoLib';
import { CAPABILITY_META } from './CapabilityMetadata';
import { buildCapabilityInventory } from './CapabilityRegistry';

const WITH_RESULT_CALLBACK = [
  'authz.policy.exportPolicies',
  'authz.policy.exportPoliciesByPolicySet',
  'authz.policy.importPolicies',
  'authz.policySet.exportPolicySets',
  'authz.policySet.importPolicySets',
  'authz.resourceType.importResourceTypes',
  'cloud.adminFed.exportAdminFederationProviders',
  'cloud.adminFed.importAdminFederationProviders',
  'cloud.secret.importSecrets',
  'cloud.variable.importVariables',
  'server.exportServers',
  'server.importServers',
];

describe('functions with a result callback (authorization, ESV, administration)', () => {
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
    expect(parametersOf('authz.policy.exportPolicies')).toEqual(['options']);
    expect(parametersOf('authz.policy.exportPoliciesByPolicySet')).toEqual([
      'policySetName',
      'options',
    ]);
    expect(parametersOf('authz.policy.importPolicies')).toEqual([
      'importData',
      'options',
    ]);
    expect(parametersOf('authz.policySet.exportPolicySets')).toEqual([
      'options',
    ]);
    expect(parametersOf('authz.policySet.importPolicySets')).toEqual([
      'importData',
      'options',
    ]);
    expect(parametersOf('authz.resourceType.importResourceTypes')).toEqual([
      'importData',
    ]);
    expect(
      parametersOf('cloud.adminFed.exportAdminFederationProviders')
    ).toEqual([]);
    expect(
      parametersOf('cloud.adminFed.importAdminFederationProviders')
    ).toEqual(['importData']);
    expect(parametersOf('cloud.secret.importSecrets')).toEqual([
      'importData',
      'includeActiveValues',
      'source',
    ]);
    expect(parametersOf('cloud.variable.importVariables')).toEqual([
      'importData',
    ]);
    expect(parametersOf('server.exportServers')).toEqual(['options']);
    expect(parametersOf('server.importServers')).toEqual([
      'importData',
      'options',
      'serverId',
      'serverUrl',
    ]);
  });
});
