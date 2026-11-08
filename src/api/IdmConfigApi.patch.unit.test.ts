import { jest } from '@jest/globals';

/**
 * `patchConfigEntity` sends a JSON patch to a config entity and can wait for
 * IDM to have consumed the change (`waitForCompletion=true`), the way the
 * Admin UI switches a connector on or off. `getConfigEntitiesByType` can limit
 * the fields it returns; without them its request is unchanged.
 * Mocked unit test: no recordings.
 */

const get = jest.fn(async (_url?: any): Promise<any> => ({ data: {} }));
const patch = jest.fn(async (_url?: any, _body?: any): Promise<any> => ({
  data: {},
}));
const generateIdmApi = jest.fn((_args?: any) => ({ get, patch }));

jest.unstable_mockModule('./BaseApi', () => ({ generateIdmApi }));
jest.unstable_mockModule('../utils/ForgeRockUtils', () => ({
  getIdmBaseUrl: jest.fn(() => 'https://idm.example.com/openidm'),
}));
jest.unstable_mockModule('../ops/EmailTemplateOps', () => ({
  EMAIL_TEMPLATE_TYPE: 'emailTemplate',
}));

const { getConfigEntitiesByType, patchConfigEntity } =
  await import('./IdmConfigApi');

const state = {} as any;
const operations = [
  { operation: 'replace' as const, field: '/enabled', value: false },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('patchConfigEntity', () => {
  test('patches the entity and waits for completion when asked to', async () => {
    patch.mockResolvedValueOnce({
      data: { _id: 'provisioner.openicf/ldap', enabled: false },
    });
    const result = await patchConfigEntity({
      entityId: 'provisioner.openicf/ldap',
      operations,
      wait: true,
      state,
    });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(
      'https://idm.example.com/openidm/config/provisioner.openicf/ldap?waitForCompletion=true',
      [{ operation: 'replace', field: '/enabled', value: false }]
    );
    expect(result).toEqual({
      _id: 'provisioner.openicf/ldap',
      enabled: false,
    });
  });

  test('does not wait unless asked to', async () => {
    await patchConfigEntity({
      entityId: 'provisioner.openicf/ldap',
      operations,
      state,
    });
    expect(patch).toHaveBeenCalledWith(
      'https://idm.example.com/openidm/config/provisioner.openicf/ldap',
      operations
    );
  });

  test('asks for the IDM scope', async () => {
    await patchConfigEntity({
      entityId: 'provisioner.openicf/ldap',
      operations,
      state,
    });
    const { requiredScopes } = generateIdmApi.mock.calls[0][0] as any;
    expect(requiredScopes).toHaveLength(1);
  });
});

describe('getConfigEntitiesByType', () => {
  test('keeps its request when no fields are given', async () => {
    await getConfigEntitiesByType({ type: 'provisioner.openicf', state });
    expect(get).toHaveBeenCalledWith(
      `https://idm.example.com/openidm/config?_queryFilter=${encodeURIComponent("_id sw 'provisioner.openicf'")}`
    );
  });

  test('limits the returned fields when given', async () => {
    await getConfigEntitiesByType({
      type: 'provisioner.openicf',
      fields: ['enabled'],
      state,
    });
    expect(get).toHaveBeenCalledWith(
      `https://idm.example.com/openidm/config?_queryFilter=${encodeURIComponent("_id sw 'provisioner.openicf'")}&_fields=enabled`
    );
  });

  test('joins several fields with a comma', async () => {
    await getConfigEntitiesByType({
      type: 'provisioner.openicf',
      fields: ['enabled', 'connectorRef'],
      state,
    });
    expect(
      (get.mock.calls[0][0] as string).endsWith('&_fields=enabled,connectorRef')
    ).toBe(true);
  });
});
