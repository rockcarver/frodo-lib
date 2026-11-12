/**
 * A result callback is a JS function reference, which an MCP JSON payload can
 * never carry, so no capability offers it to an MCP caller (excludeParameters).
 * This pins that for the OAuth2 client, social identity provider and script
 * type imports that take one (the facade methods themselves are tested next to
 * their ops module).
 */

import { frodo } from '../lib/FrodoLib';
import { CAPABILITY_META } from './CapabilityMetadata';
import { buildCapabilityInventory } from './CapabilityRegistry';

const WITH_RESULT_CALLBACK = [
  'oauth2oidc.client.importOAuth2Clients',
  'oauth2oidc.external.importSocialIdentityProviders',
  'scriptType.importScriptTypes',
];

describe('functions with a result callback (OAuth2 clients, social providers, script types)', () => {
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
    expect(parametersOf('oauth2oidc.client.importOAuth2Clients')).toEqual([
      'importData',
      'options',
    ]);
    expect(
      parametersOf('oauth2oidc.external.importSocialIdentityProviders')
    ).toEqual(['importData', 'options']);
    expect(parametersOf('scriptType.importScriptTypes')).toEqual([
      'importData',
      'scriptTypeId',
    ]);
  });
});
