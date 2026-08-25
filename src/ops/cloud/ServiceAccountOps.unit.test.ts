import { jest } from '@jest/globals';

const getManagedSystemObject = jest.fn(async () => ({
  _id: 'service-account-id',
  accountStatus: 'active',
  scopes: ['fr:am:*', 'fr:idm:*'],
  jwks: 'sensitive-jwks-value',
}));

jest.unstable_mockModule('../../api/ManagedSystemObjectApi', () => ({
  createManagedSystemObject: jest.fn(),
  getManagedSystemObject,
  // Real constant, not a stub: IdmConfigOps.ts (transitively imported via
  // FeatureOps -> Console -> State -> ... -> EmailTemplateOps) imports this
  // named export too, and an incomplete mock factory breaks the whole
  // module graph's ESM linking, not just this file's own imports.
  MANAGED_SYSTEM_OBJECT_TYPES: ['svcacct', 'teammember'],
}));
jest.unstable_mockModule('../AuthenticateOps', () => ({
  getFreshSaBearerToken: jest.fn(),
}));

const { getServiceAccount } = await import('./ServiceAccountOps');

describe('ServiceAccountOps debug output', () => {
  test('summarizes service accounts without logging the returned record', async () => {
    const debugHandler = jest.fn();
    const state = {
      getDebugHandler: () => debugHandler,
    } as any;

    await getServiceAccount({
      serviceAccountId: 'service-account-id',
      state,
    });

    expect(debugHandler).toHaveBeenCalledWith(
      'ServiceAccountOps.getServiceAccount: accountStatus=active, scopeCount=2'
    );
    const serializedMessages = JSON.stringify(debugHandler.mock.calls);
    expect(serializedMessages).not.toContain('sensitive-jwks-value');
    expect(serializedMessages).not.toContain('fr:am:*');
    expect(
      debugHandler.mock.calls.every(([message]) => typeof message === 'string')
    ).toBe(true);
  });
});
