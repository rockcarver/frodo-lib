import {
  getCurrentRealmPath,
  getTenantURL,
} from './ApiUtils.js';
import sessionStorage from '../../storage/SessionStorage.js';

test.skip('replaceAll should be deleted because it works like native String.replaceAll', () => {
  // Arrange
  // Act
  // Assert
  expect(true).toBe(false);
});

test('getCurrentRealmPath should prepend realmPath to specified realm', () => {
  // Arrange
  const REALM_PATH = 'alpha';
  sessionStorage.session.setItem('realm', REALM_PATH);
  // Act
  const testString = getCurrentRealmPath(REALM_PATH);
  // Assert
  expect(testString).toBe('/realms/root/realms/alpha');
});

test('getCurrentRealmPath should prepend realmPath to specified realm with leading slash', () => {
  // Arrange
  const REALM_PATH = '/alpha';
  sessionStorage.session.setItem('realm', REALM_PATH);
  // Act
  const testString = getCurrentRealmPath(REALM_PATH);
  // Assert
  expect(testString).toBe('/realms/root/realms/alpha');
});

test('getCurrentRealmPath "/" should resolve to root', () => {
  // Arrange
  const REALM_PATH = '/';
  sessionStorage.session.setItem('realm', REALM_PATH);
  // Act
  const testString = getCurrentRealmPath(REALM_PATH);
  // Assert
  expect(testString).toBe('/realms/root');
});

test('getCurrentRealmPath should not handle multiple leading slash', () => {
  // Arrange
  const REALM_PATH = '//alpha';
  sessionStorage.session.setItem('realm', REALM_PATH);
  // Act
  const testString = getCurrentRealmPath(REALM_PATH);
  // Assert
  expect(testString).toBe('/realms/root/realms//alpha');
});

test('getCurrentRealmPath should not handle nested depth realms', () => {
  // Arrange
  const REALM_PATH = '/alpha/erm';
  sessionStorage.session.setItem('realm', REALM_PATH);
  // Act
  const testString = getCurrentRealmPath(REALM_PATH);
  // Assert
  expect(testString).toBe('/realms/root/realms/alpha/erm');
});

test('getTenantURL should parse the https protocol and the hostname', () => {
  // Arrange
  const URL_WITH_TENANT =
    'https://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';

  // Act
  const parsed = getTenantURL(URL_WITH_TENANT);

  // Assert
  expect(parsed).toBe('https://example.frodo.com');
});

test('getTenantURL should not validate protocol', () => {
  // Arrange
  const URL_WITH_TENANT =
    'ftp://example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
  // Act
  const parsed = getTenantURL(URL_WITH_TENANT);
  // Assert
  expect(parsed).toBe('ftp://example.frodo.com');
});

test('getTenantURL Invalid URL should throw', () => {
  // Arrange
  const URL_WITH_TENANT =
    '//:example.frodo.com/am/ui-admin/#realms/%2Falpha/dashboard';
  // Act
  const trap = () => {
    getTenantURL(URL_WITH_TENANT);
  };
  // Assert
  expect(trap).toThrow('Invalid URL');
});
