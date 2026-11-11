import { jest } from '@jest/globals';

/**
 * Unit tests for the trusted JWT issuer api layer. The HTTP layer (`BaseApi`)
 * is replaced by a fake that records the requests; no recording, no tenant.
 */

type Call = {
  method: string;
  url: string;
  body?: any;
  resource: { apiVersion: string };
  requiredScopes: string[];
};
const calls: Call[] = [];
let respond: (call: Call) => any = (call) => ({ data: call.body ?? {} });

const generate = (config: {
  resource: { apiVersion: string };
  requiredScopes: string[];
}) => {
  const record = (method: string, url: string, body?: any) => {
    const call: Call = {
      method,
      url,
      body,
      resource: config.resource,
      requiredScopes: config.requiredScopes,
    };
    calls.push(call);
    return respond(call);
  };
  return {
    get: async (url: string) => record('GET', url),
    put: async (url: string, body: any) => record('PUT', url, body),
    delete: async (url: string) => record('DELETE', url),
  };
};
jest.unstable_mockModule('./BaseApi', () => ({
  generateAmApi: generate,
  generateAmAuthApi: generate,
  generateOauth2Api: generate,
  generateIdmApi: generate,
  generateIdmSystemApi: generate,
  generateLogKeysApi: generate,
  generateLogApi: generate,
  generateEnvApi: generate,
  generateGovernanceApi: generate,
  generateWSFedApi: generate,
  generateReleaseApi: generate,
}));

const {
  deleteOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuers,
  putOAuth2TrustedJwtIssuer,
} = await import('./OAuth2TrustedJwtIssuerApi');
const { default: Constants } = await import('../shared/Constants');
const { default: State } = await import('../shared/State');

const HOST = 'https://openam-matrix.example.com/am';

function newState({ realm = '/alpha', deployment = 'cloud' } = {}) {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType(deployment);
  state.setRealm(realm);
  return state;
}

function sampleIssuer() {
  return {
    _id: 'matrix-issuer',
    _rev: '-1',
    _provider: { _id: 'matrix-provider' },
    _type: {
      _id: 'TrustedJwtIssuer' as const,
      name: 'OAuth2 Trusted JWT Issuer',
      collection: true,
    },
    issuer: 'https://idp.matrix.example.com',
    allowedSubjects: ['neo', 'trinity'],
    jwkSet: '{"keys":[]}',
    'sampleSecret-encrypted': 'placeholder',
    nested: { 'other-encrypted': 'placeholder', kept: 'value' },
  };
}

beforeEach(() => {
  calls.length = 0;
  respond = (call) => ({ data: call.body ?? {} });
});

describe('putOAuth2TrustedJwtIssuer', () => {
  test('leaves the object it is given as it was', async () => {
    const issuerData = sampleIssuer();
    const before = JSON.parse(JSON.stringify(issuerData));

    await putOAuth2TrustedJwtIssuer({
      id: 'matrix-issuer',
      issuerData: issuerData as any,
      state: newState(),
    });

    expect(issuerData).toEqual(before);
  });

  test('sends a body without _rev, _provider and the encrypted attributes', async () => {
    await putOAuth2TrustedJwtIssuer({
      id: 'matrix-issuer',
      issuerData: sampleIssuer() as any,
      state: newState(),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(
      `${HOST}/json/realms/root/realms/alpha/realm-config/agents/TrustedJwtIssuer/matrix-issuer`
    );
    expect(calls[0].body).toEqual({
      _id: 'matrix-issuer',
      _type: sampleIssuer()._type,
      issuer: 'https://idp.matrix.example.com',
      allowedSubjects: ['neo', 'trinity'],
      jwkSet: '{"keys":[]}',
      nested: { kept: 'value' },
    });
  });

  test('two puts of one object send the same body', async () => {
    const issuerData = sampleIssuer();
    const state = newState();
    await putOAuth2TrustedJwtIssuer({
      id: 'matrix-issuer',
      issuerData: issuerData as any,
      state,
    });
    await putOAuth2TrustedJwtIssuer({
      id: 'matrix-issuer',
      issuerData: issuerData as any,
      state,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual(calls[0].body);
    expect(calls[0].body).not.toBe(calls[1].body);
  });
});

describe('requests', () => {
  // [deployment, realm, the realm part of the path]
  const shapes: [string, string, string][] = [
    ['cloud', '/alpha', '/realms/root/realms/alpha'],
    ['cloud', 'bravo', '/realms/root/realms/bravo'],
    ['classic', '/', '/realms/root'],
    ['forgeops', '/', '/realms/root'],
    ['forgeops', '/parent/child', '/realms/root/realms/parent/realms/child'],
  ];
  const base = (realmPath: string) =>
    `${HOST}/json${realmPath}/realm-config/agents/TrustedJwtIssuer`;

  describe.each(shapes)('%s, realm %s', (deployment, realm, realmPath) => {
    const state = () => newState({ realm, deployment });

    test('getOAuth2TrustedJwtIssuers', async () => {
      respond = () => ({ data: { result: [], resultCount: 0 } });
      await getOAuth2TrustedJwtIssuers({ state: state() });

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('GET');
      expect(calls[0].url).toBe(`${base(realmPath)}?_queryFilter=true`);
      expect(calls[0].resource.apiVersion).toBe('protocol=2.0,resource=1.0');
      expect(calls[0].requiredScopes).toEqual([
        Constants.AVAILABLE_SCOPES.AmFullScope,
      ]);
    });

    test('getOAuth2TrustedJwtIssuer', async () => {
      await getOAuth2TrustedJwtIssuer({
        id: 'matrix-issuer',
        state: state(),
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('GET');
      expect(calls[0].url).toBe(`${base(realmPath)}/matrix-issuer`);
      expect(calls[0].resource.apiVersion).toBe('protocol=2.0,resource=1.0');
      expect(calls[0].requiredScopes).toEqual([
        Constants.AVAILABLE_SCOPES.AmFullScope,
      ]);
    });

    test('putOAuth2TrustedJwtIssuer', async () => {
      await putOAuth2TrustedJwtIssuer({
        id: 'matrix-issuer',
        issuerData: sampleIssuer() as any,
        state: state(),
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('PUT');
      expect(calls[0].url).toBe(`${base(realmPath)}/matrix-issuer`);
      expect(calls[0].resource.apiVersion).toBe('protocol=2.0,resource=1.0');
      expect(calls[0].requiredScopes).toEqual([
        Constants.AVAILABLE_SCOPES.AmFullScope,
      ]);
      expect(calls[0].body).not.toHaveProperty('_rev');
    });

    test('deleteOAuth2TrustedJwtIssuer', async () => {
      await deleteOAuth2TrustedJwtIssuer({
        id: 'matrix-issuer',
        state: state(),
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('DELETE');
      expect(calls[0].url).toBe(`${base(realmPath)}/matrix-issuer`);
      expect(calls[0].resource.apiVersion).toBe('protocol=2.0,resource=1.0');
      expect(calls[0].requiredScopes).toEqual([
        Constants.AVAILABLE_SCOPES.AmFullScope,
      ]);
    });
  });

  test('every function returns the data of the answer', async () => {
    const state = newState();
    respond = () => ({ data: { _id: 'answer' } });
    await expect(
      getOAuth2TrustedJwtIssuer({ id: 'matrix-issuer', state })
    ).resolves.toEqual({ _id: 'answer' });
    await expect(getOAuth2TrustedJwtIssuers({ state })).resolves.toEqual({
      _id: 'answer',
    });
    await expect(
      putOAuth2TrustedJwtIssuer({
        id: 'matrix-issuer',
        issuerData: sampleIssuer() as any,
        state,
      })
    ).resolves.toEqual({ _id: 'answer' });
    await expect(
      deleteOAuth2TrustedJwtIssuer({ id: 'matrix-issuer', state })
    ).resolves.toEqual({ _id: 'answer' });
  });

  test('a failed request reaches the caller as it is', async () => {
    const failure = { response: { status: 500 } };
    respond = () => {
      throw failure;
    };
    await expect(
      getOAuth2TrustedJwtIssuers({ state: newState() })
    ).rejects.toBe(failure);
    await expect(
      deleteOAuth2TrustedJwtIssuer({ id: 'matrix-issuer', state: newState() })
    ).rejects.toBe(failure);
  });
});
