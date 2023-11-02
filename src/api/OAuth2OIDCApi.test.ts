/**
 * Don't convert this to Polly. Once MFA is enforced for tenant admins in ID Cloud,
 * it will be very cumbersome to use Polly for OAuth API calls, as they require an
 * admin user session, not a service account bearer token.
 *
 * Run tests
 *
 *        npm run test OAuth2OIDCApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as OAuth2OIDCApi from './OAuth2OIDCApi';
import { state } from '../index';
import Constants from '../shared/Constants';
import {
  mockAuthorize,
  mockAccessToken,
} from '../test/mocks/ForgeRockApiMockEngine';
import { parseUrl } from '../utils/ExportImportUtils';

const mock = new MockAdapter(axios);

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setUserSessionTokenMeta({
  tokenId: 'cookieValue',
  realm: '/realm',
  successUrl: 'url',
  expires: 0,
});
state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('OAuth2OIDCApi', () => {
  describe('authorize()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2OIDCApi.authorize).toBeDefined();
    });

    test('1: Get authorization code', async () => {
      mockAuthorize(mock);
      const bodyFormData = `redirect_uri=https://openam-volker-dev.forgeblocks.com/platform/appAuthHelperRedirect.html&scope=fr:idm:* openid&response_type=code&client_id=idmAdminClient&csrf=${state.getCookieValue()}&decision=allow&code_challenge=l_UNfjLP_eRKwLtvM2M86PxhF2pZyYp629TfJUqDNHY&code_challenge_method=S256`;
      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        validateStatus: function (status: number) {
          // if this function returns true, no exception is thrown on a 302, which is the expected status code.
          return status === 302;
        },
      };
      const response = await OAuth2OIDCApi.authorize({
        amBaseUrl: state.getHost() as string,
        data: bodyFormData,
        config,
        state,
      });
      const redirectLocationURL = response.headers['location'];
      const parsed = parseUrl(redirectLocationURL);
      expect(response.status).toBe(302);
      expect(parsed.searchParam['code']).toBeTruthy();
    });
  });

  describe('accessToken()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2OIDCApi.accessToken).toBeDefined();
    });

    test('1: Get access token', async () => {
      mockAccessToken(mock);
      const bodyFormData = `grant_type=authorization_code&code=PMA6VB9U_Ctiv6q8CAGphy_1vwQ&redirect_uri=https://openam-volker-dev.forgeblocks.com/platform/appAuthHelperRedirect.html&code_verifier=QchYMz4ApoxmyZaFs0MJwZK9rmc8WU-kuoi3JM--CZq7-LmmtxB6_Lf0AtmumFFdOxY&client_id=idmAdminClient`;
      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      const response = await OAuth2OIDCApi.accessToken({
        amBaseUrl: state.getHost() as string,
        postData: bodyFormData,
        config,
        state,
      });
      expect(response.access_token).toBeTruthy();
    });
  });
});
