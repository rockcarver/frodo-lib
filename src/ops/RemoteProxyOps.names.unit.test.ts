/**
 * Run tests
 *
 *        npm run test:only RemoteProxyOps.names
 *
 * The name of a remote proxy becomes part of the IDM entity id and of a REST
 * path. IDM answers a `/` in the id with 400 after it has created the entity,
 * and then cannot read or delete it, so the names are checked before any
 * request is made (frodo-lib#902).
 */
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

const getIdmLoginInfo = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getIdmLoginInfo,
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

const state = {
  getHost: () => 'https://openam-sending.example.com/am',
} as any;
const ops = createRemoteProxyOps(state);

const bearer = {
  enabled: true,
  authType: 'bearer',
  instanceUrl: 'https://receiving.example.com/openidm/',
  clientId: 'frodo-remote-proxy',
  clientSecret: '&{esv.frodo.remote.proxy.secret}',
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

function nothingSent() {
  expect(getConfigEntity).not.toHaveBeenCalled();
  expect(putConfigEntity).not.toHaveBeenCalled();
  expect(deleteConfigEntity).not.toHaveBeenCalled();
  expect(readConfigEntitiesByType).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  getConfigEntity.mockResolvedValue({});
  readConfigEntitiesByType.mockResolvedValue([]);
});

const allowed = [
  'a',
  'volker-dev',
  'Tenant_1',
  'my.tenant',
  '0abc',
  'a'.repeat(100),
];

const refused: [string, string][] = [
  ['', 'it is empty'],
  [' ', '" "'],
  ['a b', '" "'],
  ['a/b', '"/"'],
  ['/a', '"/"'],
  ['a%20b', '"%"'],
  ['a%2Fb', '"%"'],
  ['a?x=1', '"?"'],
  ['a#b', '"#"'],
  ['a&b', '"&"'],
  ['a\\b', '"\\\\"'],
  ['../x', '"/"'],
  ['..', 'does not start with a letter or a digit'],
  ['.', 'does not start with a letter or a digit'],
  ['.a', 'does not start with a letter or a digit'],
  ['-a', 'does not start with a letter or a digit'],
  ['_a', 'does not start with a letter or a digit'],
  ['a+b', '"+"'],
  ['a~b', '"~"'],
  ['a:b', '":"'],
  ['zzspike-é', '"é"'],
  ['a\u0000b', '"\\u0000"'],
  ['a\nb', '"\\n"'],
  ['a'.repeat(101), 'longer than 100 characters'],
];

describe('isValidRemoteProxyName', () => {
  it.each(allowed)('allows %s', (name) => {
    expect(RemoteProxyOps.isValidRemoteProxyName(name)).toBe(true);
    expect(ops.isValidRemoteProxyName(name)).toBe(true);
  });

  it.each(refused.map(([name]) => name))('refuses %j', (name) => {
    expect(RemoteProxyOps.isValidRemoteProxyName(name)).toBe(false);
    expect(ops.isValidRemoteProxyName(name)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ['a'], true])(
    'refuses a value that is not a string: %j',
    (value) => {
      expect(RemoteProxyOps.isValidRemoteProxyName(value)).toBe(false);
    }
  );
});

describe('the error for a name that is not allowed', () => {
  it.each(refused)('names the reason for %j', (name, reason) => {
    expect(() => RemoteProxyOps.validateRemoteProxyName(name)).toThrow(
      'is not allowed'
    );
    expect(() => RemoteProxyOps.validateRemoteProxyName(name)).toThrow(reason);
  });

  it('states the rule', () => {
    expect(() => RemoteProxyOps.validateRemoteProxyName('a/b')).toThrow(
      "1 to 100 characters, starts with a letter or a digit and contains only letters, digits, '.', '_' and '-'"
    );
  });

  it('does not repeat a very long name in full', () => {
    let message = '';
    try {
      RemoteProxyOps.validateRemoteProxyName('x'.repeat(5000));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('longer than 100 characters');
    expect(message.length).toBeLessThan(400);
  });

  it('refuses a value that is not a string', () => {
    expect(() => RemoteProxyOps.validateRemoteProxyName(undefined)).toThrow(
      'it is not a string'
    );
  });
});

describe('every operation refuses a name that is not allowed before it makes a request', () => {
  const operations: [string, (name: string) => Promise<unknown> | unknown][] = [
    [
      'readRemoteProxy',
      (n) => RemoteProxyOps.readRemoteProxy({ proxyId: n, state }),
    ],
    [
      'exportRemoteProxy',
      (n) => RemoteProxyOps.exportRemoteProxy({ proxyId: n, state }),
    ],
    [
      'createRemoteProxy',
      (n) =>
        RemoteProxyOps.createRemoteProxy({
          proxyId: n,
          proxyData: bearer,
          state,
        }),
    ],
    [
      'updateRemoteProxy',
      (n) =>
        RemoteProxyOps.updateRemoteProxy({
          proxyId: n,
          proxyData: bearer,
          state,
        }),
    ],
    [
      'deleteRemoteProxy',
      (n) => RemoteProxyOps.deleteRemoteProxy({ proxyId: n, state }),
    ],
    [
      'getRemoteProxyBaseUrl',
      (n) => RemoteProxyOps.getRemoteProxyBaseUrl({ proxyId: n, state }),
    ],
    ['facade readRemoteProxy', (n) => ops.readRemoteProxy(n)],
    ['facade exportRemoteProxy', (n) => ops.exportRemoteProxy(n)],
    ['facade createRemoteProxy', (n) => ops.createRemoteProxy(n, bearer)],
    ['facade updateRemoteProxy', (n) => ops.updateRemoteProxy(n, bearer)],
    ['facade deleteRemoteProxy', (n) => ops.deleteRemoteProxy(n)],
    ['facade getRemoteProxyBaseUrl', (n) => ops.getRemoteProxyBaseUrl(n)],
  ];

  describe.each(operations)('%s', (_label, operation) => {
    it.each(['a/b', '..', 'a%2Fb', 'a?x=1', 'a b', ''])(
      'refuses %j',
      async (name) => {
        await expect(async () => operation(name)).rejects.toThrow(
          'is not allowed'
        );
        nothingSent();
      }
    );
  });

  it('builds the base url for an allowed name', () => {
    expect(
      RemoteProxyOps.getRemoteProxyBaseUrl({ proxyId: 'volker-dev', state })
    ).toBe(
      'https://openam-sending.example.com/openidm/external/idm/volker-dev'
    );
  });
});

describe('the id inside a proxy must be the id of its name', () => {
  it('refuses a proxy with another id and writes nothing', async () => {
    await expect(
      RemoteProxyOps.updateRemoteProxy({
        proxyId: 'a',
        proxyData: { ...bearer, _id: 'external.idm/other' },
        state,
      })
    ).rejects.toThrow("expected 'external.idm/a'");
    await expect(
      RemoteProxyOps.updateRemoteProxy({
        proxyId: 'a',
        proxyData: { ...bearer, _id: 'external.idm/a/b' },
        state,
      })
    ).rejects.toThrow("expected 'external.idm/a'");
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  it('accepts a proxy with its own id and one without an id', async () => {
    await RemoteProxyOps.updateRemoteProxy({
      proxyId: 'a',
      proxyData: { ...bearer, _id: 'external.idm/a' },
      state,
    });
    await RemoteProxyOps.updateRemoteProxy({
      proxyId: 'a',
      proxyData: bearer,
      state,
    });
    expect(putConfigEntity).toHaveBeenCalledTimes(2);
  });
});

describe('import', () => {
  it('writes nothing when one name is not allowed, and reports every refusal', async () => {
    let error: any;
    try {
      await RemoteProxyOps.importRemoteProxies({
        importData: {
          remoteProxy: { a: bearer, 'x/y': basic, 'p q': basic, b: basic },
        },
        state,
      });
    } catch (e) {
      error = e;
    }
    expect(error.message).toContain('nothing was imported');
    const combined = error.getCombinedMessage();
    expect(combined).toContain('"x/y"');
    expect(combined).toContain('"p q"');
    expect(combined).not.toContain('"a"');
    expect(combined).not.toContain('"b"');
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  it('writes nothing when a proxy carries another id than its name', async () => {
    await expect(
      RemoteProxyOps.importRemoteProxies({
        importData: {
          remoteProxy: {
            a: bearer,
            b: { ...basic, _id: 'external.idm/a/b' },
          },
        },
        state,
      })
    ).rejects.toThrow('nothing was imported');
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 'x'])(
    'refuses import data without a remoteProxy object: %j',
    async (value) => {
      await expect(
        RemoteProxyOps.importRemoteProxies({
          importData: { remoteProxy: value } as any,
          state,
        })
      ).rejects.toThrow('no remoteProxy object');
      expect(putConfigEntity).not.toHaveBeenCalled();
    }
  );

  it('imports allowed names', async () => {
    await RemoteProxyOps.importRemoteProxies({
      importData: { remoteProxy: { a: bearer, 'b-2': basic } },
      state,
    });
    expect(putConfigEntity.mock.calls.map((c) => c[0].entityId)).toEqual([
      'external.idm/a',
      'external.idm/b-2',
    ]);
  });
});

describe('delete all', () => {
  it('reports an entity whose name cannot be addressed, without a request for it, and deletes the others', async () => {
    readConfigEntitiesByType.mockResolvedValue([
      { _id: 'external.idm/a' },
      { _id: 'external.idm/zz/slash' },
      { _id: 'external.idm/b' },
    ]);
    await expect(RemoteProxyOps.deleteRemoteProxies({ state })).rejects.toThrow(
      'Error deleting remote proxies'
    );
    expect(deleteConfigEntity.mock.calls.map((c) => c[0].entityId)).toEqual([
      'external.idm/a',
      'external.idm/b',
    ]);
  });
});

describe('getTenantBoundSecrets', () => {
  const encrypted = {
    $crypto: {
      type: 'x-simple-encryption',
      value: { cipher: 'AES/CBC/PKCS5Padding' },
    },
  };

  it('finds a basic password that IDM returned encrypted', () => {
    expect(
      RemoteProxyOps.getTenantBoundSecrets({ ...basic, password: encrypted })
    ).toEqual(['password']);
  });

  it('finds a bearer client secret that IDM returned encrypted', () => {
    expect(
      RemoteProxyOps.getTenantBoundSecrets({
        ...bearer,
        clientSecret: encrypted,
      })
    ).toEqual(['clientSecret']);
  });

  it('finds every encrypted property', () => {
    expect(
      RemoteProxyOps.getTenantBoundSecrets({
        ...basic,
        password: encrypted,
        extra: encrypted,
      } as any).sort()
    ).toEqual(['extra', 'password']);
  });

  it('does not flag an ESV placeholder, a plain value or a missing secret', () => {
    expect(RemoteProxyOps.getTenantBoundSecrets(bearer)).toEqual([]);
    expect(RemoteProxyOps.getTenantBoundSecrets(basic)).toEqual([]);
    expect(
      RemoteProxyOps.getTenantBoundSecrets({ ...basic, password: 'plain' })
    ).toEqual([]);
    expect(
      RemoteProxyOps.getTenantBoundSecrets({ ...basic, password: undefined })
    ).toEqual([]);
  });

  it('does not flag a null, an array or an object without $crypto', () => {
    expect(
      RemoteProxyOps.getTenantBoundSecrets({
        ...basic,
        password: null,
        scope: ['a'],
        other: { a: 1 },
      } as any)
    ).toEqual([]);
  });

  it('is available through the factory and tolerates no input', () => {
    expect(
      ops.getTenantBoundSecrets({ ...basic, password: encrypted })
    ).toEqual(['password']);
    expect(RemoteProxyOps.getTenantBoundSecrets(undefined as any)).toEqual([]);
    expect(RemoteProxyOps.getTenantBoundSecrets(null as any)).toEqual([]);
  });
});
