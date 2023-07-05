/**
 * Run tests
 *
 *        npm run test ApiUtils
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { getRealmPath, getCurrentRealmPath, getTenantURL } from './ApiUtils';
import { state } from '../../index';

describe.only('ApiUtils', () => {
  describe.only('getRealmPath()', () => {
    test("Should prepend realm path to specified realm 'alpha'", () => {
      const realm = 'alpha';
      const testString = getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should prepend realmPath to specified realm with leading slash', () => {
      const realm = '/alpha';
      const testString = getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test("'/' should resolve to root", () => {
      const realm = '/';
      const testString = getRealmPath(realm);
      expect(testString).toBe('/realms/root');
    });

    test('Should handle multiple leading slashes', () => {
      const realm = '//alpha';
      const testString = getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should handle nested realms', () => {
      const realm = '/parent/child';
      const testString = getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/parent/realms/child');
    });
  });

  describe.only('getCurrentRealmPath()', () => {
    test("Should prepend realm path to specified realm 'alpha'", () => {
      const realm = 'alpha';
      state.setRealm(realm);
      const testString = getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should prepend realmPath to specified realm with leading slash', () => {
      const realm = '/alpha';
      state.setRealm(realm);
      const testString = getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test("'/' should resolve to root", () => {
      const realm = '/';
      state.setRealm(realm);
      const testString = getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root');
    });

    test('Should handle multiple leading slashes', () => {
      const realm = '//alpha';
      state.setRealm(realm);
      const testString = getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should handle nested realms', () => {
      const realm = '/parent/child';
      state.setRealm(realm);
      const testString = getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/parent/realms/child');
    });
  });

  describe.only('getTenantURL()', () => {
    test('Should parse the https protocol and the hostname', () => {
      const URL_WITH_TENANT =
        'https://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';

      const parsed = getTenantURL(URL_WITH_TENANT);

      expect(parsed).toBe('https://example.frodo.com');
    });

    test('Should not validate protocol', () => {
      const URL_WITH_TENANT =
        'ftp://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
      const parsed = getTenantURL(URL_WITH_TENANT);
      expect(parsed).toBe('ftp://example.frodo.com');
    });

    test('Invalid URL should throw', () => {
      const URL_WITH_TENANT =
        '//:example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
      const trap = () => {
        getTenantURL(URL_WITH_TENANT);
      };
      expect(trap).toThrow('Invalid URL');
    });
  });
});
