import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OAuth2OIDCApi, state } from '../index';
import * as global from '../storage/StaticStorage';
import {
  mockAuthorize,
  mockAccessToken,
} from '../test/mocks/ForgeRockApiMockEngine';
import { parseUrl } from './utils/ApiUtils';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe.only('OAuth2OIDCApi - authorize()', () => {
  test('authorize() 0: Method is implemented', async () => {
    expect(OAuth2OIDCApi.authorize).toBeDefined();
  });

  test('authorize() 1: Get authorization code', async () => {
    mockAuthorize(mock);
    const bodyFormData =
      'redirect_uri=https://openam-volker-dev.forgeblocks.com/platform/appAuthHelperRedirect.html&scope=fr:idm:* openid&response_type=code&client_id=idmAdminClient&csrf=763l9tYj7oSimiLGWmlDWOXE0A0.*AAJTSQACMDIAAlNLABw1bXppOGZDVGwzblJnNkJlY08ydFZtWWtvbjQ9AAR0eXBlAANDVFMAAlMxAAIwMQ..*&decision=allow&code_challenge=l_UNfjLP_eRKwLtvM2M86PxhF2pZyYp629TfJUqDNHY&code_challenge_method=S256';
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      validateStatus: function (status: number) {
        // if this function returns true, no exception is thrown on a 302, which is the expected status code.
        return status === 302;
      },
    };
    const response = await OAuth2OIDCApi.authorize(bodyFormData, config);
    const redirectLocationURL = response.headers['location'];
    const parsed = parseUrl(redirectLocationURL);
    expect(response.status).toBe(302);
    expect(parsed.searchParam['code']).toBeTruthy();
  });
});

describe.only('OAuth2OIDCApi - accessToken()', () => {
  test('accessToken() 0: Method is implemented', async () => {
    expect(OAuth2OIDCApi.accessToken).toBeDefined();
  });

  test('accessToken() 1: Get access token', async () => {
    mockAccessToken(mock);
    const bodyFormData =
      'grant_type=authorization_code&code=PMA6VB9U_Ctiv6q8CAGphy_1vwQ&redirect_uri=https://openam-volker-dev.forgeblocks.com/platform/appAuthHelperRedirect.html&code_verifier=QchYMz4ApoxmyZaFs0MJwZK9rmc8WU-kuoi3JM--CZq7-LmmtxB6_Lf0AtmumFFdOxY&client_id=idmAdminClient';
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
    const response = await OAuth2OIDCApi.accessToken(bodyFormData, config);
    expect(response.status).toBe(200);
    expect(response.data.access_token).toBeTruthy();
  });
});
