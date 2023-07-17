/**
 * Run tests
 *
 *        npm run test ForgeRockUtils
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import {
  getRealmPath,
  getCurrentRealmPath,
  getHostBaseUrl,
  getCurrentRealmManagedUser,
} from './ForgeRockUtils';
import { state } from '../index';
import Constants from '../shared/Constants';

describe('ForgeRockUtils', () => {
  describe('getRealmPath()', () => {
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

  describe('getCurrentRealmPath()', () => {
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

  describe('getTenantURL()', () => {
    test('Should parse the https protocol and the hostname', () => {
      const URL_WITH_TENANT =
        'https://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';

      const parsed = getHostBaseUrl(URL_WITH_TENANT);

      expect(parsed).toBe('https://example.frodo.com');
    });

    test('Should not validate protocol', () => {
      const URL_WITH_TENANT =
        'ftp://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
      const parsed = getHostBaseUrl(URL_WITH_TENANT);
      expect(parsed).toBe('ftp://example.frodo.com');
    });

    test('Invalid URL should throw', () => {
      const URL_WITH_TENANT =
        '//:example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
      const trap = () => {
        getHostBaseUrl(URL_WITH_TENANT);
      };
      expect(trap).toThrow('Invalid URL');
    });
  });

  describe('OpsUtils - getRealmManagedUser()', () => {
    test('getRealmManagedUser() 0: Method is implemented', async () => {
      expect(getCurrentRealmManagedUser).toBeDefined();
    });

    test('getRealmManagedUser() 1: should prepend realm to managed user type in identity cloud', () => {
      // Arrange
      const REALM = 'alpha';
      const DEPLOYMENT_TYPE = Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
      state.setRealm(REALM);
      state.setDeploymentType(DEPLOYMENT_TYPE);
      // Act
      const testString = getCurrentRealmManagedUser({ state });
      // Assert
      expect(testString).toBe('alpha_user');
    });

    test('getRealmManagedUser() 2: should prepend realm without leading slash to managed user type in identity cloud', () => {
      // Arrange
      const REALM = '/alpha';
      const DEPLOYMENT_TYPE = Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
      state.setRealm(REALM);
      state.setDeploymentType(DEPLOYMENT_TYPE);
      // Act
      const testString = getCurrentRealmManagedUser({ state });
      // Assert
      expect(testString).toBe('alpha_user');
    });

    test('getRealmManagedUser() 3: should not prepend realm to managed user type in forgeops deployments', () => {
      // Arrange
      const REALM = 'alpha';
      const DEPLOYMENT_TYPE = Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
      state.setRealm(REALM);
      state.setDeploymentType(DEPLOYMENT_TYPE);
      // Act
      const testString = getCurrentRealmManagedUser({ state });
      // Assert
      expect(testString).toBe('user');
    });

    test('getRealmManagedUser() 4: should not prepend realm to managed user type in classic deployments', () => {
      // Arrange
      const REALM = 'alpha';
      const DEPLOYMENT_TYPE = Constants.CLASSIC_DEPLOYMENT_TYPE_KEY;
      state.setRealm(REALM);
      state.setDeploymentType(DEPLOYMENT_TYPE);
      // Act
      const testString = getCurrentRealmManagedUser({ state });
      // Assert
      expect(testString).toBe('user');
    });
  });
});
