import { jest } from '@jest/globals';

/**
 * `importRemoteProxies` checks the name and the configuration of every remote
 * proxy before it writes it, and a refused remote proxy never reaches the tenant
 * (a name with a `/` makes IDM answer 400 after it has created an entity that
 * can neither be read nor deleted, frodo-lib#902).
 *
 * Without a result callback every remote proxy is checked before the first one
 * is written: if any is refused, nothing is imported; a remote proxy that
 * cannot be written does not stop the others and the function throws one error
 * after all of them were tried.
 *
 * With a result callback the outcome of every remote proxy is passed to it as it
 * happens (a refused or failed remote proxy as an error that names it), a
 * refused or failed remote proxy does not stop the others, nothing is thrown for
 * one, and the remote proxies that were imported are returned.
 * Mocked unit test: no recordings.
 */

const getConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const putConfigEntity = jest.fn(
  async (args?: any): Promise<any> => args.entityData
);
const deleteConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntity,
  putConfigEntity,
  deleteConfigEntity,
}));

jest.unstable_mockModule('./IdmConfigOps', () => ({
  readConfigEntitiesByType: jest.fn(async (_args?: any): Promise<any[]> => []),
}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getIdmLoginInfo: jest.fn(async (_args?: any): Promise<any> => ({})),
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

const { default: RemoteProxyOps, importRemoteProxies } =
  await import('./RemoteProxyOps');
const { FrodoError } = await import('./FrodoError');

const state = {
  getHost: () => 'https://openam-sending.example.com/am',
} as any;

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

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
  password: '&{esv.frodo.remote.proxy.password}',
} as any;

let failures: Map<string, Error>;

beforeEach(() => {
  jest.clearAllMocks();
  failures = new Map();
  putConfigEntity.mockReset();
  putConfigEntity.mockImplementation(async (args: any) => {
    if (failures.has(args.entityId)) throw failures.get(args.entityId);
    return { _id: args.entityId, ...args.entityData };
  });
});

/** the entity ids that were sent to the tenant */
const sent = () => putConfigEntity.mock.calls.map((call) => call[0].entityId);
const idsOf = (result: any[]) => result.map((it) => it._id);

describe('importRemoteProxies, without a result callback', () => {
  test('imports every remote proxy and returns them', async () => {
    const result = await importRemoteProxies({
      importData: { remoteProxy: { a: bearer, 'b-2': basic } },
      state,
    });

    expect(idsOf(result)).toEqual(['external.idm/a', 'external.idm/b-2']);
    expect(sent()).toEqual(['external.idm/a', 'external.idm/b-2']);
  });

  test('tries every remote proxy when one cannot be written, then throws one error with one nested error per failed remote proxy', async () => {
    const failure = new Error('HTTP 500');
    failures.set('external.idm/b', failure);

    const error: any = await importRemoteProxies({
      importData: { remoteProxy: { a: bearer, b: basic, c: basic } },
      state,
    }).catch((e) => e);

    expect(sent()).toEqual([
      'external.idm/a',
      'external.idm/b',
      'external.idm/c',
    ]);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error importing remote proxies');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error updating remote proxy b'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('writes nothing and reports every refusal when one name or one remote proxy is refused', async () => {
    const error: any = await importRemoteProxies({
      importData: {
        remoteProxy: {
          a: bearer,
          'x/y': basic,
          broken: { ...bearer, authType: 'digest' },
          b: basic,
        },
      },
      state,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error importing remote proxies: nothing was imported'
    );
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0].message).toContain('"x/y"');
    expect(error.originalErrors[1].message).toContain(
      "Remote proxy broken has authType 'digest'"
    );
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 'x'])(
    'throws for import data without a remoteProxy object: %j',
    async (value) => {
      await expect(
        importRemoteProxies({
          importData: { remoteProxy: value } as any,
          state,
        })
      ).rejects.toThrow('no remoteProxy object');
      expect(putConfigEntity).not.toHaveBeenCalled();
    }
  );
});

describe('importRemoteProxies, with a result callback', () => {
  test('passes every imported remote proxy to it, once and in order, and returns them', async () => {
    const callback = jest.fn();

    const result = await importRemoteProxies({
      importData: { remoteProxy: { a: bearer, 'b-2': basic } },
      resultCallback: callback,
      state,
    });

    expect(idsOf(result)).toEqual(['external.idm/a', 'external.idm/b-2']);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.map((call: any[]) => call[0])).toEqual([
      undefined,
      undefined,
    ]);
    expect(callback.mock.calls.map((call: any[]) => call[1]._id)).toEqual([
      'external.idm/a',
      'external.idm/b-2',
    ]);
  });

  test('a remote proxy that cannot be written goes to it as an error that names it, the others are imported and returned, nothing is thrown', async () => {
    const failure = new Error('HTTP 500');
    failures.set('external.idm/b', failure);
    const callback = jest.fn();

    const result = await importRemoteProxies({
      importData: { remoteProxy: { a: bearer, b: basic, c: basic } },
      resultCallback: callback,
      state,
    });

    expect(sent()).toEqual([
      'external.idm/a',
      'external.idm/b',
      'external.idm/c',
    ]);
    expect(idsOf(result)).toEqual(['external.idm/a', 'external.idm/c']);
    expect(callback).toHaveBeenCalledTimes(3);
    const [okA, failed, okC] = callback.mock.calls as any[];
    expect(okA[0]).toBeUndefined();
    expect(okA[1]._id).toBe('external.idm/a');
    expect(failed[1]).toBeUndefined();
    expect(failed[0]).toBeInstanceOf(FrodoError);
    expect(failed[0].message).toBe('Error importing remote proxy b');
    expect(failed[0].originalErrors[0].message).toBe(
      'Error updating remote proxy b'
    );
    expect(rootCause(failed[0])).toBe(failure);
    expect(okC[0]).toBeUndefined();
    expect(okC[1]._id).toBe('external.idm/c');
  });

  test('a refused name never reaches the tenant, goes to it as an error that names it, and the others are imported', async () => {
    const callback = jest.fn();

    const result = await importRemoteProxies({
      importData: { remoteProxy: { a: bearer, 'x/y': basic, b: basic } },
      resultCallback: callback,
      state,
    });

    expect(sent()).toEqual(['external.idm/a', 'external.idm/b']);
    expect(idsOf(result)).toEqual(['external.idm/a', 'external.idm/b']);
    expect(callback).toHaveBeenCalledTimes(3);
    const refused: any = callback.mock.calls[0][0];
    expect(callback.mock.calls[0][1]).toBeUndefined();
    expect(refused).toBeInstanceOf(FrodoError);
    expect(refused.message).toBe('Error importing remote proxy "x/y"');
    expect(refused.originalErrors[0].message).toContain(
      'Remote proxy name "x/y" is not allowed'
    );
  });

  test('a refused configuration never reaches the tenant, goes to it as an error that names it, and the others are imported', async () => {
    const callback = jest.fn();

    const result = await importRemoteProxies({
      importData: {
        remoteProxy: {
          a: bearer,
          broken: { ...bearer, authType: 'digest' },
          'wrong-id': { ...basic, _id: 'external.idm/other' },
          b: basic,
        },
      },
      resultCallback: callback,
      state,
    });

    expect(sent()).toEqual(['external.idm/a', 'external.idm/b']);
    expect(idsOf(result)).toEqual(['external.idm/a', 'external.idm/b']);
    expect(callback).toHaveBeenCalledTimes(4);
    const messages = callback.mock.calls.map((call: any[]) => call[0]?.message);
    expect(messages).toEqual([
      'Error importing remote proxy broken',
      'Error importing remote proxy wrong-id',
      undefined,
      undefined,
    ]);
    expect((callback.mock.calls[0][0] as any).originalErrors[0].message).toBe(
      "Remote proxy broken has authType 'digest'; expected 'basic' or 'bearer'"
    );
  });

  test('reports the refused remote proxies first, then the outcome of each write, each group in the order of the import data', async () => {
    failures.set('external.idm/c', new Error('HTTP 500'));
    const callback = jest.fn();

    await importRemoteProxies({
      importData: {
        remoteProxy: {
          a: bearer,
          'p q': basic,
          c: basic,
          'x/y': basic,
          d: basic,
        },
      },
      resultCallback: callback,
      state,
    });

    expect(callback.mock.calls.map((call: any[]) => call[0]?.message)).toEqual([
      'Error importing remote proxy "p q"',
      'Error importing remote proxy "x/y"',
      undefined,
      'Error importing remote proxy c',
      undefined,
    ]);
  });

  test('shows a long refused name cut after 40 characters', async () => {
    const callback = jest.fn();
    const longName = `x/${'y'.repeat(200)}`;

    await importRemoteProxies({
      importData: { remoteProxy: { [longName]: basic } },
      resultCallback: callback,
      state,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    const message: string = callback.mock.calls[0][0].message;
    expect(message).toBe(
      `Error importing remote proxy ${JSON.stringify(longName.slice(0, 40))}...`
    );
    expect(message.length).toBeLessThan(80);
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  test('reports every remote proxy as failed and returns nothing when all are refused or fail', async () => {
    failures.set('external.idm/a', new Error('HTTP 500'));
    const callback = jest.fn();

    const result = await importRemoteProxies({
      importData: { remoteProxy: { a: bearer, 'x/y': basic } },
      resultCallback: callback,
      state,
    });

    expect(result).toEqual([]);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.map((call: any[]) => call[0].message)).toEqual([
      'Error importing remote proxy "x/y"',
      'Error importing remote proxy a',
    ]);
    expect(callback.mock.calls.every((call) => call[1] === undefined)).toBe(
      true
    );
  });

  it.each([undefined, null, 'x'])(
    'still throws for import data without a remoteProxy object: %j',
    async (value) => {
      const callback = jest.fn();

      await expect(
        importRemoteProxies({
          importData: { remoteProxy: value } as any,
          resultCallback: callback,
          state,
        })
      ).rejects.toThrow('no remoteProxy object');
      expect(callback).not.toHaveBeenCalled();
      expect(putConfigEntity).not.toHaveBeenCalled();
    }
  );

  test('an exception of the callback is not taken for a failed import and not reported a second time', async () => {
    const callback = jest.fn((_error?: any, _result?: any) => {
      throw new Error('callback failed');
    });

    await expect(
      importRemoteProxies({
        importData: { remoteProxy: { a: bearer, b: basic } },
        resultCallback: callback,
        state,
      })
    ).rejects.toThrow('callback failed');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
    expect(sent()).toEqual(['external.idm/a']);
  });
});

describe('importRemoteProxies on the facade', () => {
  test('passes the result callback on', async () => {
    const callback = jest.fn();

    const result = await RemoteProxyOps(state).importRemoteProxies(
      { remoteProxy: { a: bearer, 'x/y': basic, b: basic } },
      callback
    );

    expect(idsOf(result)).toEqual(['external.idm/a', 'external.idm/b']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback.mock.calls[0][0].message).toBe(
      'Error importing remote proxy "x/y"'
    );
  });

  test('without a callback it refuses the whole import as before', async () => {
    await expect(
      RemoteProxyOps(state).importRemoteProxies({
        remoteProxy: { a: bearer, 'x/y': basic },
      })
    ).rejects.toThrow('nothing was imported');
    expect(putConfigEntity).not.toHaveBeenCalled();
  });
});
