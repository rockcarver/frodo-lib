import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Idm, state } from '../index';
import * as global from '../storage/StaticStorage';
import { mockListAllConfigEntities } from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('IdmOps - countManagedObjects()', () => {
  test('countManagedObjects() 0: Method is implemented', async () => {
    expect(Idm.countManagedObjects).toBeDefined();
  });
});

describe('IdmOps - exportAllConfigEntities()', () => {
  test('exportAllConfigEntities() 0: Method is implemented', async () => {
    expect(Idm.exportAllConfigEntities).toBeDefined();
  });
});

describe('IdmOps - exportAllRawConfigEntities()', () => {
  test('exportAllRawConfigEntities() 0: Method is implemented', async () => {
    expect(Idm.exportAllRawConfigEntities).toBeDefined();
  });
});

describe('IdmOps - exportConfigEntity()', () => {
  test('exportConfigEntity() 0: Method is implemented', async () => {
    expect(Idm.exportConfigEntity).toBeDefined();
  });
});

describe('IdmOps - listAllConfigEntities()', () => {
  test('listAllConfigEntities() 0: Method is implemented', async () => {
    expect(Idm.listAllConfigEntities).toBeDefined();
  });

  test('listSocialProviders() 1: List social identity providers', async () => {
    mockListAllConfigEntities(mock);
    expect.assertions(1);
    await Idm.listAllConfigEntities();
    expect(true).toBeTruthy();
  });
});
