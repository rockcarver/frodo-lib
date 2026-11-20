/**
 * Run tests
 *
 *        npm run test:only BaseApi.errorSerialization.unit
 *
 * The error of a request that failed through an instance of `BaseApi.ts`: it
 * writes itself (`JSON.stringify`, `util.inspect`, `console.log`) as a view and
 * not as the configuration of the request, through every instance generator,
 * for every kind of failure (an answer, no answer, a request that is sent again),
 * and the configuration stays on the error for the code that sends the request
 * again. No network except two requests to the loopback interface, and no
 * recordings: a stub adapter takes the request after all interceptors ran and
 * answers with a failure. The replays are in
 * `BaseApi.errorSerialization.replays.unit.test.ts`.
 */
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import {
  AxiosError,
  AxiosHeaders,
  CanceledError,
  type AxiosAdapter,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { FrodoError } from '../ops/FrodoError';
import StateImpl, { State } from '../shared/State';
import {
  allForms,
  MARKER_A,
  MARKER_B,
  MARKER_C,
  MARKER_D,
} from '../test/utils/SerializationForms';
import { stubAdapter } from '../test/utils/StubAdapter';
import * as BaseApi from './BaseApi';
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

const BASE_URL = 'http://serialization.example.test';
const FUTURE = () => Date.now() + 60 * 60 * 1000;
const MARKER_E = 'MARKER-E-0001';
const MARKER_F = 'MARKER-F-0001';
const MARKER_G = 'MARKER-G-0001';

const withAuthorization = (state: State) => {
  state.setUseBearerTokenForAmApis(true);
  state.setBearerTokenMeta({
    access_token: MARKER_A,
    token_type: 'Bearer',
    expires: FUTURE(),
    scope: 'fr:am:* fr:idm:*',
  } as never);
};
const cookie = (state: State) => {
  state.setCookieName('iPlanetDirectoryPro');
  state.setUserSessionTokenMeta({
    tokenId: MARKER_B,
    realm: '/',
    successUrl: '/',
    expires: FUTURE(),
  });
};
const withSecondAuthorization = (state: State) => {
  state.setPfBearerTokenMeta({
    access_token: MARKER_E,
    token_type: 'Bearer',
    expires: FUTURE(),
    scope: 'fr:pingfederate:*',
  } as never);
};
const withProvider = (state: State) => {
  state.setAmCredentialProvider(async () => ({
    header: 'Authorization',
    value: `Bearer ${MARKER_F}`,
  }));
};
const logKeys = (state: State) => {
  state.setLogApiKey(MARKER_A);
  state.setLogApiSecret(MARKER_D);
};

type Variant = {
  name: string;
  /** the name of the exported generator, the structural test lists them */
  generator: string;
  make: (state: State, adapter: unknown) => AxiosInstance;
  setup: (state: State) => void;
  /** the header the request goes out with, and the values that must not appear */
  header: string;
  markers: string[];
};

const request = (adapter: unknown) => ({ baseURL: BASE_URL, adapter });

const VARIANTS: Variant[] = [
  {
    name: 'generateAmApi, session cookie',
    generator: 'generateAmApi',
    make: (state, adapter) =>
      generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: cookie,
    header: 'Cookie',
    markers: [MARKER_B],
  },
  {
    name: 'generateAmApi, Authorization header',
    generator: 'generateAmApi',
    make: (state, adapter) =>
      generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    name: 'generateAmApi, header from a provider',
    generator: 'generateAmApi',
    make: (state, adapter) =>
      generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withProvider,
    header: 'Authorization',
    markers: [MARKER_F],
  },
  {
    name: 'generateAmAuthApi, Authorization header',
    generator: 'generateAmAuthApi',
    make: (state, adapter) =>
      generateAmAuthApi({
        resource: {},
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    name: 'generateOauth2Api, Authorization header',
    generator: 'generateOauth2Api',
    make: (state, adapter) =>
      generateOauth2Api({
        resource: {},
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    name: 'generateIdmApi',
    generator: 'generateIdmApi',
    make: (state, adapter) =>
      generateIdmApi({
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    name: 'generateIdmSystemApi',
    generator: 'generateIdmSystemApi',
    make: (state, adapter) =>
      generateIdmSystemApi({
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    name: 'generateEnvApi',
    generator: 'generateEnvApi',
    make: (state, adapter) =>
      generateEnvApi({
        resource: {},
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    name: 'generateGovernanceApi',
    generator: 'generateGovernanceApi',
    make: (state, adapter) =>
      generateGovernanceApi({
        resource: {},
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    name: 'generateWSFedApi (PingFederate)',
    generator: 'generateWSFedApi',
    make: (state, adapter) =>
      generateWSFedApi({
        requiredScopes: [],
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withSecondAuthorization,
    header: 'Authorization',
    markers: [MARKER_E],
  },
  {
    name: 'generateLogApi (key and secret)',
    generator: 'generateLogApi',
    make: (state, adapter) =>
      generateLogApi({ state, requestOverride: request(adapter) as never }),
    setup: logKeys,
    header: 'X-API-Secret',
    markers: [MARKER_A, MARKER_D],
  },
  {
    name: 'generateLogKeysApi (Authorization header)',
    generator: 'generateLogKeysApi',
    make: (state, adapter) =>
      generateLogKeysApi({
        state,
        requestOverride: request(adapter) as never,
      }),
    setup: withAuthorization,
    header: 'Authorization',
    markers: [MARKER_A],
  },
  {
    // no value of its own: the request carries a header that the caller gave it
    name: 'generateReleaseApi (a header of the request)',
    generator: 'generateReleaseApi',
    make: (state, adapter) =>
      generateReleaseApi({
        baseUrl: BASE_URL,
        state,
        requestOverride: {
          adapter,
          headers: { Authorization: `Bearer ${MARKER_A}` },
        } as never,
      }),
    setup: () => undefined,
    header: 'Authorization',
    markers: [MARKER_A],
  },
];

/** Searches every form of the value for the markers and throws where one is. */
function expectNoMarker(value: unknown, markers: string[]) {
  for (const [form, text] of Object.entries(allForms(value))) {
    for (const marker of markers) {
      if (text.includes(marker)) {
        throw new Error(`${marker} is in the form '${form}':\n${text}`);
      }
    }
  }
}

/** Sends a request that the stub answers with a failure and returns the error. */
async function failed(
  variant: Variant,
  prepare: (state: State) => void = () => undefined,
  answers = [{ status: 409, data: { code: 409, message: 'conflict' } }]
): Promise<{ error: AxiosError; state: State; requests: unknown[] }> {
  const state = StateImpl({});
  variant.setup(state);
  prepare(state);
  const { adapter, requests } = stubAdapter(answers);
  const error = await variant
    .make(state, adapter)
    .delete('/things/1?_action=remove', { data: { name: 'thing' } })
    .then(
      () => {
        throw new Error('the request was meant to fail');
      },
      (caught: AxiosError) => caught
    );
  return { error, state, requests };
}

describe('the instance generators of BaseApi', () => {
  test('1: every exported generator is tested here, and creates its instance through createAxiosInstance', () => {
    const exported = Object.keys(BaseApi)
      .filter((name) => /^generate.*Api$/.test(name))
      .sort();
    expect(exported).toHaveLength(11);
    expect(
      [...new Set(VARIANTS.map((variant) => variant.generator))].sort()
    ).toEqual(exported);
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'api', 'BaseApi.ts'),
      'utf8'
    );
    for (const name of exported) {
      const start = source.indexOf(`export function ${name}(`);
      const end = source.indexOf('\n}\n', start);
      expect(source.slice(start, end)).toContain('createAxiosInstance(');
    }
  });

  test('2: axios.create is called in createAxiosInstance and nowhere else in the library', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'test' && entry.name !== 'node_modules')
            walk(full);
        } else if (
          /\.ts$/.test(entry.name) &&
          !/\.test\.ts$/.test(entry.name)
        ) {
          const text = fs.readFileSync(full, 'utf8');
          if (/\baxios\.create\(|\bnew Axios\(/.test(text)) found.push(full);
        }
      }
    };
    walk(path.join(process.cwd(), 'src'));
    expect(found.map((file) => path.relative(process.cwd(), file))).toEqual([
      path.join('src', 'api', 'BaseApi.ts'),
    ]);
    const source = fs.readFileSync(found[0], 'utf8');
    expect(source.match(/\baxios\.create\(/g)).toHaveLength(1);
    const create = source.indexOf('axios.create(');
    expect(
      source.lastIndexOf('function createAxiosInstance(', create)
    ).toBeGreaterThan(source.lastIndexOf('\n}\n', create));
  });
});

describe('the error of a request that failed with an answer', () => {
  test.each(VARIANTS)(
    '1: $name: no form writes the request configuration, the config still holds it',
    async (variant) => {
      const { error } = await failed(variant);
      expectNoMarker(error, variant.markers);
      // the header is in the view with its name, without its value
      const view = JSON.parse(JSON.stringify(error));
      expect(Object.keys(view.headers)).toContain(variant.header);
      expect(view).toMatchObject({
        name: 'AxiosError',
        status: 409,
        method: 'DELETE',
        url: `${BASE_URL}/things/1?_action=remove`,
        response: { status: 409, data: { code: 409, message: 'conflict' } },
      });
      // the config is what the request was sent with: a request that is sent again uses it
      const headers = error.config.headers as unknown as {
        get(name: string): unknown;
      };
      expect(String(headers.get(variant.header))).toContain(
        variant.markers[variant.markers.length - 1]
      );
    }
  );

  test.each(VARIANTS)(
    '2: $name: a FrodoError that wraps the error is written the same way',
    async (variant) => {
      const { error } = await failed(variant);
      const wrapped = new FrodoError('Error in a request', error);
      expectNoMarker(wrapped, variant.markers);
      expect(JSON.parse(JSON.stringify(wrapped)).originalErrors[0].status).toBe(
        409
      );
    }
  );

  test('3: the values of the header overrides of the state, authentication and configuration, are replaced in any case, their names stay', async () => {
    const authentication = [
      'X-Tenant-Access',
      'x-tenant-access-low',
      'X-TENANT-ACCESS-UP',
    ];
    const configuration = [
      'X-Tenant-Setting',
      'x-tenant-setting-low',
      'X-TENANT-SETTING-UP',
    ];
    const { error } = await failed(VARIANTS[1], (state) => {
      state.setAuthenticationHeaderOverrides(
        Object.fromEntries(authentication.map((name) => [name, MARKER_G]))
      );
      state.setConfigurationHeaderOverrides(
        Object.fromEntries(configuration.map((name) => [name, MARKER_G]))
      );
    });
    expectNoMarker(error, [MARKER_G]);
    const view = JSON.parse(JSON.stringify(error));
    for (const name of [...authentication, ...configuration]) {
      expect(view.headers[name]).toBe('<redacted>');
    }
  });

  test('4: a header named like the session cookie is written with its value replaced', async () => {
    const state = StateImpl({});
    cookie(state);
    state.setCookieName('customSession');
    const { adapter } = stubAdapter([{ status: 500, data: {} }]);
    const error = await generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: request(adapter) as never,
    })
      .delete('/things/1', { headers: { customSession: MARKER_B } })
      .catch((caught: AxiosError) => caught);
    expectNoMarker(error, [MARKER_B]);
    expect(JSON.parse(JSON.stringify(error)).headers.customSession).toBe(
      '<redacted>'
    );
  });

  test('5: every error of a request that is sent again by the retry is written the same way', async () => {
    const { error, requests } = await failed(
      VARIANTS[1],
      (state) =>
        state.setAxiosRetryConfig({
          retries: 2,
          retryDelay: () => 0,
          retryCondition: () => true,
        }),
      [{ status: 500, data: { message: 'fails' } }]
    );
    expect(requests).toHaveLength(3);
    expectNoMarker(error, [MARKER_A]);
  });

  test('6: a request body with a password is written with the password replaced', async () => {
    const state = StateImpl({});
    withAuthorization(state);
    const { adapter } = stubAdapter([{ status: 400, data: {} }]);
    const error = await generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: request(adapter) as never,
    })
      .post('/login', { userName: 'admin', password: MARKER_D })
      .catch((caught: AxiosError) => caught);
    expectNoMarker(error, [MARKER_D]);
    // axios has turned the object into its JSON text by the time the adapter takes it
    expect(JSON.parse(JSON.parse(JSON.stringify(error)).data)).toEqual({
      userName: 'admin',
      password: '<redacted>',
    });
  });

  test('7: a request that succeeds is not touched', async () => {
    const state = StateImpl({});
    withAuthorization(state);
    const { adapter } = stubAdapter([{ status: 200, data: { ok: true } }]);
    const response = await generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: request(adapter) as never,
    }).get('/things');
    expect(response.data).toEqual({ ok: true });
    expect(JSON.stringify(response.data)).toBe('{"ok":true}');
  });

  test('8: the one error object reaches the caller, with its response and request', async () => {
    const { error } = await failed(VARIANTS[1]);
    expect(error.isAxiosError).toBe(true);
    expect(error.response?.status).toBe(409);
    expect(error.response?.config).toBe(error.config);
    expect(typeof error.toJSON).toBe('function');
  });

  test('9: config, request and response are readable by name and are not enumerable', async () => {
    const { error } = await failed(VARIANTS[1]);
    expect(error.config?.url).toContain('/things/1');
    expect(error.response?.status).toBe(409);
    for (const name of ['config', 'request', 'response']) {
      expect(Object.keys(error)).not.toContain(name);
    }
    expectNoMarker({ ...error }, [MARKER_A]);
    expectNoMarker(Object.assign({}, error), [MARKER_A]);
  });

  test('10: an answer that redirects is written without what its headers carry', async () => {
    // the answer of a request that does not follow redirects: an error that has the response
    const redirect: AxiosAdapter = async (config) => {
      throw new AxiosError(
        'Request failed with status code 302',
        'ERR_BAD_RESPONSE',
        config,
        {},
        {
          status: 302,
          statusText: 'Found',
          headers: new AxiosHeaders({
            Location: `http://127.0.0.1:1/cb?code=${MARKER_C}&state=abc#access_token=${MARKER_G}`,
            'WWW-Authenticate': `Bearer realm="${MARKER_D}"`,
            'X-Custom-Name': MARKER_E,
            'Content-Type': 'text/html',
          }),
          config,
          data: '<html></html>',
        }
      );
    };
    const state = StateImpl({});
    withAuthorization(state);
    const error = await VARIANTS[1]
      .make(state, redirect)
      .get('/cb')
      .catch((caught: AxiosError) => caught);
    const markers = [MARKER_C, MARKER_G, MARKER_D, MARKER_E];
    expectNoMarker(error, markers);
    expectNoMarker(new FrodoError('Error in a request', error), markers);
    // the error stays what the library reads: the raw header
    expect(
      String((error.response?.headers as AxiosHeaders).get('location'))
    ).toContain(`code=${MARKER_C}`);
    expect(JSON.parse(JSON.stringify(error)).response.headers).toEqual({
      Location:
        'http://127.0.0.1:1/cb?code=<redacted>&state=abc#access_token=<redacted>',
      'WWW-Authenticate': 'Bearer',
      'X-Custom-Name': '<omitted>',
      'Content-Type': 'text/html',
    });
  });
});

describe('the error of a request that failed without an answer', () => {
  /** An adapter that fails the way the http adapter does when there is no answer. */
  const KINDS: [string, (config: InternalAxiosRequestConfig) => Error][] = [
    [
      'a timeout',
      (config) =>
        new AxiosError(
          'timeout of 30000ms exceeded',
          'ECONNABORTED',
          config,
          {}
        ),
    ],
    [
      'a refused connection',
      (config) =>
        new AxiosError(
          'connect ECONNREFUSED 127.0.0.1:1',
          'ECONNREFUSED',
          config,
          {}
        ),
    ],
    ['an abort', (config) => new CanceledError('canceled', config)],
    [
      'too many redirects',
      (config) =>
        new AxiosError(
          'Maximum number of redirects exceeded',
          'ERR_FR_TOO_MANY_REDIRECTS',
          config,
          {}
        ),
    ],
  ];

  const failing =
    (make: (config: InternalAxiosRequestConfig) => Error): AxiosAdapter =>
    async (config) => {
      throw make(config);
    };

  test.each(VARIANTS)(
    '1: $name: no form writes the request configuration, whichever the failure',
    async (variant) => {
      for (const [kind, make] of KINDS) {
        const state = StateImpl({});
        variant.setup(state);
        const error = await variant
          .make(state, failing(make))
          .get('/things/1')
          .catch((caught: AxiosError) => caught);
        expect(error.response).toBeUndefined();
        expect(typeof error.toJSON).toBe('function');
        try {
          expectNoMarker(error, variant.markers);
        } catch (thrown) {
          throw new Error(`${kind}: ${(thrown as Error).message}`);
        }
        const view = JSON.parse(JSON.stringify(error));
        expect(Object.keys(view.headers)).toContain(variant.header);
        expect(view.url).toBe(`${BASE_URL}/things/1`);
        // the config is still on the error
        expect(error.config).toBeDefined();
      }
    }
  );

  describe('on the loopback interface, through the http adapter of axios', () => {
    let silent: http.Server;
    let silentUrl: string;

    beforeAll(async () => {
      // a server that takes the request and never answers
      silent = http.createServer(() => undefined);
      await new Promise<void>((resolve) =>
        silent.listen(0, '127.0.0.1', () => resolve())
      );
      silentUrl = `http://127.0.0.1:${(silent.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      silent.closeAllConnections();
      await new Promise((resolve) => silent.close(resolve));
    });

    test('2: a timeout', async () => {
      const state = StateImpl({});
      withAuthorization(state);
      const error = await generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        requestOverride: { baseURL: silentUrl, timeout: 100 },
      })
        .get('/things')
        .catch((caught: AxiosError) => caught);
      expect(error.code).toBe('ECONNABORTED');
      expect(error.response).toBeUndefined();
      expectNoMarker(error, [MARKER_A]);
      expect(JSON.parse(JSON.stringify(error)).headers.Authorization).toBe(
        'Bearer <redacted>'
      );
    });

    // what a tenant can echo: the request that it got, as a text of 70 KB, with the answer to a
    // password callback in the first 5 KiB. The text is too long to be read as structure, so
    // what is written of it is its head, with the answer replaced by a rule that reads text.
    const ECHOES: [string, (value: string) => unknown][] = [
      [
        'an input with a name of its own',
        (value) => ({
          type: 'PasswordCallback',
          output: [{ name: 'prompt', value: 'Password' }],
          input: [{ name: 'pw', value }],
          _id: 0,
        }),
      ],
      [
        'the value before the name',
        (value) => ({
          type: 'PasswordCallback',
          input: [{ value, name: 'IDToken2' }],
        }),
      ],
      [
        'a key between the name and the value',
        (value) => ({
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', note: 1, value }],
        }),
      ],
      [
        'an input named IDToken10',
        (value) => ({
          type: 'PasswordCallback',
          input: [{ name: 'IDToken10', value }],
        }),
      ],
      [
        'an input named IDToken12',
        (value) => ({
          type: 'PasswordCallback',
          input: [{ name: 'IDToken12', value }],
        }),
      ],
      [
        'the type after the input',
        (value) => ({
          input: [{ name: 'pw', value }],
          type: 'ValidatedCreatePasswordCallback',
        }),
      ],
    ];

    // forms that are not a callback written in the order of AM: a password key written inside texts
    // inside texts (three levels), a key or a name written with a unicode escape
    const ESCAPED: [string, (value: string, padding: string) => string][] = [
      [
        'three levels of JSON text',
        (value, padding) =>
          JSON.stringify({
            wrapped: JSON.stringify({
              inner: JSON.stringify({ password: value }),
            }),
            padding,
          }),
      ],
      [
        'a password key escaped twice',
        (value, padding) =>
          JSON.stringify({
            wrapped: JSON.stringify({
              text: JSON.stringify({ password: value }),
            }),
            padding,
          }),
      ],
      [
        'a key written with a unicode escape',
        (value, padding) =>
          `{"\\u0070assword":"${value}","padding":"${padding}"}`,
      ],
      [
        'a callback name written with a unicode escape',
        (value, padding) =>
          `{"callbacks":[{"type":"PasswordCallback","input":[{"name":"IDToken\\u0032","value":"${value}"}]}],"padding":"${padding}"}`,
      ],
    ];

    const SIZES = [70_000, 1_000_000];

    /** A loopback server answers 400 with a detail that echoes a text, and the error of the request is returned. */
    async function echoed(echo: string): Promise<AxiosError> {
      const server = http.createServer((_request, response) => {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            code: 400,
            reason: 'Bad Request',
            message: 'no',
            detail: { echo },
          })
        );
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve())
      );
      try {
        const state = StateImpl({});
        withAuthorization(state);
        return await generateAmApi({
          resource: {},
          requiredScopes: [],
          state,
          requestOverride: {
            baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
          },
        })
          .get('/things')
          .catch((caught: AxiosError) => caught);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    }

    /** No form of the error, or of the error wrapped as the library wraps it, holds the value (the text of the error says the detail as the server did, and is not a form of the view). */
    function expectReplaced(error: AxiosError, value: string) {
      expectNoMarker(error, [value]);
      const wrapped = new FrodoError('Error reading', error);
      for (const [form, text] of Object.entries(allForms(wrapped))) {
        if (['%s', 'String', 'template'].includes(form)) continue;
        expect([form, text.includes(value)]).toEqual([form, false]);
      }
    }

    test.each(
      ESCAPED.flatMap(([name, make]) =>
        SIZES.map((size) => [name, size, make] as const)
      )
    )(
      '5: an answer that echoes a text with %s in it, of %s bytes: the value is in no form of the error',
      async (_name, size, make) => {
        const echo = make(MARKER_C, 'x'.repeat(size));
        expect(echo.length).toBeGreaterThan(65_536);
        const error = await echoed(echo);
        expect(error.response?.status).toBe(400);
        expectReplaced(error, MARKER_C);
      }
    );

    test.each(
      ECHOES.flatMap(([name, make]) =>
        SIZES.map((size) => [name, size, make] as const)
      )
    )(
      "6: a callback in a text of about %s bytes (%s), at the sizes of a tenant's echo",
      async (_name, size, make) => {
        const echo = JSON.stringify({
          callbacks: [make(MARKER_C)],
          padding: 'x'.repeat(size),
        });
        const error = await echoed(echo);
        expect(error.response?.status).toBe(400);
        expectReplaced(error, MARKER_C);
      }
    );

    // a value that holds a quote, written as a serializer writes it, in a text of the sizes of a tenant's echo
    const QUOTED: [string, (value: string, padding: string) => string][] = [
      [
        'a password key',
        (value, padding) => JSON.stringify({ password: value, padding }),
      ],
      [
        'the answer to a callback',
        (value, padding) =>
          JSON.stringify({
            callbacks: [
              {
                type: 'PasswordCallback',
                input: [{ name: 'IDToken2', value }],
              },
            ],
            padding,
          }),
      ],
      [
        'an authorization value',
        (value, padding) =>
          JSON.stringify({ headers: { Authorization: value }, padding }),
      ],
      [
        'a key with a unicode escape',
        (value, padding) =>
          `{"\\u0070assword":${JSON.stringify(value)},"padding":"${padding}"}`,
      ],
    ];
    const QUOTE_VALUES = [
      'MARKER-H-0001"MARKER-T-0001',
      'MARKER-H-0001\\"MARKER-T-0001',
      'MARKER-H-0001\u00e9"\u00e9MARKER-T-0001',
      'MARKER-H-0001"a"b"MARKER-T-0001',
    ];

    test.each(
      QUOTED.flatMap(([name, make]) =>
        QUOTE_VALUES.flatMap((value, index) =>
          SIZES.map((size) => [name, index, size, make, value] as const)
        )
      )
    )(
      '7: %s with a value that holds a quote (form %s), in a text of about %s characters: no part of the value is in any form of the error',
      async (_name, _index, size, make, value) => {
        const error = await echoed(make(value, 'x'.repeat(size)));
        expect(error.response?.status).toBe(400);
        expectReplaced(error, 'MARKER-H-0001');
        expectReplaced(error, 'MARKER-T-0001');
      }
    );

    test.each(ECHOES)(
      '4: an answer that echoes a text of 70 KB with a callback in it (%s): the answer to the callback is in no form of the error',
      async (_name, callback) => {
        const echo = JSON.stringify({
          callbacks: [callback(MARKER_C)],
          padding: 'x'.repeat(70_000),
        });
        expect(echo.length).toBeGreaterThan(65_536);
        expect(echo.indexOf(MARKER_C)).toBeLessThan(5000);
        const server = http.createServer((_request, response) => {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              code: 400,
              reason: 'Bad Request',
              message: 'no',
              detail: { echo },
            })
          );
        });
        await new Promise<void>((resolve) =>
          server.listen(0, '127.0.0.1', () => resolve())
        );
        try {
          const state = StateImpl({});
          withAuthorization(state);
          const error = await generateAmApi({
            resource: {},
            requiredScopes: [],
            state,
            requestOverride: {
              baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            },
          })
            .get('/things')
            .catch((caught: AxiosError) => caught);
          expect(error.response?.status).toBe(400);
          // the error as it is, and wrapped as the library wraps it
          expectNoMarker(error, [MARKER_C]);
          // wrapped as the library wraps it: every form of the view (the text of the error, which says
          // the detail as the server did, is not a form of the view)
          const wrapped = new FrodoError('Error reading', error);
          for (const [form, text] of Object.entries(allForms(wrapped))) {
            if (['%s', 'String', 'template'].includes(form)) continue;
            expect([form, text.includes(MARKER_C)]).toEqual([form, false]);
          }
        } finally {
          server.closeAllConnections();
          await new Promise((resolve) => server.close(resolve));
        }
      }
    );

    test('3: a refused connection', async () => {
      const closed = http.createServer();
      await new Promise<void>((resolve) =>
        closed.listen(0, '127.0.0.1', () => resolve())
      );
      const port = (closed.address() as AddressInfo).port;
      await new Promise((resolve) => closed.close(resolve));
      const state = StateImpl({});
      withAuthorization(state);
      const error = await generateAmApi({
        resource: {},
        requiredScopes: [],
        state,
        requestOverride: { baseURL: `http://127.0.0.1:${port}` },
      })
        .get('/things')
        .catch((caught: AxiosError) => caught);
      expect(error.code).toBe('ECONNREFUSED');
      expect(error.response).toBeUndefined();
      expectNoMarker(error, [MARKER_A]);
    });
  });
});
