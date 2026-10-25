/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.probeDeploymentType
 *
 * Regression coverage for probeDeploymentType() — the ANONYMOUS
 * deployment-type probe exported as `frodo.login.probeDeploymentType`. It POSTs to
 * `/oauth2/authorize` twice (the two built-in admin client ids), no
 * cookie/CSRF, and classifies by elimination:
 *
 * - fidc client 302s, forgeops client doesn't -> cloud
 * - forgeops client 302s, fidc client doesn't -> forgeops
 * - both clients answer 400 (invalid_client) -> classic
 * - anything else (no answer, 404, 403, an HTML page, a redirect elsewhere,
 *   both redirecting) -> inconclusive (`conclusive: false`)
 *
 * The 302-vs-400 signals themselves were verified live (2026-10-12)
 * against a real AIC tenant and a real ForgeOps deployment; these tests
 * pin the classification logic and the exact request SHAPE (anonymous:
 * no cookie, no csrf value) against mocks.
 */
import { jest } from '@jest/globals';

const authorize = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('authorize mock not configured');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  authorize,
  accessToken: jest.fn(),
  accessTokenRfc7523AuthZGrant: jest.fn(),
  deviceAuthorizationRequest: jest.fn(),
  getTokenInfo: jest.fn(),
  clientCredentialsGrant: jest.fn(),
}));

const { default: AuthenticateOps } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');

const HOST = 'https://am.example.com/am';

function authorizeThrow(status: number) {
  return () => {
    throw {
      response: {
        status,
        headers: { location: status === 302 ? `${HOST}/UI/Login?realm=/` : '' },
      },
    };
  };
}

beforeEach(() => {
  authorize.mockReset();
  authorize.mockImplementation(async () => {
    throw new Error('authorize mock not configured');
  });
});

describe('AuthenticateOps.probeDeploymentType (frodo.login.probeDeploymentType)', () => {
  test('cloud: fidc client 302, forgeops client 400', async () => {
    authorize
      .mockImplementationOnce(async () => {
        throw {
          response: {
            status: 302,
            headers: { location: `${HOST}/UI/Login?realm=/` },
          },
        };
      })
      .mockImplementationOnce(authorizeThrow(400));
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.deploymentType).toBe('cloud');
    expect(result.conclusive).toBe(true);
    expect(result.responses.idmAdminClient).toEqual({
      status: 302,
      redirected: true,
    });
    expect(result.responses.idmAdminUi).toEqual({
      status: 400,
      redirected: false,
    });
  });

  test('forgeops: fidc client 400, forgeops client 302', async () => {
    authorize
      .mockImplementationOnce(authorizeThrow(400))
      .mockImplementationOnce(async () => {
        throw {
          response: {
            status: 302,
            headers: { location: `${HOST}/UI/Login?realm=/` },
          },
        };
      });
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.deploymentType).toBe('forgeops');
    expect(result.conclusive).toBe(true);
    expect(result.responses.idmAdminClient.redirected).toBe(false);
    expect(result.responses.idmAdminUi.redirected).toBe(true);
  });

  test('classic (elimination): both clients 400', async () => {
    authorize.mockImplementationOnce(authorizeThrow(400));
    authorize.mockImplementationOnce(authorizeThrow(400));
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.deploymentType).toBe('classic');
    expect(result.conclusive).toBe(true);
    expect(result.responses.idmAdminClient.redirected).toBe(false);
    expect(result.responses.idmAdminUi.redirected).toBe(false);
  });

  test('unreachable host: both probes fail without a response -> inconclusive', async () => {
    authorize.mockImplementationOnce(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    authorize.mockImplementationOnce(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    // still 'classic' for backward compatibility, but not to be trusted
    expect(result.deploymentType).toBe('classic');
    expect(result.conclusive).toBe(false);
    expect(result.responses.idmAdminClient.status).toBeUndefined();
    expect(result.responses.idmAdminUi.status).toBeUndefined();
  });

  test.each([
    ['both 404 (not an AM)', [404, 404]],
    ['both 403 (a gateway or WAF)', [403, 403]],
    ['one 400 and one 404', [400, 404]],
  ])('inconclusive: %s', async (_name, statuses) => {
    authorize.mockImplementationOnce(authorizeThrow(statuses[0]));
    authorize.mockImplementationOnce(authorizeThrow(statuses[1]));
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.conclusive).toBe(false);
  });

  test('inconclusive: a 302 that does not go to the AM login (a captive portal)', async () => {
    const elsewhere = () => {
      throw {
        response: {
          status: 302,
          headers: { location: 'https://portal.example.net/accept-terms' },
        },
      };
    };
    authorize.mockImplementationOnce(elsewhere);
    authorize.mockImplementationOnce(elsewhere);
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.conclusive).toBe(false);
  });

  test('inconclusive: both clients redirect to the login', async () => {
    const toLogin = () => {
      throw {
        response: {
          status: 302,
          headers: { location: `${HOST}/UI/Login?realm=/` },
        },
      };
    };
    authorize.mockImplementationOnce(toLogin);
    authorize.mockImplementationOnce(toLogin);
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.conclusive).toBe(false);
  });

  test('conclusive: one client redirects even if the other call fails', async () => {
    authorize
      .mockImplementationOnce(async () => {
        throw {
          response: {
            status: 302,
            headers: { location: `${HOST}/UI/Login?realm=/` },
          },
        };
      })
      .mockImplementationOnce(async () => {
        throw new Error('socket hang up');
      });
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.deploymentType).toBe('cloud');
    expect(result.conclusive).toBe(true);
  });

  test('each request times out after 8 seconds', async () => {
    authorize.mockImplementationOnce(authorizeThrow(400));
    authorize.mockImplementationOnce(authorizeThrow(400));
    await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    for (const call of authorize.mock.calls) {
      expect((call[0] as any).config.timeout).toBe(8000);
    }
  });

  test('requests are ANONYMOUS: no cookie header, csrf left empty', async () => {
    authorize.mockImplementationOnce(authorizeThrow(400));
    authorize.mockImplementationOnce(authorizeThrow(400));
    await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(authorize).toHaveBeenCalledTimes(2);
    for (const call of authorize.mock.calls) {
      const { amBaseUrl, data, config } = call[0] as any;
      expect(amBaseUrl).toBe(HOST);
      // Anonymous: no iPlanetDirectoryPro cookie anywhere in the config.
      expect(JSON.stringify(config.headers)).not.toMatch(
        /iPlanetDirectoryPro|Cookie/i
      );
      // csrf= with an EMPTY value (the probe never authenticates).
      expect(data).toMatch(/csrf=&/);
      // The redirect URI is the appAuthHelperRedirect one (registered on
      // both built-in clients). new URL('/platform/...', host) resolves
      // against the ORIGIN (the /am path drops) -- same construction as
      // determineDeploymentType and as the live-verified spike.
      expect(decodeURIComponent(data)).toContain(
        'redirect_uri=https://am.example.com/platform/appAuthHelperRedirect.html'
      );
      // PKCE pair travels with the request.
      expect(data).toMatch(/code_challenge_method=S256/);
    }
    // One probe per built-in client id, in a fixed order.
    const clientIds = authorize.mock.calls.map(
      (call) => (call[0] as any).data.match(/client_id=([^&]+)/)?.[1]
    );
    expect(clientIds).toEqual(['idmAdminClient', 'idm-admin-ui']);
  });
});
