/**
 * Run tests
 *
 *        npm run test:only BaseApi.rawVersionHeader.unit
 *
 * The optional `resource` of the IDM, log keys, log and WS-Fed API instances,
 * which the raw config calls use to send an Accept-API-Version header: the
 * header goes out when the resource config carries a version and not
 * otherwise, and the log keys instance sends it with or without a bearer
 * token.
 *
 * Unit test, no network and no recordings: an axios adapter answers the
 * requests and keeps the config of each. Hosts and credentials are made up.
 */
import type { AxiosRequestConfig } from 'axios';
import StateImpl from '../shared/State';
import { stubAdapter } from '../test/utils/StubAdapter';
import {
  generateIdmApi,
  generateLogApi,
  generateLogKeysApi,
  generateWSFedApi,
} from './BaseApi';

const VERSION = 'protocol=2.1,resource=3.0';
const HOST = 'https://openam-matrix.example.com/am';

function header(config: AxiosRequestConfig, name: string): unknown {
  const headers = config.headers as any;
  return typeof headers?.get === 'function' ? headers.get(name) : headers[name];
}

function newState({ bearer = false, pfBearer = false } = {}) {
  const state = StateImpl({
    host: HOST,
    logApiKey: 'sample-key',
    logApiSecret: 'sample-secret',
  });
  if (bearer) {
    state.setBearerTokenMeta({
      access_token: 'sample-bearer-token',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
  }
  if (pfBearer) {
    state.setPfBearerTokenMeta({
      access_token: 'sample-pf-token',
      token_type: 'Bearer',
      scope: 'fr:pf:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
  }
  return state;
}

type Make = (
  resource: { apiVersion?: string } | undefined,
  requestOverride: AxiosRequestConfig
) => ReturnType<typeof generateIdmApi>;

const generators: [string, Make][] = [
  [
    'IDM',
    (resource, requestOverride) =>
      generateIdmApi({
        resource,
        requiredScopes: [],
        state: newState({ bearer: true }),
        requestOverride,
      }),
  ],
  [
    'log keys with a bearer token',
    (resource, requestOverride) =>
      generateLogKeysApi({
        resource,
        state: newState({ bearer: true }),
        requestOverride,
      }),
  ],
  [
    'log keys without a bearer token',
    (resource, requestOverride) =>
      generateLogKeysApi({ resource, state: newState(), requestOverride }),
  ],
  [
    'log',
    (resource, requestOverride) =>
      generateLogApi({ resource, state: newState(), requestOverride }),
  ],
  [
    'WS-Fed',
    (resource, requestOverride) =>
      generateWSFedApi({
        resource,
        requiredScopes: [],
        state: newState({ pfBearer: true }),
        requestOverride,
      }),
  ],
];

describe.each(generators)('the %s API instance', (_name, make) => {
  test('1: sends the version of its resource config', async () => {
    const { adapter, requests } = stubAdapter([{ data: {} }]);
    await make({ apiVersion: VERSION }, { adapter }).get(`${HOST}/x`);
    expect(requests).toHaveLength(1);
    expect(header(requests[0], 'Accept-API-Version')).toBe(VERSION);
  });

  test('2: sends no version header without a resource config', async () => {
    const { adapter, requests } = stubAdapter([{ data: {} }]);
    await make(undefined, { adapter }).get(`${HOST}/x`);
    expect(requests).toHaveLength(1);
    expect(header(requests[0], 'Accept-API-Version')).toBeUndefined();
  });

  test('3: sends no version header when the resource config names none', async () => {
    const { adapter, requests } = stubAdapter([{ data: {} }]);
    await make({}, { adapter }).get(`${HOST}/x`);
    expect(requests).toHaveLength(1);
    expect(header(requests[0], 'Accept-API-Version')).toBeUndefined();
  });
});

describe('the log keys API instance and its credential', () => {
  test('4: sends the bearer token when there is one, and the version', async () => {
    const { adapter, requests } = stubAdapter([{ data: {} }]);
    await generateLogKeysApi({
      resource: { apiVersion: VERSION },
      state: newState({ bearer: true }),
      requestOverride: { adapter },
    }).get(`${HOST}/x`);
    expect(header(requests[0], 'Authorization')).toBe(
      'Bearer sample-bearer-token'
    );
    expect(header(requests[0], 'Accept-API-Version')).toBe(VERSION);
  });

  test('5: sends no Authorization header without a bearer token, but still the version', async () => {
    const { adapter, requests } = stubAdapter([{ data: {} }]);
    await generateLogKeysApi({
      resource: { apiVersion: VERSION },
      state: newState(),
      requestOverride: { adapter },
    }).get(`${HOST}/x`);
    expect(header(requests[0], 'Authorization')).toBeUndefined();
    expect(header(requests[0], 'Accept-API-Version')).toBe(VERSION);
  });
});

describe('the log API instance and its credential', () => {
  test('6: sends the log API key and secret next to the version', async () => {
    const { adapter, requests } = stubAdapter([{ data: {} }]);
    await generateLogApi({
      resource: { apiVersion: VERSION },
      state: newState(),
      requestOverride: { adapter },
    }).get(`${HOST}/x`);
    expect(header(requests[0], 'X-API-Key')).toBe('sample-key');
    expect(header(requests[0], 'X-API-Secret')).toBe('sample-secret');
    expect(header(requests[0], 'Accept-API-Version')).toBe(VERSION);
  });
});
