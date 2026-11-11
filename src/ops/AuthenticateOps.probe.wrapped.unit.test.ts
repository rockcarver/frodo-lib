/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.probe.wrapped
 *
 * probeDeploymentType() classifies the deployment by the answers of `/oauth2/authorize` to the two built-in admin
 * clients (see AuthenticateOps.probe.unit.test.ts). The answer is the 302 or 400 that axios raises as an error. The
 * ops function `authorize` wraps that error in a FrodoError (frodo-lib#1033), so the probe must read the response
 * from the wrapped error exactly as it reads it from the raw one. The same holds for the deployment detection and the
 * authorization code of a login, which use the same answers; recorded tests cover those.
 *
 * Mocked unit test: no recordings, no tenant.
 */
import { jest } from '@jest/globals';
import { FrodoError } from './FrodoError';

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

/** What `authorize` throws for an answer of the server: a FrodoError that wraps the error axios raised. */
function wrappedAnswer(status: number) {
  return async () => {
    const answer: any = new Error(`Request failed with status code ${status}`);
    answer.name = 'AxiosError';
    answer.response = {
      status,
      headers: { location: status === 302 ? `${HOST}/UI/Login?realm=/` : '' },
    };
    throw new FrodoError('Error authorizing oauth2 client', answer);
  };
}

beforeEach(() => {
  authorize.mockReset();
});

describe('AuthenticateOps.probeDeploymentType reads the answer from the FrodoError of authorize', () => {
  test.each([
    ['cloud', [302, 400]],
    ['forgeops', [400, 302]],
    ['classic', [400, 400]],
  ])('%s', async (deploymentType, [fidc, forgeops]) => {
    authorize
      .mockImplementationOnce(wrappedAnswer(fidc))
      .mockImplementationOnce(wrappedAnswer(forgeops));
    const result = await AuthenticateOps(
      StateImpl({ host: HOST, useTokenCache: false })
    ).probeDeploymentType(HOST);
    expect(result.deploymentType).toBe(deploymentType);
    expect(result.conclusive).toBe(true);
    expect(result.responses.idmAdminClient).toEqual({
      status: fidc,
      redirected: fidc === 302,
    });
    expect(result.responses.idmAdminUi).toEqual({
      status: forgeops,
      redirected: forgeops === 302,
    });
  });
});
