import { jest } from '@jest/globals';
import StateImpl from '../shared/State';

/**
 * InternalObjectApi: the URL of a page request.
 *
 * The reads of internal roles follow the paged results cookie to the last page, so the URL that carries a cookie is
 * built in production for the first time. These tests pin it: the first request has no cookie parameter and its URL
 * is the one that was always sent, and a later request carries the cookie percent-encoded, with the characters that
 * a query string cannot hold (`+`, `/`, `=`) encoded, exactly like the managed object API.
 * Mocked unit test: the HTTP client of BaseApi is replaced, there are no recordings and no network.
 */

const get = jest.fn<(...args: any[]) => Promise<any>>();
const actualBaseApi = await import('./BaseApi');
jest.unstable_mockModule('./BaseApi', () => ({
  ...actualBaseApi,
  generateIdmApi: () => ({ get }),
}));

const api = await import('./InternalObjectApi');

const state = StateImpl({});
state.setHost('https://openam-matrix.example.com/am');

const BASE = 'https://openam-matrix.example.com/openidm';
const COOKIE = 'a+b/c==';
const ENCODED_COOKIE = 'a%2Bb%2Fc%3D%3D';

/** The URL of the only request that the call under test sent. */
function sentUrl(): string {
  expect(get).toHaveBeenCalledTimes(1);
  return get.mock.calls[0][0];
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { result: [], pagedResultsCookie: null } });
});

describe('queryAllInternalObjectsByType', () => {
  test('the first page has no cookie parameter', async () => {
    await api.queryAllInternalObjectsByType({
      type: 'role',
      fields: ['name'],
      pageCookie: null,
      state,
    });

    expect(sentUrl()).toBe(
      `${BASE}/internal/role?_queryFilter=true&_pageSize=1000&_fields=name`
    );
  });

  test('a later page carries the cookie percent-encoded, after the fields', async () => {
    await api.queryAllInternalObjectsByType({
      type: 'role',
      fields: ['name'],
      pageCookie: COOKIE,
      state,
    });

    expect(sentUrl()).toBe(
      `${BASE}/internal/role?_queryFilter=true&_pageSize=1000&_fields=name&_pagedResultsCookie=${ENCODED_COOKIE}`
    );
  });
});

describe('queryInternalObjects', () => {
  test('the first page has no cookie parameter and the filter is encoded', async () => {
    await api.queryInternalObjects({
      type: 'role',
      filter: 'name sw "a b"',
      fields: ['name'],
      state,
    });

    expect(sentUrl()).toBe(
      `${BASE}/internal/role?_queryFilter=name%20sw%20%22a%20b%22&_pageSize=1000&_fields=name`
    );
  });

  test('a later page carries the cookie percent-encoded, after the fields', async () => {
    await api.queryInternalObjects({
      type: 'role',
      filter: 'name sw "a b"',
      fields: ['name'],
      pageCookie: COOKIE,
      state,
    });

    expect(sentUrl()).toBe(
      `${BASE}/internal/role?_queryFilter=name%20sw%20%22a%20b%22&_pageSize=1000&_fields=name&_pagedResultsCookie=${ENCODED_COOKIE}`
    );
  });
});
