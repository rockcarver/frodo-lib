/**
 * Run tests
 *
 *        npm run test:only BaseApi.curlirize.unit
 *
 * The curl command that `curlirize` prints for a request (frodo-lib#990).
 *
 * - Order: every instance that puts a credential on its requests with an
 *   interceptor builds the command after that interceptor ran, so the command
 *   has the `Authorization` or `Cookie` header. Since 4.8.0 the credential is
 *   resolved when the request is sent, and the command used to be built before.
 * - Masked by default: the header stays, its value is a placeholder; the same
 *   for the other credential headers, the values of the header overrides and the
 *   credential fields of a request body.
 * - Opt-in: `state.setCurlirizeSecrets(true)` prints the real values and warns,
 *   once in the life of the process.
 *
 * No network and no recordings: a stub adapter takes the request after all
 * interceptors ran; the last test uses the fake AM of the test support.
 */
import { jest } from '@jest/globals';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import StateImpl, { State } from '../shared/State';
import {
  generateAmApi,
  generateAmAuthApi,
  generateEnvApi,
  generateGovernanceApi,
  generateIdmApi,
  generateIdmSystemApi,
  generateLogApi,
  generateLogKeysApi,
  generateOauth2Api,
  generateReleaseApi,
  generateWSFedApi,
} from './BaseApi';

const BASE_URL = 'http://curlirize.example.test';
const FUTURE = () => Date.now() + 60 * 60 * 1000;
// made-up values: none of them is a credential
const SESSION = 'made-up-session-value';
const BEARER = 'eyJ.made-up-access-token';
const PF_BEARER = 'eyJ.made-up-pingfederate-token';
const EXCHANGED = 'eyJ.made-up-exchanged-token';

type Capture = { config?: AxiosRequestConfig };

function adapter(capture: Capture): any {
  return async (config: AxiosRequestConfig) => {
    capture.config = config;
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
}

type Output = { lines: string[]; printed: { message: any; type: string }[] };

/** A state that prints curl commands and everything else into arrays. */
function newState(): { state: State; output: Output } {
  const state = StateImpl({});
  const output: Output = { lines: [], printed: [] };
  state.setCurlirize(true);
  state.setCurlirizeHandler((message) => output.lines.push(message));
  state.setPrintHandler((message, type) =>
    output.printed.push({ message, type })
  );
  return { state, output };
}

function headerOf(config: AxiosRequestConfig, name: string): unknown {
  const headers = config.headers as any;
  return typeof headers?.get === 'function' ? headers.get(name) : headers[name];
}

const sessionCookie = (state: State) => {
  state.setCookieName('iPlanetDirectoryPro');
  state.setUserSessionTokenMeta({
    tokenId: SESSION,
    realm: '/',
    successUrl: '/',
    expires: FUTURE(),
  });
};
const bearer = (state: State) => {
  state.setUseBearerTokenForAmApis(true);
  state.setBearerTokenMeta({
    access_token: BEARER,
    token_type: 'Bearer',
    expires: FUTURE(),
    scope: 'fr:am:* fr:idm:*',
  } as any);
};
const pfBearer = (state: State) => {
  state.setPfBearerTokenMeta({
    access_token: PF_BEARER,
    token_type: 'Bearer',
    expires: FUTURE(),
    scope: 'fr:pingfederate:*',
  } as any);
};
const provider = (state: State) => {
  state.setAmCredentialProvider(async () => ({
    header: 'Authorization',
    value: `Bearer ${EXCHANGED}`,
  }));
};

type Variant = {
  name: string;
  /** builds the instance */
  make: (state: State, capture: Capture) => AxiosInstance;
  /** puts a credential into the state */
  setup: (state: State) => void;
  /** the credential header the interceptor adds */
  header: 'Authorization' | 'Cookie';
  /** the value the request is sent with */
  sent: string;
  /** the value in the masked command */
  masked: string;
  /** the secret that must not be in the masked command */
  secret: string;
};

const override = (capture: Capture) => ({
  requestOverride: { baseURL: BASE_URL, adapter: adapter(capture) },
});

// every generate*Api that attaches a credential interceptor, with every kind
// of credential its resolver can return
const VARIANTS: Variant[] = [
  {
    name: 'generateAmApi, session cookie',
    make: (state, capture) =>
      generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        ...override(capture),
      }),
    setup: sessionCookie,
    header: 'Cookie',
    sent: `iPlanetDirectoryPro=${SESSION}`,
    masked: 'iPlanetDirectoryPro=<redacted>',
    secret: SESSION,
  },
  {
    name: 'generateAmApi, bearer token',
    make: (state, capture) =>
      generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        ...override(capture),
      }),
    setup: bearer,
    header: 'Authorization',
    sent: `Bearer ${BEARER}`,
    masked: 'Bearer <redacted>',
    secret: BEARER,
  },
  {
    name: 'generateAmApi, credential provider (browser login)',
    make: (state, capture) =>
      generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        ...override(capture),
      }),
    setup: provider,
    header: 'Authorization',
    sent: `Bearer ${EXCHANGED}`,
    masked: 'Bearer <redacted>',
    secret: EXCHANGED,
  },
  {
    name: 'generateAmAuthApi, session cookie',
    make: (state, capture) =>
      generateAmAuthApi({ resource: {}, state, ...override(capture) }),
    setup: sessionCookie,
    header: 'Cookie',
    sent: `iPlanetDirectoryPro=${SESSION}`,
    masked: 'iPlanetDirectoryPro=<redacted>',
    secret: SESSION,
  },
  {
    name: 'generateAmAuthApi, bearer token',
    make: (state, capture) =>
      generateAmAuthApi({ resource: {}, state, ...override(capture) }),
    setup: bearer,
    header: 'Authorization',
    sent: `Bearer ${BEARER}`,
    masked: 'Bearer <redacted>',
    secret: BEARER,
  },
  {
    name: 'generateAmAuthApi, credential provider (browser login)',
    make: (state, capture) =>
      generateAmAuthApi({ resource: {}, state, ...override(capture) }),
    setup: provider,
    header: 'Authorization',
    sent: `Bearer ${EXCHANGED}`,
    masked: 'Bearer <redacted>',
    secret: EXCHANGED,
  },
  {
    name: 'generateIdmApi',
    make: (state, capture) =>
      generateIdmApi({ requiredScopes: [], state, ...override(capture) }),
    setup: bearer,
    header: 'Authorization',
    sent: `Bearer ${BEARER}`,
    masked: 'Bearer <redacted>',
    secret: BEARER,
  },
  {
    name: 'generateIdmSystemApi',
    make: (state, capture) =>
      generateIdmSystemApi({ requiredScopes: [], state, ...override(capture) }),
    setup: bearer,
    header: 'Authorization',
    sent: `Bearer ${BEARER}`,
    masked: 'Bearer <redacted>',
    secret: BEARER,
  },
  {
    name: 'generateEnvApi',
    make: (state, capture) =>
      generateEnvApi({
        resource: {},
        requiredScopes: [],
        state,
        ...override(capture),
      }),
    setup: bearer,
    header: 'Authorization',
    sent: `Bearer ${BEARER}`,
    masked: 'Bearer <redacted>',
    secret: BEARER,
  },
  {
    name: 'generateGovernanceApi',
    make: (state, capture) =>
      generateGovernanceApi({
        resource: {},
        requiredScopes: [],
        state,
        ...override(capture),
      }),
    setup: bearer,
    header: 'Authorization',
    sent: `Bearer ${BEARER}`,
    masked: 'Bearer <redacted>',
    secret: BEARER,
  },
  {
    name: 'generateWSFedApi (PingFederate)',
    make: (state, capture) =>
      generateWSFedApi({ requiredScopes: [], state, ...override(capture) }),
    setup: pfBearer,
    header: 'Authorization',
    sent: `Bearer ${PF_BEARER}`,
    masked: 'Bearer <redacted>',
    secret: PF_BEARER,
  },
];

describe('curlirize: instances that add the credential with an interceptor', () => {
  test.each(VARIANTS)(
    '1: $name: the command has the credential header, masked, and the request is sent with the real value',
    async (variant) => {
      const { state, output } = newState();
      variant.setup(state);
      const capture: Capture = {};
      await variant.make(state, capture).get('/whatever');

      expect(output.lines).toHaveLength(1);
      // the header is in the command, with the placeholder and without the secret
      expect(output.lines[0]).toContain(
        `-H "${variant.header}:${variant.masked}"`
      );
      expect(output.lines[0]).not.toContain(variant.secret);
      // and the request really carried the credential
      expect(headerOf(capture.config, variant.header)).toBe(variant.sent);
      // the command kept on the request config is the masked one too
      expect((capture.config as any).curlCommand).toBe(output.lines[0]);
      // masking is the default: no warning
      expect(output.printed.filter((p) => p.type === 'warn')).toEqual([]);
    }
  );

  test.each(VARIANTS)(
    '2: $name: with the opt-in the command has the real value',
    async (variant) => {
      const { state, output } = newState();
      state.setCurlirizeSecrets(true);
      variant.setup(state);
      const capture: Capture = {};
      await variant.make(state, capture).get('/whatever');

      expect(output.lines).toHaveLength(1);
      expect(output.lines[0]).toContain(
        `-H "${variant.header}:${variant.sent}"`
      );
      expect(output.lines[0]).not.toContain('<redacted>');
    }
  );

  test('3: an anonymous AM instance sends no credential and the command has none', async () => {
    const { state, output } = newState();
    sessionCookie(state);
    bearer(state);
    const capture: Capture = {};
    await generateAmApi({
      resource: {},
      requiredScopes: [],
      anonymous: true,
      state,
      ...override(capture),
    }).get('/serverinfo/*');
    await generateAmAuthApi({
      resource: {},
      anonymous: true,
      state,
      ...override(capture),
    }).get('/serverinfo/*');

    expect(output.lines).toHaveLength(2);
    for (const line of output.lines) {
      expect(line).not.toMatch(/Authorization|Cookie/);
    }
  });

  test('4: a credential header the caller set is masked, scheme kept', async () => {
    const { state, output } = newState();
    sessionCookie(state);
    await generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: {
        baseURL: BASE_URL,
        adapter: adapter({}),
        headers: { Authorization: 'Basic made-up-basic-value' },
      },
    }).get('/whatever');

    expect(output.lines[0]).toContain('-H "Authorization:Basic <redacted>"');
    // the cookie was not added: the explicit header wins, as before
    expect(output.lines[0]).not.toContain('Cookie');
    expect(output.lines[0]).not.toContain('made-up-basic-value');
  });

  test('5: the command is built once per request, also when the request is sent twice', async () => {
    const { state, output } = newState();
    bearer(state);
    const request = generateIdmApi({
      requiredScopes: [],
      state,
      ...override({}),
    });
    await request.get('/a');
    await request.get('/b');
    expect(output.lines).toHaveLength(2);
    expect(output.lines[0]).toContain('/a"');
    expect(output.lines[1]).toContain('/b"');
    for (const line of output.lines) {
      expect(line).toContain('-H "Authorization:Bearer <redacted>"');
    }
  });

  test('6: curlirize off prints no command and the credential is still sent', async () => {
    const { state, output } = newState();
    state.setCurlirize(false);
    bearer(state);
    const capture: Capture = {};
    await generateIdmApi({
      requiredScopes: [],
      state,
      ...override(capture),
    }).get('/a');
    expect(output.lines).toEqual([]);
    expect(headerOf(capture.config, 'Authorization')).toBe(`Bearer ${BEARER}`);
  });
});

describe('curlirize: instances with credentials in their static headers', () => {
  test('1: generateOauth2Api: session cookie and bearer token', async () => {
    const cookie = newState();
    sessionCookie(cookie.state);
    await generateOauth2Api({
      resource: {},
      state: cookie.state,
      ...override({}),
    }).get('/a');
    expect(cookie.output.lines[0]).toContain(
      '-H "Cookie:iPlanetDirectoryPro=<redacted>"'
    );
    expect(cookie.output.lines[0]).not.toContain(SESSION);

    const token = newState();
    bearer(token.state);
    await generateOauth2Api({
      resource: {},
      state: token.state,
      ...override({}),
    }).get('/a');
    expect(token.output.lines[0]).toContain(
      '-H "Authorization:Bearer <redacted>"'
    );
    expect(token.output.lines[0]).not.toContain(BEARER);
  });

  test('2: generateOauth2Api without authentication has no credential header', async () => {
    const { state, output } = newState();
    sessionCookie(state);
    await generateOauth2Api({
      resource: {},
      authenticate: false,
      state,
      ...override({}),
    }).get('/a');
    expect(output.lines[0]).not.toMatch(/Authorization|Cookie/);
  });

  test('3: generateLogKeysApi: bearer token', async () => {
    const { state, output } = newState();
    bearer(state);
    await generateLogKeysApi({
      state,
      requestOverride: { baseURL: BASE_URL, adapter: adapter({}) },
    }).get('/a');
    expect(output.lines[0]).toContain('-H "Authorization:Bearer <redacted>"');
    expect(output.lines[0]).not.toContain(BEARER);
  });

  test('4: generateLogApi: API key and secret', async () => {
    const { state, output } = newState();
    state.setLogApiKey('made-up-log-key');
    state.setLogApiSecret('made-up-log-secret');
    await generateLogApi({
      state,
      requestOverride: { baseURL: BASE_URL, adapter: adapter({}) },
    }).get('/a');
    expect(output.lines[0]).toContain('-H "X-API-Key:<redacted>"');
    expect(output.lines[0]).toContain('-H "X-API-Secret:<redacted>"');
    expect(output.lines[0]).not.toContain('made-up-log');

    const secrets = newState();
    secrets.state.setCurlirizeSecrets(true);
    secrets.state.setLogApiKey('made-up-log-key');
    secrets.state.setLogApiSecret('made-up-log-secret');
    await generateLogApi({
      state: secrets.state,
      requestOverride: { baseURL: BASE_URL, adapter: adapter({}) },
    }).get('/a');
    expect(secrets.output.lines[0]).toContain('-H "X-API-Key:made-up-log-key"');
    expect(secrets.output.lines[0]).toContain(
      '-H "X-API-Secret:made-up-log-secret"'
    );
  });

  test('5: generateReleaseApi has no credential and the command shows the other headers', async () => {
    const { state, output } = newState();
    sessionCookie(state);
    bearer(state);
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state,
      requestOverride: { adapter: adapter({}) },
    }).get('/releases');
    expect(output.lines[0]).not.toMatch(/Authorization|Cookie|<redacted>/);
    expect(output.lines[0]).toContain('-H "Content-Type:application/json"');
    expect(output.lines[0]).toContain('-H "User-Agent:');
  });
});

describe('curlirize: header overrides', () => {
  // which override maps each generator merges into its headers
  const GENERATORS: {
    name: string;
    make: (state: State, capture: Capture) => AxiosInstance;
    setup: (state: State) => void;
    authentication: boolean;
    configuration: boolean;
  }[] = [
    {
      name: 'generateAmApi',
      make: (state, capture) =>
        generateAmApi({
          resource: {},
          requiredScopes: [],
          state,
          ...override(capture),
        }),
      setup: sessionCookie,
      authentication: true,
      configuration: true,
    },
    {
      name: 'generateAmAuthApi',
      make: (state, capture) =>
        generateAmAuthApi({ resource: {}, state, ...override(capture) }),
      setup: sessionCookie,
      authentication: true,
      configuration: false,
    },
    {
      name: 'generateOauth2Api',
      make: (state, capture) =>
        generateOauth2Api({ resource: {}, state, ...override(capture) }),
      setup: sessionCookie,
      authentication: true,
      configuration: false,
    },
    {
      name: 'generateIdmApi',
      make: (state, capture) =>
        generateIdmApi({ requiredScopes: [], state, ...override(capture) }),
      setup: bearer,
      authentication: true,
      configuration: true,
    },
    {
      name: 'generateIdmSystemApi',
      make: (state, capture) =>
        generateIdmSystemApi({
          requiredScopes: [],
          state,
          ...override(capture),
        }),
      setup: bearer,
      authentication: true,
      configuration: false,
    },
    {
      name: 'generateLogKeysApi',
      make: (state, capture) =>
        generateLogKeysApi({
          state,
          requestOverride: { baseURL: BASE_URL, adapter: adapter(capture) },
        }),
      setup: bearer,
      authentication: true,
      configuration: false,
    },
    {
      name: 'generateEnvApi',
      make: (state, capture) =>
        generateEnvApi({
          resource: {},
          requiredScopes: [],
          state,
          ...override(capture),
        }),
      setup: bearer,
      authentication: true,
      configuration: false,
    },
    {
      name: 'generateGovernanceApi',
      make: (state, capture) =>
        generateGovernanceApi({
          resource: {},
          requiredScopes: [],
          state,
          ...override(capture),
        }),
      setup: bearer,
      authentication: true,
      configuration: true,
    },
    {
      name: 'generateWSFedApi',
      make: (state, capture) =>
        generateWSFedApi({ requiredScopes: [], state, ...override(capture) }),
      setup: pfBearer,
      authentication: true,
      configuration: true,
    },
  ];

  test.each(GENERATORS)(
    '1: $name: the values of the override maps are masked, the names are shown',
    async (generator) => {
      const { state, output } = newState();
      generator.setup(state);
      state.setAuthenticationHeaderOverrides({
        'X-Gateway-Key': 'made-up-gateway-value',
      });
      state.setConfigurationHeaderOverrides({
        // the case of the name does not matter
        'x-Tenant-Selector': 'made-up-tenant-value',
      });
      await generator.make(state, {}).get('/a');

      const line = output.lines[0];
      expect(line).not.toContain('made-up-gateway-value');
      expect(line).not.toContain('made-up-tenant-value');
      if (generator.authentication) {
        expect(line).toContain('-H "X-Gateway-Key:<redacted>"');
      }
      if (generator.configuration) {
        expect(line).toContain('-H "x-Tenant-Selector:<redacted>"');
      } else {
        expect(line).not.toContain('x-Tenant-Selector');
      }
    }
  );

  test('2: with the opt-in the override values are printed', async () => {
    const { state, output } = newState();
    state.setCurlirizeSecrets(true);
    sessionCookie(state);
    state.setAuthenticationHeaderOverrides({ 'X-Gateway-Key': 'made-up-a' });
    state.setConfigurationHeaderOverrides({ 'X-Tenant-Selector': 'made-up-c' });
    await generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      ...override({}),
    }).get('/a');
    expect(output.lines[0]).toContain('-H "X-Gateway-Key:made-up-a"');
    expect(output.lines[0]).toContain('-H "X-Tenant-Selector:made-up-c"');
  });

  test('3: the override maps are read for every command, not when the instance is built', async () => {
    const { state, output } = newState();
    sessionCookie(state);
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      ...override({}),
    });
    await request.get('/a', { headers: { 'X-Late-Key': 'made-up-late' } });
    expect(output.lines[0]).toContain('-H "X-Late-Key:made-up-late"');
    // the name joins the override map after the instance was built
    state.setAuthenticationHeaderOverrides({ 'X-Late-Key': 'made-up-late' });
    await request.get('/b', { headers: { 'X-Late-Key': 'made-up-late' } });
    expect(output.lines[1]).toContain('-H "X-Late-Key:<redacted>"');
  });

  test('4: headers that are not credentials stay readable', async () => {
    const { state, output } = newState();
    sessionCookie(state);
    await generateAmApi({
      resource: { apiVersion: 'protocol=2.0,resource=1.0' },
      requiredScopes: [],
      state,
      ...override({}),
    }).get('/a', {
      headers: { 'X-OpenAM-Username': 'demo', 'X-Request-Id': 'abc' },
    });
    const line = output.lines[0];
    expect(line).toContain('-H "Accept-API-Version:protocol=2.0,resource=1.0"');
    expect(line).toContain('-H "Content-Type:application/json"');
    expect(line).toContain('-H "X-OpenAM-Username:demo"');
    expect(line).toContain('-H "X-Request-Id:abc"');
  });

  test.each([
    ['Proxy-Authorization', 'Basic made-up-proxy-value', 'Basic <redacted>'],
    ['X-OpenAM-Password', 'made-up-password', '<redacted>'],
    ['X-OpenIDM-Password', 'made-up-password', '<redacted>'],
    ['x-api-key', 'made-up-key', '<redacted>'],
    ['Api-Key', 'made-up-key', '<redacted>'],
    ['Ocp-Apim-Subscription-Key', 'made-up-key', '<redacted>'],
    ['Cookie', 'a=made-up-1; b=made-up-2', 'a=<redacted>; b=<redacted>'],
  ])('5: the header %s is masked', async (name, value, placeholder) => {
    const { state, output } = newState();
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state,
      requestOverride: {
        adapter: adapter({}),
        headers: { [name]: value },
      },
    }).get('/a');
    expect(output.lines[0]).toContain(`-H "${name}:${placeholder}"`);
    expect(output.lines[0]).not.toContain('made-up');
  });
});

describe('curlirize: the session token in a header named like the session cookie', () => {
  test('1: the default name is on the shared list, the name of a deployment is read from the state', async () => {
    const defaults = newState();
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state: defaults.state,
      requestOverride: {
        adapter: adapter({}),
        headers: { iPlanetDirectoryPro: 'made-up-session-token' },
      },
    }).post('/sessions?_action=logout');
    expect(defaults.output.lines[0]).toContain(
      '-H "iPlanetDirectoryPro:<redacted>"'
    );
    expect(defaults.output.lines[0]).not.toContain('made-up-session-token');

    const named = newState();
    named.state.setCookieName('a1b2c3d4e5');
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state: named.state,
      requestOverride: {
        adapter: adapter({}),
        headers: { A1B2c3d4E5: 'made-up-session-token' },
      },
    }).post('/sessions?_action=logout');
    expect(named.output.lines[0]).toContain('-H "A1B2c3d4E5:<redacted>"');
    expect(named.output.lines[0]).not.toContain('made-up-session-token');

    // without that cookie name the header is an ordinary one
    const other = newState();
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state: other.state,
      requestOverride: {
        adapter: adapter({}),
        headers: { 'X-Request-Id': 'abc' },
      },
    }).post('/a');
    expect(other.output.lines[0]).toContain('-H "X-Request-Id:abc"');
  });

  test('2: with the opt-in it is printed, and counts as a credential', async () => {
    const { state, output } = newState();
    state.setCurlirizeSecrets(true);
    state.setCookieName('a1b2c3d4e5');
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state,
      requestOverride: {
        adapter: adapter({}),
        headers: { a1b2c3d4e5: 'made-up-session-token' },
      },
    }).post('/a');
    expect(output.lines[0]).toContain('-H "a1b2c3d4e5:made-up-session-token"');
  });
});

describe('curlirize: request bodies', () => {
  async function post(
    body: unknown,
    options: { secrets?: boolean; headers?: Record<string, string> } = {}
  ) {
    const { state, output } = newState();
    if (options.secrets) state.setCurlirizeSecrets(true);
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state,
      requestOverride: {
        adapter: adapter({}),
        headers: options.headers,
      },
    }).post('/a', body);
    return output;
  }

  test('1: a JSON body: credential fields are masked, the rest stays', async () => {
    const output = await post({
      userName: 'demo',
      password: 'made-up-password',
      nested: { client_secret: 'made-up-secret', clientId: 'cli' },
      list: [{ access_token: 'made-up-token' }],
    });
    expect(output.lines[0]).toContain(
      `--data '{"userName":"demo","password":"<redacted>","nested":{"client_secret":"<redacted>","clientId":"cli"},"list":[{"access_token":"<redacted>"}]}'`
    );
    expect(output.lines[0]).not.toContain('made-up');
  });

  test('2: the answer to a password callback of a journey is masked', async () => {
    const output = await post({
      authId: 'made-up-auth-id',
      callbacks: [
        {
          type: 'NameCallback',
          output: [{ name: 'prompt', value: 'User Name' }],
          input: [{ name: 'IDToken1', value: 'demo' }],
        },
        {
          type: 'PasswordCallback',
          output: [{ name: 'prompt', value: 'Password' }],
          input: [{ name: 'IDToken2', value: 'made-up-password' }],
        },
      ],
    });
    expect(output.lines[0]).toContain(
      '"input":[{"name":"IDToken1","value":"demo"}]'
    );
    expect(output.lines[0]).toContain(
      '"input":[{"name":"IDToken2","value":"<redacted>"}]'
    );
    expect(output.lines[0]).not.toContain('made-up-password');
  });

  test('3: a form-encoded body: the assertion and the code are masked, the rest stays', async () => {
    const output = await post(
      'assertion=made-up.jwt.value&client_id=service-account&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&scope=fr:idm:*',
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    expect(output.lines[0]).toContain(
      `--data 'assertion=<redacted>&client_id=service-account&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&scope=fr:idm:*'`
    );
    const code = await post(
      'redirect_uri=http://localhost&grant_type=authorization_code&code=made-up-code&code_verifier=made-up-verifier'
    );
    expect(code.lines[0]).toContain('code=<redacted>&code_verifier=<redacted>');
    expect(code.lines[0]).toContain('redirect_uri=http://localhost');
    expect(code.lines[0]).not.toContain('made-up');
  });

  test('3b: the authorization request: the csrf field is the session token', async () => {
    const output = await post(
      'redirect_uri=http://localhost/cb&scope=openid&response_type=code&client_id=cli&csrf=made-up-session-token&decision=allow'
    );
    expect(output.lines[0]).toContain(
      'client_id=cli&csrf=<redacted>&decision=allow'
    );
    expect(output.lines[0]).not.toContain('made-up-session-token');
  });

  test('4: a body that is a JSON string is masked too', async () => {
    const output = await post('{"password":"made-up-password","a":1}');
    expect(output.lines[0]).toContain(
      `--data '{"password":"<redacted>","a":1}'`
    );
  });

  test('5: a body without credentials is printed as it is', async () => {
    const output = await post({ name: 'demo', code: 'DE', secretCount: 3 });
    expect(output.lines[0]).toContain(
      `--data '{"name":"demo","code":"DE","secretCount":3}'`
    );
  });

  test('6: the body the request is sent with is not changed', async () => {
    const body = { password: 'made-up-password' };
    const { state } = newState();
    const capture: Capture = {};
    await generateReleaseApi({
      baseUrl: BASE_URL,
      state,
      requestOverride: { adapter: adapter(capture) },
    }).post('/a', body);
    expect(body).toEqual({ password: 'made-up-password' });
    expect(JSON.parse(capture.config.data as string)).toEqual(body);
  });

  test('7: with the opt-in the body is printed as it is', async () => {
    const output = await post(
      { password: 'made-up-password' },
      { secrets: true }
    );
    expect(output.lines[0]).toContain(
      `--data '{"password":"made-up-password"}'`
    );
    const form = await post('assertion=made-up.jwt.value&client_id=x', {
      secrets: true,
    });
    expect(form.lines[0]).toContain(
      `--data 'assertion=made-up.jwt.value&client_id=x'`
    );
  });
});

describe('curlirize: the warning of the opt-in', () => {
  // The warning is given once in the life of the process, so each cell loads
  // a fresh copy of the module. (jest.isolateModulesAsync hits a Jest ESM
  // module-cache bug with BaseApi's dependency graph, see
  // BaseApi.agentConfig.unit.test.ts.)
  async function fresh() {
    jest.resetModules();
    const api = await import('./BaseApi');
    const { default: stateFactory } = await import('../shared/State');
    return { api, stateFactory };
  }

  function warnings(output: Output) {
    return output.printed.filter((p) => p.type === 'warn');
  }

  test('1: one warning line, before the first command with a credential, and no second one', async () => {
    const { api, stateFactory } = await fresh();
    const state = stateFactory({});
    const output: Output = { lines: [], printed: [] };
    const order: string[] = [];
    state.setCurlirize(true);
    state.setCurlirizeSecrets(true);
    state.setCurlirizeHandler((message) => {
      output.lines.push(message);
      order.push('command');
    });
    state.setPrintHandler((message, type) => {
      output.printed.push({ message, type });
      if (type === 'warn') order.push('warning');
    });
    bearer(state);
    const request = api.generateIdmApi({
      requiredScopes: [],
      state,
      ...override({}),
    });
    await request.get('/a');
    await request.get('/b');
    // another instance of the same process does not warn again
    await api
      .generateEnvApi({
        resource: {},
        requiredScopes: [],
        state,
        ...override({}),
      })
      .get('/c');

    expect(output.lines).toHaveLength(3);
    expect(warnings(output)).toHaveLength(1);
    expect(warnings(output)[0].message).toMatch(/valid credentials/);
    expect(order).toEqual(['warning', 'command', 'command', 'command']);
  });

  test('2: no warning for masked output', async () => {
    const { api, stateFactory } = await fresh();
    const state = stateFactory({});
    const output: Output = { lines: [], printed: [] };
    state.setCurlirize(true);
    state.setCurlirizeHandler((message) => output.lines.push(message));
    state.setPrintHandler((message, type) =>
      output.printed.push({ message, type })
    );
    bearer(state);
    await api
      .generateIdmApi({ requiredScopes: [], state, ...override({}) })
      .get('/a');
    expect(output.lines).toHaveLength(1);
    expect(warnings(output)).toEqual([]);
  });

  test('3: no warning, and the flag stays unused, for a command without a credential', async () => {
    const { api, stateFactory } = await fresh();
    const state = stateFactory({});
    const output: Output = { lines: [], printed: [] };
    state.setCurlirize(true);
    state.setCurlirizeSecrets(true);
    state.setCurlirizeHandler((message) => output.lines.push(message));
    state.setPrintHandler((message, type) =>
      output.printed.push({ message, type })
    );
    bearer(state);
    await api
      .generateAmApi({
        resource: {},
        requiredScopes: [],
        anonymous: true,
        state,
        ...override({}),
      })
      .get('/serverinfo/*');
    expect(output.lines).toHaveLength(1);
    expect(warnings(output)).toEqual([]);

    // the first command with a credential warns
    await api
      .generateIdmApi({ requiredScopes: [], state, ...override({}) })
      .get('/a');
    expect(warnings(output)).toHaveLength(1);
  });

  test('3b: an empty credential header is no credential: no warning', async () => {
    const { api, stateFactory } = await fresh();
    const state = stateFactory({});
    const output: Output = { lines: [], printed: [] };
    state.setCurlirize(true);
    state.setCurlirizeSecrets(true);
    state.setCurlirizeHandler((message) => output.lines.push(message));
    state.setPrintHandler((message, type) =>
      output.printed.push({ message, type })
    );
    await api
      .generateReleaseApi({
        baseUrl: BASE_URL,
        state,
        requestOverride: {
          adapter: adapter({}),
          headers: { 'X-API-Key': '', Authorization: '' },
        },
      })
      .get('/a');
    expect(output.lines).toHaveLength(1);
    expect(warnings(output)).toEqual([]);
  });

  test('4: a body with a credential warns too', async () => {
    const { api, stateFactory } = await fresh();
    const state = stateFactory({});
    const output: Output = { lines: [], printed: [] };
    state.setCurlirize(true);
    state.setCurlirizeSecrets(true);
    state.setCurlirizeHandler((message) => output.lines.push(message));
    state.setPrintHandler((message, type) =>
      output.printed.push({ message, type })
    );
    await api
      .generateReleaseApi({
        baseUrl: BASE_URL,
        state,
        requestOverride: { adapter: adapter({}) },
      })
      .post('/a', { password: 'made-up-password' });
    expect(output.lines[0]).toContain('"password":"made-up-password"');
    expect(warnings(output)).toHaveLength(1);
  });
});

describe('curlirize: the setting', () => {
  test('1: is off by default and for every new state', () => {
    expect(StateImpl({}).getCurlirizeSecrets()).toBe(false);
    expect(StateImpl({}).getCurlirize()).toBeFalsy();
  });

  test('2: is not read from the environment', () => {
    const before = process.env.FRODO_CURLIRIZE_SECRETS;
    process.env.FRODO_CURLIRIZE_SECRETS = 'true';
    try {
      expect(StateImpl({}).getCurlirizeSecrets()).toBe(false);
    } finally {
      if (before === undefined) delete process.env.FRODO_CURLIRIZE_SECRETS;
      else process.env.FRODO_CURLIRIZE_SECRETS = before;
    }
  });

  test('3: is set per state and reset by reset()', () => {
    const a = StateImpl({});
    const b = StateImpl({});
    a.setCurlirizeSecrets(true);
    expect(a.getCurlirizeSecrets()).toBe(true);
    expect(b.getCurlirizeSecrets()).toBe(false);
    a.reset();
    expect(a.getCurlirizeSecrets()).toBe(false);
  });
});

describe('curlirize: login and a renewed credential (fake AM)', () => {
  let am: FakeAm;
  beforeEach(async () => {
    am = await startFakeAm();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await am.close();
  });

  test('1: the commands of a real login and of the request after it', async () => {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
    const output: Output = { lines: [], printed: [] };
    frodo.state.setUseTokenCache(false);
    frodo.state.setUsername('someone');
    frodo.state.setPassword('made-up-login-password');
    frodo.state.setCurlirize(true);
    frodo.state.setCurlirizeHandler((message) => output.lines.push(message));
    frodo.state.setPrintHandler((message, type) =>
      output.printed.push({ message, type })
    );

    await frodo.login.getTokens(false, true);
    await frodo.authn.journey.readJourneys();

    const all = output.lines.join('\n');
    // the login sends the user name in the clear and the password masked
    expect(all).toContain('-H "X-OpenAM-Username:someone"');
    expect(all).toContain('-H "X-OpenAM-Password:<redacted>"');
    expect(all).not.toContain('made-up-login-password');
    // the request after the login has the session cookie, masked
    const journeys = output.lines.find((line) => line.includes('realm-config'));
    expect(journeys).toBeDefined();
    expect(journeys).toContain('-H "Cookie:iPlanetDirectoryPro=<redacted>"');
    expect(output.printed.filter((p) => p.type === 'warn')).toEqual([]);
  });

  test('2: a request sent again with a renewed credential prints its command again, and the 401 it replaced is not an error', async () => {
    const realNow = Date.now.bind(Date);
    let offset = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
    const output: Output = { lines: [], printed: [] };
    frodo.state.setUseTokenCache(false);
    frodo.state.setUsername('someone');
    frodo.state.setPassword('made-up-login-password');
    await frodo.login.getTokens(false, true);
    offset += 31_000;
    frodo.state.setCurlirize(true);
    frodo.state.setCurlirizeHandler((message) => output.lines.push(message));
    frodo.state.setPrintHandler((message, type) =>
      output.printed.push({ message, type })
    );

    am.revokeAll();
    await frodo.authn.journey.readJourneys();

    const sent = output.lines.filter((line) => line.includes('realm-config'));
    // rejected once, then sent again with the new session: both have the header
    expect(sent).toHaveLength(2);
    for (const line of sent) {
      expect(line).toContain('-H "Cookie:iPlanetDirectoryPro=<redacted>"');
    }
    // the response side was registered after the interceptor that renews the
    // credential: the 401 that was replaced is not printed as an error
    const messages = output.printed.map((p) => String(p.message));
    expect(messages.filter((m) => m.startsWith('401'))).toEqual([]);
    expect(output.printed.filter((p) => p.type === 'error')).toEqual([]);
  });
});
