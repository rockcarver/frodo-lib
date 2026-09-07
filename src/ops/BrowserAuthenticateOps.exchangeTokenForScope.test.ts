/**
 * Run tests
 *
 *        npm run test:only BrowserAuthenticateOps.exchangeTokenForScope
 */
import { jest } from '@jest/globals';

const accessToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('accessToken mock not configured for this call');
});
const deviceAuthorizationRequest = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('deviceAuthorizationRequest mock not configured for this call');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  accessToken,
  deviceAuthorizationRequest,
}));

const { exchangeTokenForScope } = await import('./BrowserAuthenticateOps');
const { default: StateImpl } = await import('../shared/State');

function encodeSegment(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function fakeJwt(payload: object): string {
  const header = encodeSegment({ typ: 'JWT', alg: 'RS256' });
  const body = encodeSegment(payload);
  return `${header}.${body}.fake-signature`;
}

describe('BrowserAuthenticateOps.exchangeTokenForScope', () => {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
  });

  beforeEach(() => {
    accessToken.mockReset();
  });

  test('0: Method is implemented', () => {
    expect(exchangeTokenForScope).toBeDefined();
  });

  test('1: Reads the exchange client id from the subject token\'s may_act claim when not explicitly supplied', async () => {
    accessToken.mockResolvedValueOnce({
      access_token: 'exchanged-token',
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 40,
      expires: Date.now() + 40_000,
    });
    const subjectToken = fakeJwt({
      sub: 'user-1',
      may_act: { client_id: 'AICMCPExchangeClient' },
    });

    const token = await exchangeTokenForScope({
      subjectToken,
      scope: 'fr:am:*',
      state,
    });

    expect(token.access_token).toBe('exchanged-token');
    expect(accessToken).toHaveBeenCalledTimes(1);
    const call = accessToken.mock.calls[0][0] as { amBaseUrl: string; data: string };
    expect(call.amBaseUrl).toBe('https://openam-example.forgeblocks.com/am');
    expect(call.data).toContain(
      'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange'
    );
    expect(call.data).toContain(`subject_token=${encodeURIComponent(subjectToken)}`);
    expect(call.data).toContain('scope=fr%3Aam%3A*');
    expect(call.data).toContain('client_id=AICMCPExchangeClient');
  });

  test('2: An explicit exchangeClientId overrides the may_act claim', async () => {
    accessToken.mockResolvedValueOnce({
      access_token: 'exchanged-token',
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 40,
      expires: Date.now() + 40_000,
    });
    const subjectToken = fakeJwt({ may_act: { client_id: 'ClaimedClient' } });

    await exchangeTokenForScope({
      subjectToken,
      scope: 'fr:am:*',
      exchangeClientId: 'ExplicitClient',
      state,
    });

    const call = accessToken.mock.calls[0][0] as { data: string };
    expect(call.data).toContain('client_id=ExplicitClient');
  });

  test('3: Throws when neither an explicit exchangeClientId nor a may_act claim is available', async () => {
    const subjectToken = fakeJwt({ sub: 'user-1' });

    await expect(
      exchangeTokenForScope({ subjectToken, scope: 'fr:am:*', state })
    ).rejects.toThrow(/no exchangeClientId was provided/);
    expect(accessToken).not.toHaveBeenCalled();
  });

  test('4: A malformed subject token is treated the same as a missing may_act claim, not a crash', async () => {
    await expect(
      exchangeTokenForScope({ subjectToken: 'not-a-jwt', scope: 'fr:am:*', state })
    ).rejects.toThrow(/no exchangeClientId was provided/);
  });
});
