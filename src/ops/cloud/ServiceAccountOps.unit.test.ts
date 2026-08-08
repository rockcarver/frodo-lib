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
