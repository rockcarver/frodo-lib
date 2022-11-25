import mockfs from 'mock-fs';
import fs from 'fs';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { fileURLToPath } from 'url';
import { Idm, state } from '../index';
import * as global from '../storage/StaticStorage';
import {
  mockGetAllConfigEntities,
  mockPutConfigEntity,
  mockGetConfigEntity,
  mockGetConfigEntitiesByType,
} from '../test/mocks/ForgeRockApiMockEngine';
import path, { resolve } from 'path';

const mock = new MockAdapter(axios);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('IdmOps - getAllConfigEntities()', () => {
  test('getAllConfigEntities() 0: Method is implemented', async () => {
    expect(Idm.getAllConfigEntities).toBeDefined();
  });
  test('getAllConfigEntities() 1: get all config entities', async () => {
    mockGetAllConfigEntities(mock);
    expect.assertions(2);
    const configEntities = await Idm.getAllConfigEntities();
    expect(configEntities).toBeTruthy();
    expect(configEntities.configurations.length).toBeGreaterThan(0);
  });
});

describe('IdmOps - getConfigEntitiesByType()', () => {
  test('getConfigEntitiesByType() 0: Method is implemented', async () => {
    expect(Idm.getConfigEntitiesByType).toBeDefined();
  });
  test('getConfigEntitiesByType() 1: Get config entity by type', async () => {
    mockGetConfigEntitiesByType(mock);
    expect.assertions(2);
    const configEntity = await Idm.getConfigEntitiesByType('emailTemplate');
    expect(configEntity).toBeTruthy();
    expect(configEntity).toMatchSnapshot();
  });
});

describe('IdmOps - getConfigEntity()', () => {
  test('getConfigEntity() 0: Method is implemented', async () => {
    expect(Idm.getConfigEntity).toBeDefined();
  });
  test('getConfigEntity() 1: Get config entity by Id', async () => {
    mockGetConfigEntity(mock);
    // expect.assertions(2);
    const configEntity = await Idm.getConfigEntity('managed');
    expect(configEntity).toBeTruthy();
    expect(configEntity).toMatchSnapshot();
  });
});

describe('IdmOps - putConfigEntity()', () => {
  test('putConfigEntity() 0: Method is implemented', async () => {
    expect(Idm.putConfigEntity).toBeDefined();
  });

  test('putConfigEntity() 1: Put a config entity', async () => {
    const templateData = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/IdmConfigApi/getConfigEntity/emailTemplate/welcome.json'
        ),
        'utf8'
      )
    );

    let uploaded: string | null = null;
    mockPutConfigEntity(mock, (id, data) => {
      uploaded = data;
    });

    await Idm.putConfigEntity('emailTemplate/welcome', templateData);

    expect(uploaded).toBeDefined();

    expect(uploaded).toMatchSnapshot();
  });
});

describe('IdmOps - queryAllManagedObjectsByType()', () => {
  test('queryAllManagedObjectsByType() 0: Method is implemented', async () => {
    expect(Idm.queryAllManagedObjectsByType).toBeDefined();
  });
});
