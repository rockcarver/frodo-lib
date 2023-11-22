/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record IdmConfigOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IdmConfigOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IdmConfigOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as IdmConfigApi from '../api/IdmConfigApi';
import * as IdmConfigOps from './IdmConfigOps';
import { autoSetupPolly, filterRecording } from '../utils/AutoSetupPolly';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';

const ctx = autoSetupPolly();

async function stageConfigEntity(
  configEntity: { id: string; data: IdObjectSkeletonInterface },
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

describe('IdmConfigOps', () => {
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

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('readConfigEntities()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmConfigOps.readConfigEntities).toBeDefined();
    });

    test('1: Read all config entities', async () => {
      const response = await IdmConfigOps.readConfigEntities({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readConfigEntitiesByType()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmConfigOps.readConfigEntitiesByType).toBeDefined();
    });

    test('1: Read config entity by type (emailTemplate)', async () => {
      const response = await IdmConfigOps.readConfigEntitiesByType({
        type: 'emailTemplate',
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Read config entity by type (managed)', async () => {
      const response = await IdmConfigOps.readConfigEntitiesByType({
        type: 'managed',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readConfigEntity()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmConfigOps.readConfigEntity).toBeDefined();
    });

    test(`1: Read config entity '${configEntity1.id}'`, async () => {
      const response = await IdmConfigOps.readConfigEntity({
        entityId: configEntity1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test("2: Read config entity 'managed'", async () => {
      const response = await IdmConfigOps.readConfigEntity({
        entityId: 'managed',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportConfigEntities()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmConfigOps.exportConfigEntities).toBeDefined();
    });

    test('1: Export config entities', async () => {
      const response = await IdmConfigOps.exportConfigEntities({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });
  });

  describe('updateConfigEntity()', () => {
    test('0: Method is implemented', async () => {
      expect(IdmConfigOps.updateConfigEntity).toBeDefined();
    });

    test(`1: Update a config entity '${configEntity3.id}'`, async () => {
      const response = await IdmConfigOps.updateConfigEntity({
        entityId: configEntity3.id,
        entityData: configEntity3.data,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
