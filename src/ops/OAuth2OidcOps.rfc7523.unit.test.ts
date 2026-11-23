/**
 * Run tests
 *
 *        npm run test:only OAuth2OidcOps.rfc7523
 *
 * accessTokenRfc7523AuthZGrant() sets the content type of a form post on the
 * `headers` of the request config of its caller. `AxiosRequestConfig.headers`
 * may be an `AxiosHeaders` instance, and a merge replaces an instance by the
 * plain object it merges into (see mergeDeep): the headers the caller put
 * there (a cookie, an authorization header) must survive.
 *
 * The request goes to a mock of the api module: no network, no recording.
 */
import { jest } from '@jest/globals';
import { AxiosHeaders } from 'axios';

const accessToken = jest.fn(async (_args?: any): Promise<any> => ({
  access_token: 'fake-access-token',
  token_type: 'Bearer',
  scope: 'fr:idm:*',
  expires_in: 3600,
}));

jest.unstable_mockModule('../api/OAuth2OIDCApi', () => ({
  authorize: jest.fn(),
  accessToken,
  accessTokenRfc7523AuthZGrant: jest.fn(),
  deviceAuthorizationRequest: jest.fn(),
  getTokenInfo: jest.fn(),
  clientCredentialsGrant: jest.fn(),
}));

const { default: OAuth2OidcOps } = await import('./OAuth2OidcOps');
const { default: StateImpl } = await import('../shared/State');

describe('OAuth2OidcOps.accessTokenRfc7523AuthZGrant', () => {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
  });
  const grant = (config?: any) =>
    OAuth2OidcOps(state).accessTokenRfc7523AuthZGrant(
      'client-1',
      'made-up-jwt',
      ['fr:idm:*'],
      config
    );
  /** The request config that the api module received on the last call. */
  const sentConfig = (): any => {
    const call = accessToken.mock.calls.at(-1)?.[0] as any;
    return call.config;
  };

  beforeEach(() => accessToken.mockClear());

  test('0: no config: the content type of a form post is set', async () => {
    await grant();
    expect(sentConfig().headers).toStrictEqual({
      'content-type': 'application/x-www-form-urlencoded',
    });
  });

  test('1: plain headers of the caller are kept and the content type is added', async () => {
    const config = { headers: { Cookie: 'made-up', Authorization: 'made-up' } };
    await grant(config);
    expect(sentConfig()).toBe(config);
    expect(sentConfig().headers).toStrictEqual({
      Cookie: 'made-up',
      Authorization: 'made-up',
      'content-type': 'application/x-www-form-urlencoded',
    });
  });

  test('2: an AxiosHeaders instance of the caller stays the same instance, keeps its headers and gets the content type', async () => {
    const headers = new AxiosHeaders({
      Cookie: 'made-up',
      Authorization: 'made-up',
    });
    const config = { headers };
    await grant(config);
    expect(sentConfig()).toBe(config);
    expect(sentConfig().headers).toBe(headers);
    expect(headers.get('Cookie')).toBe('made-up');
    expect(headers.get('Authorization')).toBe('made-up');
    expect(headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded'
    );
  });

  test('3: a content type of the caller in an AxiosHeaders instance is replaced, not doubled', async () => {
    const headers = new AxiosHeaders({ 'Content-Type': 'application/json' });
    await grant({ headers });
    expect(headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded'
    );
    expect(Object.keys(headers.toJSON())).toHaveLength(1);
  });

  test('5: a config that is null reaches the request as it was given, as before', async () => {
    await grant(null);
    expect(sentConfig()).toBeNull();
  });

  test('6: a fetch Headers instance of the caller stays the same instance, keeps its headers and gets the content type', async () => {
    const headers = new Headers({ Cookie: 'made-up' });
    const config = { headers: headers as any };
    await grant(config);
    expect(sentConfig()).toBe(config);
    expect(sentConfig().headers).toBe(headers);
    expect(headers.get('Cookie')).toBe('made-up');
    expect(headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded'
    );
  });

  test('7: any object with a set method gets the content type through it, and stays the same object', async () => {
    const calls: unknown[][] = [];
    const headers = {
      Cookie: 'made-up',
      set: (...args: unknown[]) => calls.push(args),
    };
    const config = { headers: headers as any };
    await grant(config);
    expect(sentConfig().headers).toBe(headers);
    expect(calls).toStrictEqual([
      ['content-type', 'application/x-www-form-urlencoded'],
    ]);
    expect(headers.Cookie).toBe('made-up');
    expect(Object.keys(headers)).toStrictEqual(['Cookie', 'set']);
  });

  test('8: plain headers that have a string header named set are plain headers: merged, not called', async () => {
    await grant({ headers: { set: 'made-up', Cookie: 'made-up' } });
    expect(sentConfig().headers).toStrictEqual({
      set: 'made-up',
      Cookie: 'made-up',
      'content-type': 'application/x-www-form-urlencoded',
    });
  });

  test('4: the other fields of the config of the caller are kept', async () => {
    await grant({ timeout: 5000, headers: { 'X-Made-Up': 'yes' } });
    expect(sentConfig().timeout).toBe(5000);
    expect(sentConfig().headers).toMatchObject({ 'X-Made-Up': 'yes' });
  });
});
