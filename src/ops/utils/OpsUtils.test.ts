import * as OpsUtils from './OpsUtils';
import sessionStorage from '../../storage/SessionStorage';
import {
  CLOUD_DEPLOYMENT_TYPE_KEY,
  FORGEOPS_DEPLOYMENT_TYPE_KEY,
  CLASSIC_DEPLOYMENT_TYPE_KEY,
} from '../../storage/StaticStorage';

describe('OpsUtils - getRealmManagedUser()', () => {
  test('getRealmManagedUser() 0: Method is implemented', async () => {
    expect(OpsUtils.getRealmManagedUser).toBeDefined();
  });

  test('getRealmManagedUser() 1: should prepend realm to managed user type in identity cloud', () => {
    // Arrange
    const REALM = 'alpha';
    const DEPLOYMENT_TYPE = CLOUD_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = OpsUtils.getRealmManagedUser();
    // Assert
    expect(testString).toBe('alpha_user');
  });

  test('getRealmManagedUser() 2: should prepend realm without leading slash to managed user type in identity cloud', () => {
    // Arrange
    const REALM = '/alpha';
    const DEPLOYMENT_TYPE = CLOUD_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = OpsUtils.getRealmManagedUser();
    // Assert
    expect(testString).toBe('alpha_user');
  });

  test('getRealmManagedUser() 3: should not prepend realm to managed user type in forgeops deployments', () => {
    // Arrange
    const REALM = 'alpha';
    const DEPLOYMENT_TYPE = FORGEOPS_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = OpsUtils.getRealmManagedUser();
    // Assert
    expect(testString).toBe('user');
  });

  test('getRealmManagedUser() 4: should not prepend realm to managed user type in classic deployments', () => {
    // Arrange
    const REALM = 'alpha';
    const DEPLOYMENT_TYPE = CLASSIC_DEPLOYMENT_TYPE_KEY;
    sessionStorage.session.setRealm(REALM);
    sessionStorage.session.setDeploymentType(DEPLOYMENT_TYPE);
    // Act
    const testString = OpsUtils.getRealmManagedUser();
    // Assert
    expect(testString).toBe('user');
  });
});

describe('OpsUtils - isEqualJson()', () => {
  test('isEqualJson() 0: Method is implemented', async () => {
    expect(OpsUtils.isEqualJson).toBeDefined();
  });

  test('isEqualJson() 1: two empty objects should be equal', () => {
    const obj1 = {};
    const obj2 = {};
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeTruthy();
  });

  test('isEqualJson() 2: two objects with single and equal entry should be equal', () => {
    const obj1 = { key: 'value' };
    const obj2 = { key: 'value' };
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeTruthy();
  });

  test('isEqualJson() 3: two objects with equal key but different value should not be equal', () => {
    const obj1 = { key: 'value1' };
    const obj2 = { key: 'value2' };
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeFalsy();
  });

  test('isEqualJson() 4: two objects with differing keys but equal values should not be equal', () => {
    const obj1 = { key1: 'value' };
    const obj2 = { key2: 'value' };
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeFalsy();
  });

  test('isEqualJson() 5: two objects with unequal amounts of entries should not be equal', () => {
    const obj1 = { key1: 'value' };
    const obj2 = { key1: 'value', key2: 'value2' };
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeFalsy();
  });

  test('isEqualJson() 6: two objects with equal but nested keys should be equal', () => {
    const obj1 = { key1: 'value1', key2: { key3: 'value3' } };
    const obj2 = { key1: 'value1', key2: { key3: 'value3' } };
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeTruthy();
  });

  test('isEqualJson() 7: two objects with equal but multi-nested keys should be equal', () => {
    const obj1 = {
      key1: 'value1',
      key2: {
        key3: 'value3',
        key4: {
          key5: 'value5',
        },
      },
    };
    const obj2 = {
      key1: 'value1',
      key2: {
        key3: 'value3',
        key4: {
          key5: 'value5',
        },
      },
    };
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeTruthy();
  });

  test('isEqualJson() 8: two objects with equal multi-nested keys but unequal values should not be equal', () => {
    const obj1 = {
      key1: 'value1',
      key2: {
        key3: 'value3',
        key4: {
          key5: 'value5',
        },
      },
    };
    const obj2 = {
      key1: 'value1',
      key2: {
        key3: 'value3',
        key4: {
          key5: 'value',
        },
      },
    };
    expect(OpsUtils.isEqualJson(obj1, obj2)).toBeFalsy();
  });

  test('isEqualJson() 9: two objects with equal multi-nested keys but unequal values with the offending key excluded should be equal', () => {
    const obj1 = {
      key1: 'value1',
      key2: {
        key3: 'value3',
        key4: {
          key5: 'value5',
        },
      },
    };
    const obj2 = {
      key1: 'value1',
      key2: {
        key3: 'value3',
        key4: {
          key5: 'value',
        },
      },
    };
    expect(OpsUtils.isEqualJson(obj1, obj2, ['key5'])).toBeTruthy();
  });
});
