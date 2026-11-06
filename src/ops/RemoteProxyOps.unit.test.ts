import { jest } from '@jest/globals';

const getConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const putConfigEntity = jest.fn(
  async (args?: any): Promise<any> => args.entityData
);
const deleteConfigEntity = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.entityId,
}));

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntity,
  putConfigEntity,
  deleteConfigEntity,
}));

const readConfigEntitiesByType = jest.fn(
  async (_args?: any): Promise<any[]> => []
);

jest.unstable_mockModule('./IdmConfigOps', () => ({
  readConfigEntitiesByType,
}));

jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  getMetadata: () => ({ origin: 'unit-test' }),
}));

jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(() => 'indicator'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

jest.unstable_mockModule('../utils/ForgeRockUtils', () => ({
  getHostOnlyUrl: (url: string) => {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  },
}));

const RemoteProxyOps = await import('./RemoteProxyOps');
const { default: createRemoteProxyOps } = RemoteProxyOps;

const state = {} as any;

function notFound() {
  const error: any = new Error('Not Found');
  error.response = { status: 404 };
  error.isAxiosError = true;
  return error;
}

const bearer = {
  enabled: true,
  authType: 'bearer',
  instanceUrl: 'https://receiving.example.com/openidm/',
  clientId: 'idmprovisioning',
  clientSecret: '&{esv.idmprovisioning.client.secret}',
  scope: ['fr:idm:*'],
  tokenEndpoint:
    'https://receiving.example.com/am/oauth2/realms/root/realms/alpha/access_token',
  tokenEndpointAuthMethod: 'client_secret_post',
  scopeDelimiter: ' ',
} as any;

const basic = {
  enabled: true,
  authType: 'basic',
  instanceUrl: 'https://receiving.example.com/openidm/',
  userName: 'proxy-user',
  password: '&{esv.proxy.user.password}',
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  getConfigEntity.mockResolvedValue({});
  readConfigEntitiesByType.mockResolvedValue([]);
});

describe('RemoteProxyOps ids', () => {
  it('reads and writes the entity external.idm/<name>', async () => {
    getConfigEntity.mockResolvedValue({ _id: 'external.idm/a', ...bearer });
    await RemoteProxyOps.readRemoteProxy({ proxyId: 'a', state });
    expect(getConfigEntity).toHaveBeenCalledWith({
      entityId: 'external.idm/a',
      state,
    });
    await RemoteProxyOps.updateRemoteProxy({
      proxyId: 'a',
      proxyData: bearer,
      state,
    });
    expect(putConfigEntity).toHaveBeenCalledWith({
      entityId: 'external.idm/a',
      entityData: bearer,
      state,
    });
    await RemoteProxyOps.deleteRemoteProxy({ proxyId: 'a', state });
    expect(deleteConfigEntity).toHaveBeenCalledWith({
      entityId: 'external.idm/a',
      state,
    });
  });

  it('lists the proxies by the prefix external.idm/ and returns an empty list for none', async () => {
    expect(await RemoteProxyOps.readRemoteProxies({ state })).toEqual([]);
    expect(readConfigEntitiesByType).toHaveBeenCalledWith({
      type: 'external.idm/',
      state,
    });
  });

  it('is reachable through the factory under the public type', async () => {
    const ops = createRemoteProxyOps(state);
    expect(ops.REMOTE_PROXY_TYPE).toBe('external.idm');
    getConfigEntity.mockResolvedValue({ _id: 'external.idm/b' });
    expect(await ops.readRemoteProxy('b')).toEqual({ _id: 'external.idm/b' });
  });
});

describe('RemoteProxyOps base url', () => {
  it('is the IDM base url below the remote proxy endpoint of the host', () => {
    const hostState = {
      getHost: () => 'https://openam-sending.example.com/am',
    } as any;
    expect(
      RemoteProxyOps.getRemoteProxyBaseUrl({
        proxyId: 'receiving',
        state: hostState,
      })
    ).toBe('https://openam-sending.example.com/openidm/external/idm/receiving');
    expect(
      createRemoteProxyOps(hostState).getRemoteProxyBaseUrl('receiving')
    ).toBe('https://openam-sending.example.com/openidm/external/idm/receiving');
  });
});

describe('RemoteProxyOps validation', () => {
  it.each([
    ['an unknown authType', { ...bearer, authType: 'digest' }, /authType/],
    [
      'an instanceUrl without a trailing slash',
      { ...bearer, instanceUrl: 'https://receiving.example.com/openidm' },
      /trailing slash/,
    ],
    [
      'a bearer proxy without a token endpoint',
      { ...bearer, tokenEndpoint: undefined },
      /tokenEndpoint/,
    ],
    [
      'a basic proxy without a password',
      { ...basic, password: undefined },
      /password/,
    ],
  ])('refuses %s and sends nothing', async (_name, proxyData, message) => {
    await expect(
      RemoteProxyOps.updateRemoteProxy({
        proxyId: 'a',
        proxyData: proxyData as any,
        state,
      })
    ).rejects.toThrow(message);
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  it('accepts a complete bearer and a complete basic proxy', async () => {
    await RemoteProxyOps.updateRemoteProxy({
      proxyId: 'a',
      proxyData: bearer,
      state,
    });
    await RemoteProxyOps.updateRemoteProxy({
      proxyId: 'b',
      proxyData: basic,
      state,
    });
    expect(putConfigEntity).toHaveBeenCalledTimes(2);
  });
});

describe('RemoteProxyOps create', () => {
  it('creates a proxy that does not exist', async () => {
    getConfigEntity.mockRejectedValue(notFound());
    const result = await RemoteProxyOps.createRemoteProxy({
      proxyId: 'new',
      proxyData: bearer,
      state,
    });
    expect(result).toEqual(bearer);
    expect(putConfigEntity).toHaveBeenCalledWith({
      entityId: 'external.idm/new',
      entityData: bearer,
      state,
    });
  });

  it('fails when the proxy already exists and writes nothing', async () => {
    getConfigEntity.mockResolvedValue({ _id: 'external.idm/new' });
    await expect(
      RemoteProxyOps.createRemoteProxy({
        proxyId: 'new',
        proxyData: bearer,
        state,
      })
    ).rejects.toThrow('already exists');
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  it('does not treat another error as "does not exist"', async () => {
    getConfigEntity.mockRejectedValue(new Error('boom'));
    await expect(
      RemoteProxyOps.createRemoteProxy({
        proxyId: 'new',
        proxyData: bearer,
        state,
      })
    ).rejects.toThrow('Error checking if remote proxy new already exists');
    expect(putConfigEntity).not.toHaveBeenCalled();
  });
});

describe('RemoteProxyOps export and import', () => {
  it('exports all proxies by name, without the type prefix', async () => {
    readConfigEntitiesByType.mockResolvedValue([
      { _id: 'external.idm/a', ...bearer },
      { _id: 'external.idm/b', ...basic },
    ]);
    const exported = await RemoteProxyOps.exportRemoteProxies({ state });
    expect(Object.keys(exported.remoteProxy)).toEqual(['a', 'b']);
    expect(exported.meta).toEqual({ origin: 'unit-test' });
  });

  it('exports one proxy', async () => {
    getConfigEntity.mockResolvedValue({ _id: 'external.idm/a', ...bearer });
    const exported = await RemoteProxyOps.exportRemoteProxy({
      proxyId: 'a',
      state,
    });
    expect(Object.keys(exported.remoteProxy)).toEqual(['a']);
  });

  it('refuses the whole import when one proxy is invalid and writes nothing', async () => {
    await expect(
      RemoteProxyOps.importRemoteProxies({
        importData: {
          remoteProxy: {
            a: bearer,
            broken: { ...bearer, authType: 'digest' },
            b: basic,
          },
        },
        state,
      })
    ).rejects.toThrow('Error importing remote proxies');
    expect(putConfigEntity).not.toHaveBeenCalled();
  });
});

describe('RemoteProxyOps delete all', () => {
  it('deletes every proxy the list returns and returns them', async () => {
    readConfigEntitiesByType.mockResolvedValue([
      { _id: 'external.idm/a' },
      { _id: 'external.idm/b' },
    ]);
    const deleted = await RemoteProxyOps.deleteRemoteProxies({ state });
    expect(deleted).toEqual([
      { _id: 'external.idm/a' },
      { _id: 'external.idm/b' },
    ]);
  });

  it('keeps deleting after a failure and reports it at the end', async () => {
    readConfigEntitiesByType.mockResolvedValue([
      { _id: 'external.idm/a' },
      { _id: 'external.idm/b' },
    ]);
    deleteConfigEntity.mockRejectedValueOnce(new Error('in use'));
    await expect(RemoteProxyOps.deleteRemoteProxies({ state })).rejects.toThrow(
      'Error deleting remote proxies'
    );
    expect(deleteConfigEntity).toHaveBeenCalledTimes(2);
  });
});
