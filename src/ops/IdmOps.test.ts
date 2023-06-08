/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record IdmOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IdmOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IdmOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as IdmConfigApi from '../api/IdmConfigApi';
import * as IdmOps from './IdmOps';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

async function stageConfigEntity(
  configEntity: { id: string; data: object },
  create = true
) {
  // delete if exists, then create
  try {
    await IdmConfigApi.getConfigEntity({ entityId: configEntity.id, state });
    await IdmConfigApi.deleteConfigEntity({ entityId: configEntity.id, state });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await IdmConfigApi.putConfigEntity({
        entityId: configEntity.id,
        entityData: configEntity.data,
        state,
      });
    }
  }
}

describe('IdmOps', () => {
  const configEntity1 = {
    id: 'emailTemplate/FrodoTestConfigEntity1',
    data: {
      defaultLocale: 'en',
      displayName: 'Frodo Test Email Template One',
      enabled: true,
      from: '',
      message: {
        en: '<h3>Click to reset your password</h3><h4><a href="{{object.resumeURI}}">Password reset link</a></h4>',
        fr: '<h3>Cliquez pour réinitialiser votre mot de passe</h3><h4><a href="{{object.resumeURI}}">Mot de passe lien de réinitialisation</a></h4>',
      },
      mimeType: 'text/html',
      subject: {
        en: 'Reset your password',
        fr: 'Réinitialisez votre mot de passe',
      },
    },
  };
  const configEntity2 = {
    id: 'emailTemplate/FrodoTestConfigEntity2',
    data: {
      defaultLocale: 'en',
      displayName: 'Frodo Test Email Template Two',
      enabled: true,
      from: '',
      message: {
        en: '<h3>This is your one-time password:</h3><h4>{{object.description}}</a></h4>',
      },
      mimeType: 'text/html',
      subject: {
        en: 'One-Time Password for login',
      },
    },
  };
  const configEntity3 = {
    id: 'emailTemplate/FrodoTestConfigEntity3',
    data: {
      defaultLocale: 'en',
      displayName: 'Frodo Test Email Template Three',
      enabled: true,
      from: '',
      message: {
        en: '<html><body><h3>You started a login or profile update that requires MFA. </h3><h4><a href="{{object.resumeURI}}">Click to Proceed</a></h4></body></html>',
      },
      mimeType: 'text/html',
      subject: {
        en: 'Multi-Factor Email for Identity Cloud login',
      },
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageConfigEntity(configEntity1);
      await stageConfigEntity(configEntity2);
      await stageConfigEntity(configEntity3, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageConfigEntity(configEntity1, false);
      await stageConfigEntity(configEntity2, false);
      await stageConfigEntity(configEntity3, false);
    }
  });

  describe('getAllConfigEntities()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmOps.getAllConfigEntities).toBeDefined();
    });

    test('1: get all config entities', async () => {
      const response = await IdmOps.getAllConfigEntities({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getConfigEntitiesByType()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmOps.getConfigEntitiesByType).toBeDefined();
    });

    test('1: Get config entity by type (emailTemplate)', async () => {
      const response = await IdmOps.getConfigEntitiesByType({
        type: 'emailTemplate',
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get config entity by type (managed)', async () => {
      const response = await IdmOps.getConfigEntitiesByType({
        type: 'managed',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getConfigEntity()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmOps.getConfigEntity).toBeDefined();
    });

    test(`1: Get config entity '${configEntity1.id}'`, async () => {
      const response = await IdmOps.getConfigEntity({
        entityId: configEntity1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test("2: Get config entity 'managed'", async () => {
      const response = await IdmOps.getConfigEntity({
        entityId: 'managed',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('putConfigEntity()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmOps.putConfigEntity).toBeDefined();
    });

    test(`1: Put a config entity '${configEntity3.id}'`, async () => {
      const response = await IdmOps.putConfigEntity({
        entityId: configEntity3.id,
        entityData: configEntity3.data,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('queryAllManagedObjectsByType()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmOps.queryAllManagedObjectsByType).toBeDefined();
    });

    test(`1: Query managed objects of type 'alpha_user'`, async () => {
      const response = await IdmOps.queryAllManagedObjectsByType({
        type: 'alpha_user',
        fields: ['*'],
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('testConnectorServers()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmOps.testConnectorServers).toBeDefined();
    });

    test(`1: Test connector servers`, async () => {
      const response = await IdmOps.testConnectorServers({ state });
      expect(response).toMatchSnapshot();
    });
  });
});
