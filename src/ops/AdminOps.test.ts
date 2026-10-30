import { state } from '../index';
import * as AdminOps from './AdminOps';

describe('AdminOps', () => {
  describe('getAccessTokenUrl()', () => {
    test('0: Method is defined', () => {
      expect(AdminOps.getAccessTokenUrl).toBeDefined();
    });
    test('1: Normal call', () => {
      state.setHost('https://forgetest.someurl.com');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'https://forgetest.someurl.com:443/oauth2/realms/root/access_token'
      );
    });
    test('2: Normal call - http & no port', () => {
      state.setHost('http://forgetest.someurl.com');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'http://forgetest.someurl.com:80/oauth2/realms/root/access_token'
      );
    });
    test('3: Normal call - https & no port', () => {
      state.setHost('https://forgetest.someurl.com:443');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'https://forgetest.someurl.com:443/oauth2/realms/root/access_token'
      );
    });
    test('4: Normal call - http & port', () => {
      state.setHost('http://forgetest.someurl.com:80');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'http://forgetest.someurl.com:80/oauth2/realms/root/access_token'
      );
    });
    test('5: https & non-default port keeps the port once', () => {
      state.setHost('https://forgetest.someurl.com:8443/openam');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'https://forgetest.someurl.com:8443/openam/oauth2/realms/root/access_token'
      );
    });
    test('6: http & non-default port keeps the port once', () => {
      state.setHost('http://localhost:8080/am');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'http://localhost:8080/am/oauth2/realms/root/access_token'
      );
    });
    test('7: IPv6 host with a non-default port', () => {
      state.setHost('https://[::1]:8443/am');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'https://[::1]:8443/am/oauth2/realms/root/access_token'
      );
    });
    test('8: IPv6 host without a port gets the default port', () => {
      state.setHost('https://[::1]/am');
      expect(AdminOps.getAccessTokenUrl(state)).toBe(
        'https://[::1]:443/am/oauth2/realms/root/access_token'
      );
    });
  });
});
