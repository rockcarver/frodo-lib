import { getRealmManagedUser } from './OpsUtils';
import sessionStorage from '../../storage/SessionStorage';
import {
  CLOUD_DEPLOYMENT_TYPE_KEY,
  FORGEOPS_DEPLOYMENT_TYPE_KEY,
  CLASSIC_DEPLOYMENT_TYPE_KEY,
} from '../../storage/StaticStorage';

describe('OpsUtils', () => {
  test('getRealmManagedUser should prepend realm to managed user type in identity cloud', () => {
    // Arrange
    const REALM = 'alpha';
    const DEPLOYMENT_TYPE = CLOUD_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = getRealmManagedUser();
    // Assert
    expect(testString).toBe('alpha_user');
  });

  test('getCurrentRealmPath should prepend realm without leading slash to managed user type in identity cloud', () => {
    // Arrange
    const REALM = '/alpha';
    const DEPLOYMENT_TYPE = CLOUD_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = getRealmManagedUser();
    // Assert
    expect(testString).toBe('alpha_user');
  });

  test('getRealmManagedUser should not prepend realm to managed user type in forgeops deployments', () => {
    // Arrange
    const REALM = 'alpha';
    const DEPLOYMENT_TYPE = FORGEOPS_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = getRealmManagedUser();
    // Assert
    expect(testString).toBe('user');
  });

  test('getRealmManagedUser should not prepend realm to managed user type in classic deployments', () => {
    // Arrange
    const REALM = 'alpha';
    const DEPLOYMENT_TYPE = CLASSIC_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = getRealmManagedUser();
    // Assert
    expect(testString).toBe('user');
  });
});
