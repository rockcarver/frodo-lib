import { type Saml2ProviderSkeleton } from '../api/Saml2Api';
import { getSaml2ProviderScriptReferences } from './Saml2Ops';

/**
 * The scripts a SAML entity provider refers to are the attribute mapper and
 * the IdP adapter script of an identity provider and the SP adapter script of
 * a service provider, except `[Empty]`. The export of the provider and the
 * references of an application use this one function.
 * Pure unit test: no recordings.
 */
describe('getSaml2ProviderScriptReferences', () => {
  test('returns the three scripts with the field that refers to them and a label', () => {
    const provider = {
      identityProvider: {
        assertionProcessing: {
          attributeMapper: { attributeMapperScript: 'script-map' },
        },
        advanced: { idpAdapter: { idpAdapterScript: 'script-idp' } },
      },
      serviceProvider: {
        assertionProcessing: { adapter: { spAdapterScript: 'script-sp' } },
      },
    } as unknown as Saml2ProviderSkeleton;
    expect(getSaml2ProviderScriptReferences(provider)).toEqual([
      {
        field:
          'identityProvider.assertionProcessing.attributeMapper.attributeMapperScript',
        label: 'attribute mapper script',
        scriptId: 'script-map',
      },
      {
        field: 'identityProvider.advanced.idpAdapter.idpAdapterScript',
        label: 'idp adapter script',
        scriptId: 'script-idp',
      },
      {
        field: 'serviceProvider.assertionProcessing.adapter.spAdapterScript',
        label: 'sp adapter script',
        scriptId: 'script-sp',
      },
    ]);
  });

  test('ignores [Empty] and fields that are not set', () => {
    const provider = {
      identityProvider: {
        assertionProcessing: {
          attributeMapper: { attributeMapperScript: '[Empty]' },
        },
        advanced: { idpAdapter: { idpAdapterScript: 'script-idp' } },
      },
    } as unknown as Saml2ProviderSkeleton;
    expect(
      getSaml2ProviderScriptReferences(provider).map((r) => r.scriptId)
    ).toEqual(['script-idp']);
  });

  test('returns nothing for a provider without scripts', () => {
    expect(
      getSaml2ProviderScriptReferences({} as Saml2ProviderSkeleton)
    ).toEqual([]);
  });
});
