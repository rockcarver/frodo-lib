/**
 * Unit tests for what the error of a request says about the proxy it went
 * through: which failures are the proxy's for certain, and which are not.
 *
 * Run with:
 *
 *        npm run test:only -- src/utils/ProxyFailureUtils.unit.test.ts
 *
 * The requests here are stand-ins that carry what the decision needs (the
 * events of the agent, a socket or none), so every row of the table can be
 * driven without a socket. The same decisions, made on real connections to a
 * fake proxy, are tested in `src/api/BaseApi.proxyFailure.test.ts`.
 */
import { EventEmitter } from 'events';
import type { ClientRequest } from 'http';
import { FRODO_ERROR_CODES } from '../ops/FrodoError';
import { ProxyAgent } from './ProxyAgentUtils';
import {
  attachProxyFailure,
  describeProxyFailure,
  noteProxyDecision,
  PROXY_FAILURE_CODES,
} from './ProxyFailureUtils';

/** A request as the agent sees it: an emitter, with a socket once it has one. */
function fakeRequest(socket: unknown = null): ClientRequest {
  return Object.assign(new EventEmitter(), { socket }) as never;
}

/** The error of a request, as axios hands it to an interceptor. */
function errorOf(
  request: ClientRequest,
  fields: {
    code?: string;
    message?: string;
    response?: { status: number; headers?: Record<string, unknown> };
  } = {}
): any {
  return Object.assign(new Error(fields.message ?? 'failed'), {
    request,
    ...(fields.code && { code: fields.code }),
    ...(fields.response && { response: fields.response }),
  });
}

/** The proxy answers the CONNECT request of the request, as the agent reports it. */
function answerConnect(
  request: ClientRequest,
  statusCode: number,
  headers: Record<string, unknown> = {}
) {
  request.emit('proxyConnect', { statusCode, headers });
}

const HTTPS_URL = 'https://tenant.example/am/json/serverinfo/*';
const HTTP_URL = 'http://tenant.example/am/json/serverinfo/*';
const PROXY = 'http://proxy.example:3128';

describe('PROXY_FAILURE_CODES', () => {
  test('1: every code is a code of FrodoError, and each is listed once', () => {
    expect(new Set(PROXY_FAILURE_CODES).size).toBe(PROXY_FAILURE_CODES.length);
    for (const code of PROXY_FAILURE_CODES) {
      expect(FRODO_ERROR_CODES).toContain(code);
      expect(code).toMatch(/^PROXY(_[A-Z]+)+$/);
    }
  });
});

describe('noteProxyDecision', () => {
  test('2: a request that goes direct is not a proxy request, even if an earlier decision said otherwise', () => {
    const request = fakeRequest();
    noteProxyDecision(request, HTTPS_URL, PROXY);
    noteProxyDecision(request, HTTPS_URL, undefined);
    answerConnect(request, 403);
    expect(describeProxyFailure(errorOf(request))).toBeUndefined();
    noteProxyDecision(request, HTTPS_URL, '');
    expect(describeProxyFailure(errorOf(request))).toBeUndefined();
  });

  test.each([
    'socks5://proxy.example:1080',
    'pac+http://proxy.example/proxy.pac',
    'not a url',
  ])('3: %s is not named: only an HTTP or HTTPS proxy is', (proxy) => {
    const request = fakeRequest();
    noteProxyDecision(request, HTTPS_URL, proxy);
    expect(
      describeProxyFailure(errorOf(request, { code: 'ECONNREFUSED' }))
    ).toBeUndefined();
  });

  test('4: the proxy is kept as protocol, host and port, whatever else its URL says', () => {
    const request = fakeRequest();
    noteProxyDecision(
      request,
      HTTPS_URL,
      'https://alice:made-up-pass@proxy.example/path?token=made-up-token#frag'
    );
    const failure = describeProxyFailure(
      errorOf(request, { code: 'ECONNREFUSED' })
    );
    expect(failure?.proxy).toEqual({
      protocol: 'https',
      host: 'proxy.example',
      port: 443,
    });
    expect(JSON.stringify(failure)).not.toMatch(
      /alice|made-up|path|token|frag/
    );
  });

  test.each([
    ['http://proxy.example', 80],
    ['https://proxy.example', 443],
    ['http://proxy.example:8080', 8080],
  ])('5: the port of %s is %i', (proxy, port) => {
    const request = fakeRequest();
    noteProxyDecision(request, HTTP_URL, proxy);
    expect(
      describeProxyFailure(errorOf(request, { code: 'ECONNREFUSED' }))?.proxy
        .port
    ).toBe(port);
  });

  test('6: an IPv6 proxy keeps the brackets of its host', () => {
    const request = fakeRequest();
    noteProxyDecision(request, HTTP_URL, 'http://[::1]:3128');
    expect(
      describeProxyFailure(errorOf(request, { code: 'ECONNREFUSED' }))
    ).toMatchObject({ proxy: { host: '[::1]', port: 3128 } });
  });

  test.each([
    [HTTPS_URL, 'https'],
    ['wss://tenant.example/am', 'https'],
    [HTTP_URL, 'http'],
    ['ws://tenant.example/am', 'http'],
  ])('7: a request for %s has a %s target', (url, target) => {
    const request = fakeRequest();
    noteProxyDecision(request, url, PROXY);
    expect(
      describeProxyFailure(errorOf(request, { code: 'ECONNREFUSED' }))?.target
    ).toBe(target);
  });
});

describe('the ProxyAgent records its decision for each request', () => {
  const ENV_NAMES = [
    'HTTP_PROXY',
    'http_proxy',
    'HTTPS_PROXY',
    'https_proxy',
    'ALL_PROXY',
    'all_proxy',
    'NO_PROXY',
    'no_proxy',
    'npm_config_proxy',
    'npm_config_http_proxy',
    'npm_config_https_proxy',
    'npm_config_no_proxy',
  ];
  const saved = new Map<string, string | undefined>();
  beforeEach(() => {
    for (const name of ENV_NAMES) {
      saved.set(name, process.env[name]);
      delete process.env[name];
    }
  });
  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    saved.clear();
  });

  /** What the agent decides for a request, and what the error of that request then says. */
  async function decide(url: string, request = fakeRequest()) {
    const agent = new ProxyAgent();
    const answer = await agent.getProxyForUrl(url, request);
    const failure = describeProxyFailure(
      errorOf(request, { code: 'ECONNREFUSED' })
    );
    return { answer, failure };
  }

  test('8: the answer of the agent is returned as it is, user info included, and the decision is recorded without it', async () => {
    process.env.HTTPS_PROXY =
      'http://alice:made-up-pass@proxy.example:3128/path?token=made-up-token';

    const { answer, failure } = await decide(HTTPS_URL);

    // the agent still needs the credentials to send them to the proxy
    expect(answer).toBe(
      'http://alice:made-up-pass@proxy.example:3128/path?token=made-up-token'
    );
    expect(failure).toMatchObject({
      code: 'PROXY_CONNECTION_REFUSED',
      proxy: { protocol: 'http', host: 'proxy.example', port: 3128 },
      target: 'https',
    });
    expect(JSON.stringify(failure)).not.toMatch(/alice|made-up|path|token/);
  });

  test('9: a target on NO_PROXY is a direct request and is not recorded as a proxy request', async () => {
    process.env.HTTPS_PROXY = PROXY;
    process.env.NO_PROXY = 'tenant.example';

    const { answer, failure } = await decide(HTTPS_URL);

    expect(answer).toBe('');
    expect(failure).toBeUndefined();
  });

  test('10: the decision is made for each request, with the variables of that moment', async () => {
    const agent = new ProxyAgent();
    const first = fakeRequest();
    const second = fakeRequest();

    process.env.HTTPS_PROXY = PROXY;
    await agent.getProxyForUrl(HTTPS_URL, first);
    delete process.env.HTTPS_PROXY;
    await agent.getProxyForUrl(HTTPS_URL, second);

    expect(
      describeProxyFailure(errorOf(first, { code: 'ECONNREFUSED' }))
    ).toBeDefined();
    expect(
      describeProxyFailure(errorOf(second, { code: 'ECONNREFUSED' }))
    ).toBeUndefined();
  });

  test('11: a proxy URL the agent refuses is refused as before and records nothing', async () => {
    process.env.HTTPS_PROXY = 'ftp://alice:made-up-pass@proxy.example:21';
    const request = fakeRequest();

    await expect(
      new ProxyAgent().getProxyForUrl(HTTPS_URL, request)
    ).rejects.toThrow(
      'Unsupported protocol for proxy URL: ftp://proxy.example'
    );

    expect(
      describeProxyFailure(errorOf(request, { code: 'ECONNREFUSED' }))
    ).toBeUndefined();
  });

  test.each([
    ['socks5://proxy.example:1080'],
    ['pac+http://proxy.example/proxy.pac'],
  ])(
    '12: %s is decided by the agent as before and is not named',
    async (proxy) => {
      process.env.HTTPS_PROXY = proxy;

      const { answer, failure } = await decide(HTTPS_URL);

      expect(answer).toBe(proxy);
      expect(failure).toBeUndefined();
    }
  );

  test('13: an HTTPS proxy and the target of an HTTP request are recorded as they are', async () => {
    process.env.HTTP_PROXY = 'https://proxy.example';

    const { failure } = await decide(HTTP_URL);

    expect(failure).toMatchObject({
      proxy: { protocol: 'https', host: 'proxy.example', port: 443 },
      target: 'http',
    });
  });
});

describe('describeProxyFailure: an HTTPS target', () => {
  /** A request for an HTTPS target that the agent sent through the proxy. */
  const through = (socket: unknown = null) => {
    const request = fakeRequest(socket);
    noteProxyDecision(request, HTTPS_URL, PROXY);
    return request;
  };

  test('11: a request nobody chose a proxy for says nothing', () => {
    expect(
      describeProxyFailure(errorOf(fakeRequest(), { code: 'ECONNREFUSED' }))
    ).toBeUndefined();
    expect(describeProxyFailure({ request: undefined })).toBeUndefined();
    expect(describeProxyFailure(new Error('no request'))).toBeUndefined();
    expect(describeProxyFailure(undefined)).toBeUndefined();
    expect(describeProxyFailure('text')).toBeUndefined();
  });

  test('12: the request is found below the layer that follows redirects', () => {
    const native = through();
    const wrapper = Object.assign(new EventEmitter(), {
      _currentRequest: native,
    });
    const error = Object.assign(new Error('x'), {
      code: 'ECONNREFUSED',
      request: wrapper,
    });
    expect(describeProxyFailure(error)?.code).toBe('PROXY_CONNECTION_REFUSED');
  });

  test.each([
    [407, 'PROXY_AUTHENTICATION_REQUIRED'],
    [400, 'PROXY_TUNNEL_REFUSED'],
    [403, 'PROXY_TUNNEL_REFUSED'],
    [502, 'PROXY_TUNNEL_REFUSED'],
    [504, 'PROXY_TUNNEL_REFUSED'],
    [302, 'PROXY_TUNNEL_REFUSED'],
  ])(
    '13: a CONNECT answered with %i is a refused tunnel, code %s, whatever error follows',
    (status, code) => {
      const request = through(
        /* the agent hands over a socket that replays the answer */ {}
      );
      answerConnect(request, status);
      for (const error of [
        errorOf(request, { response: { status } }),
        errorOf(request, { code: 'ECONNRESET' }),
        errorOf(request),
      ]) {
        expect(describeProxyFailure(error)).toMatchObject({ code, status });
      }
    }
  );

  test.each([200, 201, 204])(
    '14: a CONNECT answered with %i is a tunnel: what fails in it is the target’s',
    (status) => {
      const request = through({});
      answerConnect(request, status);
      for (const code of [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
      ]) {
        expect(
          describeProxyFailure(errorOf(request, { code }))
        ).toBeUndefined();
      }
      expect(
        describeProxyFailure(errorOf(request, { response: { status: 407 } }))
      ).toBeUndefined();
    }
  );

  test.each([
    ['ECONNREFUSED', 'PROXY_CONNECTION_REFUSED'],
    ['ECONNRESET', 'PROXY_CONNECTION_CLOSED'],
    ['EPIPE', 'PROXY_CONNECTION_CLOSED'],
    ['ENOTFOUND', 'PROXY_UNREACHABLE'],
    ['EAI_AGAIN', 'PROXY_UNREACHABLE'],
    ['ENETUNREACH', 'PROXY_UNREACHABLE'],
    ['EHOSTUNREACH', 'PROXY_UNREACHABLE'],
    ['ETIMEDOUT', 'PROXY_UNREACHABLE'],
  ])(
    '15: %s before the proxy has answered, on a request without a socket, is the proxy’s: %s',
    (cause, code) => {
      const failure = describeProxyFailure(errorOf(through(), { code: cause }));
      expect(failure).toMatchObject({
        code,
        cause,
        target: 'https',
        proxy: { host: 'proxy.example', port: 3128 },
      });
      expect(failure).not.toHaveProperty('status');
      expect(failure).not.toHaveProperty('authenticate');
    }
  );

  test('16: a proxy that ends the connection before its answer is named by what the agent says', () => {
    const failure = describeProxyFailure(
      errorOf(through(), {
        message: 'Proxy connection ended before receiving CONNECT response',
      })
    );
    expect(failure).toMatchObject({ code: 'PROXY_CONNECTION_CLOSED' });
    expect(failure).not.toHaveProperty('cause');
  });

  test.each([
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNABORTED',
  ])(
    '17: %s on a request that has a socket (it was sent into the tunnel of an earlier request) is not the proxy’s',
    (code) => {
      expect(
        describeProxyFailure(errorOf(through({}), { code }))
      ).toBeUndefined();
    }
  );

  test.each([
    'ECONNABORTED',
    'EPROTO',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'ERR_BAD_REQUEST',
  ])(
    '18: %s while connecting is not one of the failures that are named',
    (code) => {
      expect(
        describeProxyFailure(errorOf(through(), { code }))
      ).toBeUndefined();
    }
  );

  test('19: an error without a code whose message is not the agent’s is not named', () => {
    expect(
      describeProxyFailure(errorOf(through(), { message: 'something broke' }))
    ).toBeUndefined();
    expect(
      describeProxyFailure(
        errorOf(through(), {
          code: 'ECONNREFUSED',
          message: 'Proxy connection ended before receiving CONNECT response',
        })
      )
    ).toMatchObject({ code: 'PROXY_CONNECTION_REFUSED' });
  });

  test('20: the challenge of the proxy is kept as one bounded line, and the status text is the library’s own', () => {
    const request = through({});
    answerConnect(request, 407, {
      'proxy-authenticate': [
        'Negotiate',
        `Basic realm="a\r\nb\u0007c${'x'.repeat(500)}"`,
      ],
    });
    const failure = describeProxyFailure(errorOf(request));
    expect(failure?.authenticate).toMatch(/^Negotiate, Basic realm="a b c/);
    expect(failure?.authenticate?.length).toBeLessThanOrEqual(203);
    expect(failure?.authenticate).not.toMatch(/[\r\n\u0007]/);
    expect(failure?.message).toBe(
      `The proxy proxy.example:3128 refused the CONNECT request for an HTTPS target with status 407 (Proxy Authentication Required). Proxy-Authenticate: ${failure?.authenticate}`
    );
  });

  test('21: a status that has no standard text is stated without one', () => {
    const request = through({});
    answerConnect(request, 599);
    expect(describeProxyFailure(errorOf(request))?.message).toBe(
      'The proxy proxy.example:3128 refused the CONNECT request for an HTTPS target with status 599.'
    );
  });

  test('22: the sentence of each failure', () => {
    const sentence = (
      fields: Parameters<typeof errorOf>[1],
      status?: number
    ) => {
      const request = through(status ? {} : null);
      if (status) answerConnect(request, status);
      return describeProxyFailure(errorOf(request, fields))?.message;
    };
    expect(sentence({ code: 'ECONNREFUSED' })).toBe(
      'The proxy proxy.example:3128 refused the connection (ECONNREFUSED); the request was for an HTTPS target.'
    );
    expect(sentence({ code: 'ECONNRESET' })).toBe(
      'The proxy proxy.example:3128 closed the connection before it answered the CONNECT request for an HTTPS target (ECONNRESET).'
    );
    expect(sentence({ code: 'ENOTFOUND' })).toBe(
      'The proxy proxy.example:3128 could not be reached (ENOTFOUND); the request was for an HTTPS target.'
    );
    expect(sentence({}, 403)).toBe(
      'The proxy proxy.example:3128 refused the CONNECT request for an HTTPS target with status 403 (Forbidden).'
    );
  });
});

describe('describeProxyFailure: an HTTP target', () => {
  const through = (socket: unknown = null) => {
    const request = fakeRequest(socket);
    noteProxyDecision(request, HTTP_URL, PROXY);
    return request;
  };

  test('23: a 407 to the request is the proxy’s, with the challenge it sent', () => {
    expect(
      describeProxyFailure(
        errorOf(through({}), {
          response: {
            status: 407,
            headers: { 'proxy-authenticate': 'Basic realm="x"' },
          },
        })
      )
    ).toEqual({
      code: 'PROXY_AUTHENTICATION_REQUIRED',
      proxy: { protocol: 'http', host: 'proxy.example', port: 3128 },
      target: 'http',
      status: 407,
      authenticate: 'Basic realm="x"',
      message:
        'The proxy proxy.example:3128 refused the request for an HTTP target with status 407 (Proxy Authentication Required). Proxy-Authenticate: Basic realm="x"',
    });
  });

  test.each([400, 401, 403, 404, 500, 502, 503, 504])(
    '24: a %i could be the target’s answer, relayed: it is not named',
    (status) => {
      expect(
        describeProxyFailure(errorOf(through({}), { response: { status } }))
      ).toBeUndefined();
    }
  );

  test.each([
    ['ECONNREFUSED', 'PROXY_CONNECTION_REFUSED'],
    ['ECONNRESET', 'PROXY_CONNECTION_CLOSED'],
    ['ENOTFOUND', 'PROXY_UNREACHABLE'],
  ])(
    '25: %s on a request without a socket is the proxy’s: %s',
    (cause, code) => {
      expect(
        describeProxyFailure(errorOf(through(), { code: cause }))
      ).toMatchObject({ code, cause, target: 'http' });
    }
  );

  test('26: the proxy closing the connection of a request that has a socket is the proxy’s: the library talks to nobody else', () => {
    expect(
      describeProxyFailure(errorOf(through({}), { code: 'ECONNRESET' }))
    ).toMatchObject({
      code: 'PROXY_CONNECTION_CLOSED',
      cause: 'ECONNRESET',
      message:
        'The proxy proxy.example:3128 closed the connection before it answered the request for an HTTP target (ECONNRESET).',
    });
  });

  test.each(['ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'])(
    '27: %s on a request that has a socket could be the target’s slowness: it is not named',
    (code) => {
      expect(
        describeProxyFailure(errorOf(through({}), { code }))
      ).toBeUndefined();
    }
  );
});

describe('attachProxyFailure', () => {
  test('28: the facts are added as proxyFailure, and nothing else about the error changes', () => {
    const request = fakeRequest();
    noteProxyDecision(request, HTTPS_URL, PROXY);
    const error = errorOf(request, { code: 'ECONNREFUSED', message: 'boom' });

    attachProxyFailure(error);

    expect(error.proxyFailure).toMatchObject({
      code: 'PROXY_CONNECTION_REFUSED',
    });
    expect(error.message).toBe('boom');
    expect(error.code).toBe('ECONNREFUSED');
  });

  test('29: an error that is not a proxy failure is left as it was', () => {
    const error = errorOf(fakeRequest(), { code: 'ECONNREFUSED' });
    attachProxyFailure(error);
    expect(error).not.toHaveProperty('proxyFailure');
  });

  test('30: facts that are there are not replaced', () => {
    const request = fakeRequest();
    noteProxyDecision(request, HTTPS_URL, PROXY);
    const error = errorOf(request, { code: 'ECONNREFUSED' });
    error.proxyFailure = { code: 'PROXY_UNREACHABLE' };
    attachProxyFailure(error);
    expect(error.proxyFailure).toEqual({ code: 'PROXY_UNREACHABLE' });
  });

  test('31: it never throws, whatever it is given', () => {
    const hostile = {
      get request(): never {
        throw new Error('no request for you');
      },
    };
    for (const value of [
      undefined,
      null,
      7,
      'text',
      {},
      hostile,
      Object.freeze({ request: fakeRequest() }),
    ]) {
      expect(() => attachProxyFailure(value)).not.toThrow();
    }
  });
});
