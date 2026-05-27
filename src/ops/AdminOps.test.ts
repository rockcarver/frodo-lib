import { state } from '../index';
import * as AdminOps from './AdminOps';

describe('Test AdminOps.getAccessTokeUrl', () => {
  test('0: Method is implemented', async () => {
    expect(AdminOps.getAccessTokenUrl).toBeDefined();
  });
  test('1: normal call, https & no port', async () => {
    state.setHost("https://forgetest.someurl.com")
    expect(AdminOps.getAccessTokenUrl(state)).toBe("https://forgetest.someurl.com:443/oauth2/realms/root/access_token");
  });
  test('2: normal call, http & no port', async () => {
    state.setHost("http://forgetest.someurl.com")
    expect(AdminOps.getAccessTokenUrl(state)).toBe("http://forgetest.someurl.com:80/oauth2/realms/root/access_token");
  });
  test('3: normal call, https & port', async () => {
    state.setHost("https://forgetest.someurl.com:443")
    expect(AdminOps.getAccessTokenUrl(state)).toBe("https://forgetest.someurl.com:443/oauth2/realms/root/access_token");
  });
  test('4: normal call, http & port', async () => {
    state.setHost("http://forgetest.someurl.com:80")
    expect(AdminOps.getAccessTokenUrl(state)).toBe("http://forgetest.someurl.com:80/oauth2/realms/root/access_token");
  });
});

