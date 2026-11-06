/**
 * Run tests
 *
 *        npm run test:only RemoteProxyOps.blocks
 *
 * The building blocks of a remote proxy setup (frodo-lib#904): the OAuth2 client
 * a proxy needs, the proxy configuration, a secret generator and the check that
 * a proxy works.
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

const getIdmLoginInfo = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getIdmLoginInfo,
}));

jest.unstable_mockModule('./IdmConfigOps', () => ({
  readConfigEntitiesByType: jest.fn(async (_args?: any): Promise<any[]> => []),
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

const SECRET = 'a-secret-with-enough-characters-1234';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildRemoteProxyClient', () => {
  const client = RemoteProxyOps.buildRemoteProxyClient({
    clientId: 'frodo-remote-proxy',
    clientSecret: SECRET,
  }) as any;

  it('is a confidential client for the client credentials grant and nothing else', () => {
    expect(client.advancedOAuth2ClientConfig.grantTypes.value).toEqual([
      'client_credentials',
    ]);
    expect(client.coreOAuth2ClientConfig.clientType.value).toBe('Confidential');
    expect(client.coreOAuth2ClientConfig.status.value).toBe('Active');
    expect(client.advancedOAuth2ClientConfig.responseTypes.value).toEqual([
      'token',
    ]);
  });

  it('authenticates with client secret post', () => {
    expect(
      client.advancedOAuth2ClientConfig.tokenEndpointAuthMethod.value
    ).toBe('client_secret_post');
  });

  it('has the IDM scope and nothing broader', () => {
    expect(client.coreOAuth2ClientConfig.scopes.value).toEqual(['fr:idm:*']);
    expect(client.coreOAuth2ClientConfig.defaultScopes.value).toEqual([
      'fr:idm:*',
    ]);
  });

  it('carries the secret, the name and a description', () => {
    expect(client.coreOAuth2ClientConfig.userpassword).toBe(SECRET);
    expect(client.coreOAuth2ClientConfig.clientName.value).toEqual([
      'frodo-remote-proxy',
    ]);
    expect(client.advancedOAuth2ClientConfig.descriptions.value).toEqual([
      'Created by Frodo for an IDM remote proxy',
    ]);
    const custom = RemoteProxyOps.buildRemoteProxyClient({
      clientId: 'x',
      clientSecret: SECRET,
      description: 'from the sending tenant',
    }) as any;
    expect(custom.advancedOAuth2ClientConfig.descriptions.value).toEqual([
      'from the sending tenant',
    ]);
  });

  it('returns a new object every time', () => {
    const one = RemoteProxyOps.buildRemoteProxyClient({
      clientId: 'a',
      clientSecret: SECRET,
    }) as any;
    one.coreOAuth2ClientConfig.scopes.value.push('fr:am:*');
    const two = RemoteProxyOps.buildRemoteProxyClient({
      clientId: 'a',
      clientSecret: SECRET,
    }) as any;
    expect(two.coreOAuth2ClientConfig.scopes.value).toEqual(['fr:idm:*']);
  });

  it.each(['', 'a/b', '-a', '.a', 'a b', 'a'.repeat(101), undefined, 42])(
    'refuses the client id %j',
    (clientId) => {
      expect(() =>
        RemoteProxyOps.buildRemoteProxyClient({
          clientId: clientId as any,
          clientSecret: SECRET,
        })
      ).toThrow('is not allowed');
    }
  );

  it.each(['', 'short', 'x'.repeat(15), undefined, 12345678901234567890])(
    'refuses the client secret %j',
    (clientSecret) => {
      expect(() =>
        RemoteProxyOps.buildRemoteProxyClient({
          clientId: 'a',
          clientSecret: clientSecret as any,
        })
      ).toThrow('at least 16 characters');
    }
  );

  it('is available through the factory', () => {
    expect(
      (
        ops.buildRemoteProxyClient({
          clientId: 'a',
          clientSecret: SECRET,
        }) as any
      ).coreOAuth2ClientConfig.userpassword
    ).toBe(SECRET);
  });
});

describe('buildRemoteProxyConfiguration', () => {
  const params = {
    receiverHost: 'https://openam-receiving.example.com/am',
    clientId: 'frodo-remote-proxy',
    secretId: 'esv-remote-proxy-receiving',
  };

  it('is the bearer configuration for the receiving tenant', () => {
    expect(RemoteProxyOps.buildRemoteProxyConfiguration(params)).toEqual({
      enabled: true,
      authType: 'bearer',
      instanceUrl: 'https://openam-receiving.example.com/openidm/',
      clientId: 'frodo-remote-proxy',
      clientSecret: '&{esv.remote.proxy.receiving}',
      scope: ['fr:idm:*'],
      tokenEndpoint:
        'https://openam-receiving.example.com/am/oauth2/realms/root/realms/alpha/access_token',
      tokenEndpointAuthMethod: 'client_secret_post',
      scopeDelimiter: ' ',
    });
  });

  it('keeps the secret out of the configuration: it is a placeholder for the ESV secret', () => {
    const config = RemoteProxyOps.buildRemoteProxyConfiguration(params);
    expect(config.clientSecret).toBe('&{esv.remote.proxy.receiving}');
    expect(RemoteProxyOps.getTenantBoundSecrets(config)).toEqual([]);
  });

  it('uses the realm it is given', () => {
    expect(
      RemoteProxyOps.buildRemoteProxyConfiguration({
        ...params,
        realm: 'bravo',
      }).tokenEndpoint
    ).toBe(
      'https://openam-receiving.example.com/am/oauth2/realms/root/realms/bravo/access_token'
    );
  });

  it.each([
    'https://openam-receiving.example.com',
    'https://openam-receiving.example.com/',
    'https://openam-receiving.example.com/am',
    'https://openam-receiving.example.com/am/',
  ])('takes the origin of the host %s', (receiverHost) => {
    expect(
      RemoteProxyOps.buildRemoteProxyConfiguration({ ...params, receiverHost })
        .instanceUrl
    ).toBe('https://openam-receiving.example.com/openidm/');
  });

  it('is accepted by the write operations', async () => {
    await RemoteProxyOps.updateRemoteProxy({
      proxyId: 'receiving',
      proxyData: RemoteProxyOps.buildRemoteProxyConfiguration(params),
      state,
    });
    expect(putConfigEntity).toHaveBeenCalledTimes(1);
  });

  it.each(['http://openam-receiving.example.com/am', 'ftp://x/y'])(
    'refuses a host that does not use https: %s',
    (receiverHost) => {
      expect(() =>
        RemoteProxyOps.buildRemoteProxyConfiguration({
          ...params,
          receiverHost,
        })
      ).toThrow('must use https');
    }
  );

  it.each(['not a url', '', undefined])(
    'refuses a host that is not a URL: %j',
    (receiverHost) => {
      expect(() =>
        RemoteProxyOps.buildRemoteProxyConfiguration({
          ...params,
          receiverHost: receiverHost as any,
        })
      ).toThrow('is not a URL');
    }
  );

  it.each(['', 'a/b', '-a', undefined])(
    'refuses the client id %j',
    (clientId) => {
      expect(() =>
        RemoteProxyOps.buildRemoteProxyConfiguration({
          ...params,
          clientId: clientId as any,
        })
      ).toThrow('is not allowed');
    }
  );

  it.each([
    'esv',
    'Esv-x',
    'secret-x',
    'esv--x',
    'esv-X',
    'esv-a/b',
    'esv-a b',
    'esv-',
    '',
    undefined,
  ])('refuses the ESV secret id %j', (secretId) => {
    expect(() =>
      RemoteProxyOps.buildRemoteProxyConfiguration({
        ...params,
        secretId: secretId as any,
      })
    ).toThrow('ESV secret id');
  });

  it.each(['', 'a/b', '../x', 'a b', '-a', 'a?b'])(
    'refuses the realm %j',
    (realm) => {
      expect(() =>
        RemoteProxyOps.buildRemoteProxyConfiguration({ ...params, realm })
      ).toThrow('realm');
    }
  );

  it('is available through the factory', () => {
    expect(ops.buildRemoteProxyConfiguration(params).authType).toBe('bearer');
  });
});

describe('generateRemoteProxySecret', () => {
  it('has 48 URL-safe characters by default', () => {
    const secret = RemoteProxyOps.generateRemoteProxySecret();
    expect(secret).toHaveLength(48);
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([32, 33, 48, 64, 100, 256])('has the length %d', (length) => {
    const secret = RemoteProxyOps.generateRemoteProxySecret(length);
    expect(secret).toHaveLength(length);
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not repeat', () => {
    const secrets = new Set(
      Array.from({ length: 200 }, () =>
        RemoteProxyOps.generateRemoteProxySecret()
      )
    );
    expect(secrets.size).toBe(200);
  });

  it('uses the whole alphabet, not a few characters', () => {
    const seen = new Set(
      Array.from({ length: 50 }, () =>
        RemoteProxyOps.generateRemoteProxySecret(256)
      ).join('')
    );
    expect(seen.size).toBeGreaterThan(55);
  });

  it.each([31, 257, 0, -1, 1.5, NaN, Infinity, '48' as any])(
    'refuses the length %j',
    (length) => {
      expect(() => RemoteProxyOps.generateRemoteProxySecret(length)).toThrow(
        'from 32 to 256'
      );
    }
  );

  it('is available through the factory', () => {
    expect(ops.generateRemoteProxySecret(40)).toHaveLength(40);
  });
});

describe('testRemoteProxy', () => {
  function httpError(
    status: number | undefined,
    message?: string,
    code?: string
  ) {
    const error: any = new Error(
      message ?? `Request failed with status ${status}`
    );
    if (status !== undefined) error.response = { status, data: { message } };
    if (code) error.code = code;
    return error;
  }

  it('reports the identity and roles the proxy acts as', async () => {
    getIdmLoginInfo.mockResolvedValue({
      _id: 'login',
      authenticationId: 'openidm-admin',
      authorization: {
        id: 'openidm-admin',
        roles: [
          'internal/role/openidm-admin',
          'internal/role/openidm-authorized',
        ],
        component: 'internal/user',
      },
    });
    const result = await RemoteProxyOps.testRemoteProxy({
      proxyId: 'receiving',
      state,
    });
    expect(result).toEqual({
      ok: true,
      status: 'ok',
      httpStatus: 200,
      authenticationId: 'openidm-admin',
      roles: [
        'internal/role/openidm-admin',
        'internal/role/openidm-authorized',
      ],
      message:
        "Remote proxy receiving works: the receiving tenant answers as 'openidm-admin'",
    });
  });

  it('makes the one read through the proxy, with a state that points at it, and changes nothing', async () => {
    getIdmLoginInfo.mockResolvedValue({ authenticationId: 'x' });
    await RemoteProxyOps.testRemoteProxy({ proxyId: 'receiving', state });
    expect(getIdmLoginInfo).toHaveBeenCalledTimes(1);
    const viewState = (getIdmLoginInfo.mock.calls[0][0] as any).state;
    expect(viewState.getIdmHost()).toBe(
      'https://openam-sending.example.com/openidm/external/idm/receiving'
    );
    expect(viewState.getHost()).toBe('https://openam-sending.example.com/am');
    expect(state.getIdmHost).toBeUndefined();
    expect(getConfigEntity).not.toHaveBeenCalled();
    expect(putConfigEntity).not.toHaveBeenCalled();
    expect(deleteConfigEntity).not.toHaveBeenCalled();
  });

  it.each([
    [
      404,
      "Resource 'external/idm/x/info/login' not found",
      'not-found',
      /no working remote proxy named x.*ESV secret/,
    ],
    [503, 'Service Unavailable', 'unavailable', /disabled or not ready/],
    [
      500,
      'Response is not application/json',
      'token-request-failed',
      /could not get a token/,
    ],
    [
      500,
      'Access Denied',
      'not-authorized',
      /token was issued.*static user mapping/,
    ],
    [
      500,
      'access denied by the receiving tenant',
      'not-authorized',
      /static user mapping/,
    ],
    [401, 'Unauthorized', 'not-authorized', /static user mapping/],
    [403, 'Forbidden', 'not-authorized', /static user mapping/],
    [
      500,
      'something else broke',
      'error',
      /failed \(500\): something else broke/,
    ],
    [418, 'teapot', 'error', /failed \(418\): teapot/],
  ])(
    'classifies HTTP %i %j as %s',
    async (httpStatus, message, status, text) => {
      getIdmLoginInfo.mockRejectedValue(httpError(httpStatus, message));
      const result = await RemoteProxyOps.testRemoteProxy({
        proxyId: 'x',
        state,
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(status);
      expect(result.httpStatus).toBe(httpStatus);
      expect(result.message).toMatch(text);
      expect(result.authenticationId).toBeUndefined();
      expect(result.roles).toBeUndefined();
    }
  );

  it('reports no answer as unreachable', async () => {
    getIdmLoginInfo.mockRejectedValue(
      httpError(undefined, 'connect ECONNREFUSED', 'ECONNREFUSED')
    );
    const result = await RemoteProxyOps.testRemoteProxy({
      proxyId: 'x',
      state,
    });
    expect(result).toMatchObject({ ok: false, status: 'unreachable' });
    expect(result.httpStatus).toBeUndefined();
    expect(result.message).toContain('ECONNREFUSED');
  });

  it('copes with an answer that has no identity', async () => {
    getIdmLoginInfo.mockResolvedValue({});
    const result = await RemoteProxyOps.testRemoteProxy({
      proxyId: 'x',
      state,
    });
    expect(result).toMatchObject({ ok: true, status: 'ok' });
    expect(result.roles).toBeUndefined();
  });

  it.each(['a/b', '..', 'a?x=1', ''])(
    'refuses the name %j before it makes a request',
    async (name) => {
      await expect(
        RemoteProxyOps.testRemoteProxy({ proxyId: name, state })
      ).rejects.toThrow('is not allowed');
      expect(getIdmLoginInfo).not.toHaveBeenCalled();
    }
  );

  it('is available through the factory, for the proxy it is asked about', async () => {
    getIdmLoginInfo.mockResolvedValue({ authenticationId: 'openidm-admin' });
    expect((await ops.testRemoteProxy('some-other')).ok).toBe(true);
    const viewState = (getIdmLoginInfo.mock.calls[0][0] as any).state;
    expect(viewState.getIdmHost()).toBe(
      'https://openam-sending.example.com/openidm/external/idm/some-other'
    );
  });
});
