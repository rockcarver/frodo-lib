import { frodo } from '../lib/FrodoLib';
import { getHelpMetadataByMethod } from '../utils/HelpUtils';
import { buildCapabilityInventory } from './CapabilityRegistry';

/**
 * The result callback of a bulk import or export is a JS function reference that
 * an MCP JSON payload can never carry: the capability does not offer it to MCP
 * callers, although the facade method takes it as its last parameter.
 * Unit test: no recordings, no tenant.
 */

/** [capability id, the path of the facade module, the name of the facade method] */
const BULK_CALLBACK_CAPABILITIES: [string, string[], string][] = [
  ['agent.importAgents', ['agent'], 'importAgents'],
  [
    'agent.importIdentityGatewayAgents',
    ['agent'],
    'importIdentityGatewayAgents',
  ],
  ['agent.importJavaAgents', ['agent'], 'importJavaAgents'],
  ['agent.importWebAgents', ['agent'], 'importWebAgents'],
  ['agent.importAIAgents', ['agent'], 'importAIAgents'],
  [
    'saml2.entityProvider.exportSaml2Providers',
    ['saml2', 'entityProvider'],
    'exportSaml2Providers',
  ],
  [
    'saml2.entityProvider.importSaml2Providers',
    ['saml2', 'entityProvider'],
    'importSaml2Providers',
  ],
  [
    'saml2.circlesOfTrust.importCirclesOfTrust',
    ['saml2', 'circlesOfTrust'],
    'importCirclesOfTrust',
  ],
  [
    'oauth2oidc.external.exportSocialIdentityProviders',
    ['oauth2oidc', 'external'],
    'exportSocialIdentityProviders',
  ],
  [
    'oauth2oidc.client.exportOAuth2Clients',
    ['oauth2oidc', 'client'],
    'exportOAuth2Clients',
  ],
  ['service.importServices', ['service'], 'importServices'],
  ['service.exportServices', ['service'], 'exportServices'],
  ['service.getFullServices', ['service'], 'getFullServices'],
  ['agent.deleteAgents', ['agent'], 'deleteAgents'],
  [
    'agent.deleteIdentityGatewayAgents',
    ['agent'],
    'deleteIdentityGatewayAgents',
  ],
  ['agent.deleteJavaAgents', ['agent'], 'deleteJavaAgents'],
  ['agent.deleteWebAgents', ['agent'], 'deleteWebAgents'],
  ['agent.deleteAIAgents', ['agent'], 'deleteAIAgents'],
  ['app.exportApplications', ['app'], 'exportApplications'],
];

describe('the result callback of the bulk imports and exports', () => {
  const inventory = buildCapabilityInventory(frodo, {
    includeUtils: false,
  } as any);

  test.each(BULK_CALLBACK_CAPABILITIES)(
    '%s does not offer it to MCP callers',
    (id, path, methodName) => {
      const capability = inventory.find((entry) => entry.id === id);
      let node: any = frodo;
      for (const segment of path) node = node[segment];

      expect(capability).toBeDefined();
      expect(typeof node[methodName]).toBe('function');
      // the facade method documents it, as its last parameter
      const documented = getHelpMetadataByMethod(methodName).some((doc) =>
        doc.params.some((param) => param.name === 'resultCallback')
      );
      expect(documented).toBe(true);
      // and the capability does not offer it
      expect((capability.parameters ?? []).map((p) => p.name)).not.toContain(
        'resultCallback'
      );
    }
  );
});
