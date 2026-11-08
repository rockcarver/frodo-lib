import { getOAuth2ClientScriptReferences } from './OAuth2ClientOps';

/**
 * The scripts an OAuth2 client refers to are the values of the keys ending in
 * `Script` in `overrideOAuth2ClientConfig`, except `[Empty]`. The export of
 * the client and the references of an application use this one function.
 * Pure unit test: no recordings.
 */
describe('getOAuth2ClientScriptReferences', () => {
  test('returns the key and the script id of every key that ends in Script', () => {
    expect(
      getOAuth2ClientScriptReferences({
        _id: 'web-client',
        overrideOAuth2ClientConfig: {
          accessTokenModificationScript: 'script-1',
          validateScopesScript: 'script-2',
          issueRefreshToken: true,
        },
      })
    ).toEqual([
      { key: 'accessTokenModificationScript', scriptId: 'script-1' },
      { key: 'validateScopesScript', scriptId: 'script-2' },
    ]);
  });

  test('ignores [Empty]', () => {
    expect(
      getOAuth2ClientScriptReferences({
        overrideOAuth2ClientConfig: {
          accessTokenModificationScript: '[Empty]',
          oidcClaimsScript: 'script-3',
        },
      })
    ).toEqual([{ key: 'oidcClaimsScript', scriptId: 'script-3' }]);
  });

  test.each([
    ['no override config', { _id: 'web-client' }],
    ['an empty override config', { overrideOAuth2ClientConfig: {} }],
    ['null', null],
    ['undefined', undefined],
  ])('returns nothing for %s', (_label, client) => {
    expect(getOAuth2ClientScriptReferences(client)).toEqual([]);
  });
});
