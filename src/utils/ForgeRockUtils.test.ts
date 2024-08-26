/**
 * Run tests
 *
 *        npm run test ForgeRockUtils
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as ForgeRockUtils from './ForgeRockUtils';
import { state } from '../index';
import Constants from '../shared/Constants';

describe('ForgeRockUtils', () => {
  describe('getRealmUsingExportFormat()', () => {
    test('Should get root realm', () => {
      const realm = 'root';
      const testString = ForgeRockUtils.getRealmUsingExportFormat(realm);
      expect(testString).toBe('/');
    });

    test('Should get alpha realm', () => {
      const realm = 'root-alpha';
      const testString = ForgeRockUtils.getRealmUsingExportFormat(realm);
      expect(testString).toBe('/alpha');
    });

    test('Should handle nested realms', () => {
      const realm = 'root-alpha-beta-gamma';
      const testString = ForgeRockUtils.getRealmUsingExportFormat(realm);
      expect(testString).toBe('/alpha/beta/gamma');
    });
  });

  describe('getConfigPath()', () => {
    test('Should get global config path', () => {
      expect(ForgeRockUtils.getConfigPath(true)).toBe('global-config');
    });

    test('Should get realm config path', () => {
      expect(ForgeRockUtils.getConfigPath(false)).toBe('realm-config');
    });
  });

  describe('getRealmPathGlobal()', () => {
    test('Should return nothing for global', () => {
      expect(ForgeRockUtils.getRealmPathGlobal(true, state)).toBe('');
    });

    test('Should return current realm path for realm config', () => {
      const realm = '/parent/child';
      state.setRealm(realm);
      const testString = ForgeRockUtils.getRealmPathGlobal(false, state);
      expect(testString).toBe('/realms/root/realms/parent/realms/child');
    });
  });

  describe('getRealmPath()', () => {
    test("Should prepend realm path to specified realm 'alpha'", () => {
      const realm = 'alpha';
      const testString = ForgeRockUtils.getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should prepend realmPath to specified realm with leading slash', () => {
      const realm = '/alpha';
      const testString = ForgeRockUtils.getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test("'/' should resolve to root", () => {
      const realm = '/';
      const testString = ForgeRockUtils.getRealmPath(realm);
      expect(testString).toBe('/realms/root');
    });

    test('Should handle multiple leading slashes', () => {
      const realm = '//alpha';
      const testString = ForgeRockUtils.getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should handle nested realms', () => {
      const realm = '/parent/child';
      const testString = ForgeRockUtils.getRealmPath(realm);
      expect(testString).toBe('/realms/root/realms/parent/realms/child');
    });
  });

  describe('getCurrentRealmPath()', () => {
    test("Should prepend realm path to specified realm 'alpha'", () => {
      const realm = 'alpha';
      state.setRealm(realm);
      const testString = ForgeRockUtils.getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should prepend realmPath to specified realm with leading slash', () => {
      const realm = '/alpha';
      state.setRealm(realm);
      const testString = ForgeRockUtils.getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test("'/' should resolve to root", () => {
      const realm = '/';
      state.setRealm(realm);
      const testString = ForgeRockUtils.getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root');
    });

    test('Should handle multiple leading slashes', () => {
      const realm = '//alpha';
      state.setRealm(realm);
      const testString = ForgeRockUtils.getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/alpha');
    });

    test('Should handle nested realms', () => {
      const realm = '/parent/child';
      state.setRealm(realm);
      const testString = ForgeRockUtils.getCurrentRealmPath(state);
      expect(testString).toBe('/realms/root/realms/parent/realms/child');
    });
  });

  describe('getRealmManagedUser()', () => {
    test('getRealmManagedUser() 0: Method is implemented', async () => {
      expect(ForgeRockUtils.getCurrentRealmManagedUser).toBeDefined();
    });

    test('getRealmManagedUser() 1: should prepend realm to managed user type in identity cloud', () => {
      // Arrange
      const REALM = 'alpha';
      const DEPLOYMENT_TYPE = Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
      state.setRealm(REALM);
      state.setDeploymentType(DEPLOYMENT_TYPE);
      // Act
      const testString = ForgeRockUtils.getCurrentRealmManagedUser({ state });
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
      const testString = ForgeRockUtils.getCurrentRealmManagedUser({ state });
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
      const testString = ForgeRockUtils.getCurrentRealmManagedUser({ state });
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
      const testString = ForgeRockUtils.getCurrentRealmManagedUser({ state });
      // Assert
      expect(testString).toBe('user');
    });
  });

  describe('getHostUrl()', () => {
    test('Method is implemented', async () => {
      expect(ForgeRockUtils.getHostOnlyUrl).toBeDefined();
    });

    test('Should parse the https protocol and the hostname', () => {
      const URL_WITH_TENANT =
        'https://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';

      const parsed = ForgeRockUtils.getHostOnlyUrl(URL_WITH_TENANT);

      expect(parsed).toBe('https://example.frodo.com');
    });

    test('Should not validate protocol', () => {
      const URL_WITH_TENANT =
        'ftp://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
      const parsed = ForgeRockUtils.getHostOnlyUrl(URL_WITH_TENANT);
      expect(parsed).toBe('ftp://example.frodo.com');
    });

    test('Invalid URL should throw', () => {
      const URL_WITH_TENANT =
        '//:example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
      const trap = () => {
        ForgeRockUtils.getHostOnlyUrl(URL_WITH_TENANT);
      };
      expect(trap).toThrow('Invalid URL');
    });
  });

  describe('getIdmBaseUrl()', () => {
    test('Method is implemented', async () => {
      expect(ForgeRockUtils.getIdmBaseUrl).toBeDefined();
    });

    test(`By default should use AM host URL with default '/openidm' path`, () => {
      const AM_BASE_URL = 'https://example.frodo.com/am';
      const DEFAULT_IDM_BASE_URL = 'https://example.frodo.com/openidm';
      state.setHost(AM_BASE_URL);
      const idmBaseUrl = ForgeRockUtils.getIdmBaseUrl(state);
      expect(idmBaseUrl).toBe(DEFAULT_IDM_BASE_URL);
    });

    test('Should return override URL if specified', () => {
      const AM_BASE_URL = 'https://example.frodo.com/am';
      const CUSTOM_IDM_BASE_URL = 'https://example.frodo.com/idm';
      state.setHost(AM_BASE_URL);
      state.setIdmHost(CUSTOM_IDM_BASE_URL);
      const parsed = ForgeRockUtils.getIdmBaseUrl(state);
      expect(parsed).toBe(CUSTOM_IDM_BASE_URL);
    });
  });
});
