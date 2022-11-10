import mockfs from 'mock-fs';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Idm, state } from '../index';
import * as global from '../storage/StaticStorage';
import {
  mockListAllConfigEntities,
  mockPutConfigEntity,
} from '../test/mocks/ForgeRockApiMockEngine';
import path, { resolve } from 'path';

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

describe('IdmOps - importAllConfigEntities()', () => {
  test('importAllConfigEntities() 0: Method is implemented', async () => {
    expect(Idm.importAllConfigEntities).toBeDefined();
  });
});

describe('IdmOps - importAllRawConfigEntities()', () => {
  test('importAllRawConfigEntities() 0: Method is implemented', async () => {
    expect(Idm.importAllRawConfigEntities).toBeDefined();
  });
});

describe('IdmOps - importConfigEntity()', () => {
  beforeEach(() => {
    mockfs({
      'emailTemplatewelcome.idm.json': mockfs.load(
        resolve(
          path.dirname('.'),
          './src/test/mocks/IdmConfigApi/getConfigEntity/emailTemplate/welcome.json'
        )
      ),
    });
  });
  test('importConfigEntity() 0: Method is implemented', async () => {
    expect(Idm.importConfigEntity).toBeDefined();
  });

  test('importConfigEntity() 1: Import a config entity', async () => {
    let uploaded: string | null = null;
    mockPutConfigEntity(mock, (id, data) => {
      uploaded = data;
    });

    await Idm.importConfigEntity('emailTemplate/welcome');

    expect(uploaded).toBeDefined();

    // Restore fs so we may use snapshots
    mockfs.restore();
    expect(uploaded).toMatchSnapshot();
  });

  afterEach(() => {
    mockfs.restore();
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
