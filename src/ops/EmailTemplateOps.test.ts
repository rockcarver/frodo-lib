/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record EmailTemplateOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EmailTemplateOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EmailTemplateOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as IdmConfigApi from '../api/IdmConfigApi';
import * as EmailTemplateOps from './EmailTemplateOps';
import { autoSetupPolly, filterRecording } from '../utils/AutoSetupPolly';

const ctx = autoSetupPolly();

const { EMAIL_TEMPLATE_TYPE } = EmailTemplateOps;

async function stageTemplate(
  template: { id: string; data: any },
  create = true
) {
  // delete if exists, then create
  try {
    await IdmConfigApi.getConfigEntity({
      entityId: `${EMAIL_TEMPLATE_TYPE}/${template.id}`,
      state,
    });
    await IdmConfigApi.deleteConfigEntity({
      entityId: `${EMAIL_TEMPLATE_TYPE}/${template.id}`,
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await IdmConfigApi.putConfigEntity({
        entityId: `${EMAIL_TEMPLATE_TYPE}/${template.id}`,
        entityData: template.data,
        state,
      });
    }
  }
}

describe('EmailTemplateOps', () => {
  const template1 = {
    id: 'FrodoTestEmailTemplate1',
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
  const template2 = {
    id: 'FrodoTestEmailTemplate2',
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
  const template3 = {
    id: 'FrodoTestEmailTemplate3',
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
      await stageTemplate(template1);
      await stageTemplate(template2);
      await stageTemplate(template3, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageTemplate(template1, false);
      await stageTemplate(template2, false);
      await stageTemplate(template3, false);
    }
  });

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('readEmailTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.readEmailTemplate).toBeDefined();
    });

    test(`1: Read email template '${template1.id}'`, async () => {
      const response = await EmailTemplateOps.readEmailTemplate({
        templateId: template1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readEmailTemplates()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.readEmailTemplates).toBeDefined();
    });

    test('1: Read all email templates', async () => {
      const response = await EmailTemplateOps.readEmailTemplates({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportEmailTemplates()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.exportEmailTemplates).toBeDefined();
    });

    test('1: Export email templates', async () => {
      const response = await EmailTemplateOps.exportEmailTemplates({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });
  });

  describe('updateEmailTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.updateEmailTemplate).toBeDefined();
    });

    test(`1: Create email template '${template3.id}'`, async () => {
      const response = await EmailTemplateOps.updateEmailTemplate({
        templateId: template3.id,
        templateData: template3.data,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
