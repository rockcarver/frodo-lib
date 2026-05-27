import { state } from '../index';
import * as AdminOps from './AdminOps';

describe('AdminOps', () => {
  describe('getAccessTokenUrl()', () => {
    test('0: Method is defined', () => {
      expect(AdminOps.getAccessTokenUrl).toBeDefined();
    });
    test('1: Normal call', () => {
      state.setHost('https://forgetest.someurl.com');
      expect(AdminOps.getAccessTokenUrl(state)).toBe('https://forgetest.someurl.com:443/oauth2/realms/root/access_token');
    });
    test('2: Normal call - http & no port', () => {
      state.setHost('http://forgetest.someurl.com');
      expect(AdminOps.getAccessTokenUrl(state)).toBe('http://forgetest.someurl.com:80/oauth2/realms/root/access_token');
    });
    test('3: Normal call - https & no port', () => {
      state.setHost('https://forgetest.someurl.com:443');
      expect(AdminOps.getAccessTokenUrl(state)).toBe('https://forgetest.someurl.com:443/oauth2/realms/root/access_token');
    });
    test('4: Normal call - http & port', () => {
      state.setHost('http://forgetest.someurl.com:80');
      expect(AdminOps.getAccessTokenUrl(state)).toBe('http://forgetest.someurl.com:80/oauth2/readlms/root/access_token');
    });
  });
});