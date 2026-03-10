import { state } from '../../index';
import * as EmailTemplateOps from '../../ops/EmailTemplateOps';
import { createConfigEntity, deleteConfigEntity } from '../../ops/IdmConfigOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';

const { EMAIL_TEMPLATE_TYPE } = EmailTemplateOps;

export const template1: EmailTemplateOps.EmailTemplateSkeleton = {
  _id: 'FrodoTestEmailTemplate1',
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
};

export const template2: EmailTemplateOps.EmailTemplateSkeleton = {
  _id: 'FrodoTestEmailTemplate2',
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
};

export const template3: EmailTemplateOps.EmailTemplateSkeleton = {
  _id: 'FrodoTestEmailTemplate3',
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
};

export const template4: EmailTemplateOps.EmailTemplateSkeleton = {
  _id: 'frodoTestEmailTemplateFour',
  displayName: 'Frodo Test Email Template Four',
  from: '"From" <from@email.com>',
  templateId: 'frodoTestEmailTemplateFour',
  defaultLocale: 'en',
  enabled: true,
  html: {
    en: '<div class="content"><p><img src="https://tinyurl.com/3mwewu3v" alt="alt text" title="Email Title Text"></p><h1 id="emailtitle">Email Title</h1><p>Message text lorem ipsum dolor sit amet consectetur adipisicing elit sed do eiusmod tempor.</p></div>',
  },
  message: {
    en: '<html><head></head><body style="background-color: #324054; color: #455469; padding: 60px; text-align: center;"><div class="content" style="background-color: #fff; border-radius: 4px; margin: 0 auto; padding: 48px; width: 235px;"><p><img src="https://tinyurl.com/3mwewu3v" alt="alt text" title="Email Title Text"></p><h1 id="emailtitle">Email Title</h1><p>Message text lorem ipsum dolor sit amet consectetur adipisicing elit sed do eiusmod tempor.</p></div></body></html>',
  },
  mimeType: 'text/html',
  subject: {
    en: 'Subject',
  },
  styles:
    'body {\n   background-color: #324054;\n   color: #455469;\n   padding: 60px;\n   text-align: center \n}\n a {\n   text-decoration: none;\n   color: #109cf1;\n}\n .content {\n   background-color: #fff;\n   border-radius: 4px;\n   margin: 0 auto;\n   padding: 48px;\n   width: 235px \n}\n',
  description: 'Frodo email template four',
};

export async function stageEmailTemplate(
  template: EmailTemplateOps.EmailTemplateSkeleton,
  createNew = false
) {
  const entityId = `${EMAIL_TEMPLATE_TYPE}/${template._id}`;
  try {
    await deleteConfigEntity({
      entityId,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await createConfigEntity({
        entityId,
        entityData: template,
        state,
      });
    }
  }
}

export function setup() {
  const ctx = autoSetupPolly();

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        // Filter recordings
        filterRecording(recording, true, state);
      });
    }
  });

  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageEmailTemplate(template1, true);
      await stageEmailTemplate(template2, true);
      await stageEmailTemplate(template3);
    }
  });

  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageEmailTemplate(template1);
      await stageEmailTemplate(template2);
      await stageEmailTemplate(template3);
    }
  });
}
