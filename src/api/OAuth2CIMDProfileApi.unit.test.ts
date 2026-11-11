/**
 * Unit tests for the CIMD profile api layer.
 *
 * Run with:
 *
 *        npm run test:only src/api/OAuth2CIMDProfileApi
 *
 * The HTTP layer (`BaseApi`) is replaced by a fake that records how each
 * request was set up (resource version, required scopes, request override)
 * and what was sent, and answers with a canned response. Nothing here needs
 * a tenant or a recording. The shapes of the canned answers are the ones
 * observed on a tenant (wrapped `{ inherited, value }` values in the single
 * read, plain values in the list).
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';

type Call = {
  method: string;
  url: string;
  body?: unknown;
  resource: { apiVersion?: string };
  requiredScopes: string[];
  requestOverride: Record<string, unknown>;
};

const calls: Call[] = [];
let nextAnswer: { status: number; data: unknown } = { status: 200, data: {} };
let nextFailure: Error | undefined;

function generate(options: {
  resource: { apiVersion?: string };
  requiredScopes: string[];
  requestOverride?: Record<string, unknown>;
}) {
  const record = (method: string) => async (url: string, body?: unknown) => {
    // for get and delete the second argument is the request config, not a body
    calls.push({
      method,
      url,
      body: method === 'PUT' || method === 'POST' ? body : undefined,
      resource: options.resource,
      requiredScopes: options.requiredScopes,
      requestOverride: options.requestOverride ?? {},
    });
    if (nextFailure) throw nextFailure;
    return nextAnswer;
  };
  return {
    get: record('GET'),
    put: record('PUT'),
    post: record('POST'),
    delete: record('DELETE'),
  };
}

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
  deleteCIMDProfile,
  encodeCIMDProfileId,
  getCIMDProfile,
  getCIMDProfileSchema,
  getCIMDProfiles,
  getCIMDProfileTemplate,
  putCIMDProfile,
} = await import('./OAuth2CIMDProfileApi');
const { default: State } = await import('../shared/State');
const { default: Constants } = await import('../shared/Constants');

const HOST = 'https://openam-matrix.example.com/am';

function newState(realm: string, deployment: string = 'cloud') {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType(deployment);
  state.setRealm(realm);
  return state;
}

// the single read: the properties of the groups are wrapped
const wrapped = {
  _id: 'matrix-mcp-clients',
  _rev: '1234567890',
  cimdConfig: {
    cimdClientIdUrlPatterns: {
      inherited: false,
      value: ['https://clients.matrix.example.com/*'],
    },
    cimdSsrfProtectionEnabled: { inherited: false, value: true },
  },
  _type: { _id: 'CIMDProfile', name: 'CIMD Profile', collection: true },
};

// the list: the same profile with plain values
const plain = {
  _id: 'matrix-mcp-clients',
  _rev: '-1122334455',
  cimdConfig: {
    cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
    cimdSsrfProtectionEnabled: true,
  },
  _type: { _id: 'CIMDProfile', name: 'CIMD Profile', collection: true },
};

beforeEach(() => {
  calls.length = 0;
  nextAnswer = { status: 200, data: {} };
  nextFailure = undefined;
});

const base = `${HOST}/json`;
const type = 'realm-config/agents/CIMDProfile';

describe('URL shapes', () => {
  // [deployment, realm, realm path in the URL]
  const shapes: [string, string, string][] = [
    ['cloud', 'alpha', '/realms/root/realms/alpha'],
    ['cloud', '/bravo', '/realms/root/realms/bravo'],
    ['forgeops', '/', '/realms/root'],
    ['classic', '/', '/realms/root'],
    ['classic', '/alpha/sub', '/realms/root/realms/alpha/realms/sub'],
  ];

  test.each(shapes)(
    '%s, realm %s: every function builds its URL under %s',
    async (deployment, realm, path) => {
      const state = newState(realm, deployment);
      await getCIMDProfiles({ state });
      await getCIMDProfile({ profileId: 'a', state });
      await putCIMDProfile({ profileId: 'a', profileData: {}, state });
      await deleteCIMDProfile({ profileId: 'a', state });
      await getCIMDProfileTemplate({ state });
      await getCIMDProfileSchema({ state });
      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        `GET ${base}${path}/${type}?_queryFilter=true`,
        `GET ${base}${path}/${type}/a`,
        `PUT ${base}${path}/${type}/a`,
        `DELETE ${base}${path}/${type}/a`,
        `POST ${base}${path}/${type}?_action=template`,
        `POST ${base}${path}/${type}?_action=schema`,
      ]);
    }
  );
});

describe('request set-up', () => {
  test('every call asks for protocol=2.1,resource=1.0 and the full AM scope', async () => {
    const state = newState('alpha');
    await getCIMDProfiles({ state });
    await getCIMDProfile({ profileId: 'a', state });
    await putCIMDProfile({ profileId: 'a', profileData: {}, state });
    await deleteCIMDProfile({ profileId: 'a', state });
    await getCIMDProfileTemplate({ state });
    await getCIMDProfileSchema({ state });
    expect(calls).toHaveLength(6);
    for (const call of calls) {
      expect(call.resource).toEqual({
        apiVersion: 'protocol=2.1,resource=1.0',
      });
      expect(call.requiredScopes).toEqual([
        Constants.AVAILABLE_SCOPES.AmFullScope,
      ]);
    }
  });

  test('template and schema are POSTs with an empty body', async () => {
    const state = newState('alpha');
    await getCIMDProfileTemplate({ state });
    await getCIMDProfileSchema({ state });
    expect(calls.map((call) => [call.method, call.body])).toEqual([
      ['POST', {}],
      ['POST', {}],
    ]);
  });

  test('the answers are returned as the server sent them', async () => {
    const state = newState('alpha');
    nextAnswer = { status: 200, data: { result: [plain], resultCount: 1 } };
    expect(await getCIMDProfiles({ state })).toEqual({
      result: [plain],
      resultCount: 1,
    });
    nextAnswer = { status: 200, data: wrapped };
    expect(await getCIMDProfile({ profileId: 'a', state })).toEqual(wrapped);
    expect(await deleteCIMDProfile({ profileId: 'a', state })).toEqual(wrapped);
    nextAnswer = { status: 200, data: plain };
    expect(await getCIMDProfileTemplate({ state })).toEqual(plain);
    nextAnswer = {
      status: 200,
      data: { type: 'object', properties: { cimdConfig: {} } },
    };
    expect(await getCIMDProfileSchema({ state })).toEqual({
      type: 'object',
      properties: { cimdConfig: {} },
    });
  });
});

describe('id encoding', () => {
  test.each([
    ['matrix mcp clients', 'matrix%20mcp%20clients'],
    ['a(b)!', 'a%28b%29%21'],
    ["it's*", 'it%27s%2A'],
    ['a.b', 'a.b'],
    ['a@b', 'a%40b'],
    ['a_b-c~d', 'a_b-c~d'],
    ['MiXeD', 'MiXeD'],
    ['Zoë', 'Zo%C3%AB'],
    ['日本', '%E6%97%A5%E6%9C%AC'],
  ])('%s is encoded as %s', (id, encoded) => {
    expect(encodeCIMDProfileId(id)).toBe(encoded);
  });

  test("no function sends a raw ! ' ( ) * in the path", async () => {
    const state = newState('alpha');
    const profileId = "a(b)!'*c d";
    await getCIMDProfile({ profileId, state });
    await putCIMDProfile({ profileId, profileData: {}, state });
    await deleteCIMDProfile({ profileId, state });
    expect(calls.map((call) => call.url)).toEqual([
      `${base}/realms/root/realms/alpha/${type}/a%28b%29%21%27%2Ac%20d`,
      `${base}/realms/root/realms/alpha/${type}/a%28b%29%21%27%2Ac%20d`,
      `${base}/realms/root/realms/alpha/${type}/a%28b%29%21%27%2Ac%20d`,
    ]);
  });
});

describe('putCIMDProfile', () => {
  test('returns the status with the answer: 201 (created) and 200 (updated)', async () => {
    const state = newState('alpha');
    nextAnswer = { status: 201, data: wrapped };
    expect(
      await putCIMDProfile({ profileId: 'a', profileData: plain, state })
    ).toEqual({ status: 201, data: wrapped });
    nextAnswer = { status: 200, data: wrapped };
    expect(
      await putCIMDProfile({ profileId: 'a', profileData: plain, state })
    ).toEqual({ status: 200, data: wrapped });
  });

  test('does not change the object it is given', async () => {
    const state = newState('alpha');
    const profileData = {
      ...plain,
      cimdConfig: { ...plain.cimdConfig, 'x-encrypted': 'secret' },
    };
    const before = JSON.parse(JSON.stringify(profileData));
    await putCIMDProfile({ profileId: 'a', profileData, state });
    expect(profileData).toEqual(before);
    expect(profileData._rev).toBe('-1122334455');
  });

  test('removes _rev and keys containing -encrypted from the body it sends', async () => {
    const state = newState('alpha');
    await putCIMDProfile({
      profileId: 'a',
      profileData: {
        ...plain,
        'secret-encrypted': 'x',
        coreOAuth2ClientConfig: {
          'userpassword-encrypted': 'y',
          status: 'Active',
        },
      },
      state,
    });
    const sent = calls[0].body as Record<string, unknown>;
    expect(sent).not.toHaveProperty('_rev');
    expect(JSON.stringify(sent)).not.toContain('-encrypted');
    expect(sent.coreOAuth2ClientConfig).toEqual({ status: 'Active' });
  });

  test.each([
    ['plain', plain],
    ['wrapped', wrapped],
  ])('keeps _id, _type and %s properties as given', async (_name, data) => {
    const state = newState('alpha');
    await putCIMDProfile({ profileId: 'a', profileData: data, state });
    const { _rev, ...expected } = data;
    expect(_rev).toBeDefined();
    expect(calls[0].body).toEqual(expected);
  });

  test('a mixed body is sent as it is, nothing is merged', async () => {
    const state = newState('alpha');
    const mixed = {
      cimdConfig: {
        cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
        cimdSsrfProtectionEnabled: { inherited: false, value: false },
      },
    };
    await putCIMDProfile({ profileId: 'a', profileData: mixed, state });
    expect(calls[0].body).toEqual(mixed);
  });

  test('failIfExists sends If-None-Match: *', async () => {
    const state = newState('alpha');
    await putCIMDProfile({
      profileId: 'a',
      profileData: plain,
      failIfExists: true,
      state,
    });
    expect(calls[0].requestOverride).toEqual({
      headers: { 'If-None-Match': '*' },
    });
  });

  test('without failIfExists no If-None-Match is sent', async () => {
    const state = newState('alpha');
    await putCIMDProfile({ profileId: 'a', profileData: plain, state });
    await putCIMDProfile({
      profileId: 'a',
      profileData: plain,
      failIfExists: false,
      state,
    });
    expect(calls[0].requestOverride).toEqual({});
    expect(calls[1].requestOverride).toEqual({});
  });
});

describe('errors', () => {
  const failure = new AxiosError(
    'Request failed with status code 404',
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: {} as never,
      data: { code: 404, reason: 'Not Found', message: 'Not Found' },
    }
  );

  test.each([
    ['getCIMDProfiles', (state) => getCIMDProfiles({ state })],
    ['getCIMDProfile', (state) => getCIMDProfile({ profileId: 'a', state })],
    [
      'putCIMDProfile',
      (state) => putCIMDProfile({ profileId: 'a', profileData: {}, state }),
    ],
    [
      'deleteCIMDProfile',
      (state) => deleteCIMDProfile({ profileId: 'a', state }),
    ],
    ['getCIMDProfileTemplate', (state) => getCIMDProfileTemplate({ state })],
    ['getCIMDProfileSchema', (state) => getCIMDProfileSchema({ state })],
  ])('%s lets the AxiosError of the server through', async (_name, call) => {
    nextFailure = failure;
    await expect(call(newState('alpha'))).rejects.toBe(failure);
  });
});
