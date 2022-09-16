import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { EmailTemplate, state } from '../index';
import * as global from '../storage/StaticStorage';
import { mockGetConfigEntitiesByType } from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('EmailTemplateOps - exportEmailTemplateToFile()', () => {
  test('exportEmailTemplateToFile() 0: Method is implemented', async () => {
    expect(EmailTemplate.exportEmailTemplateToFile).toBeDefined();
  });
});

describe('EmailTemplateOps - exportEmailTemplatesToFile()', () => {
  test('exportEmailTemplatesToFile() 0: Method is implemented', async () => {
    expect(EmailTemplate.exportEmailTemplatesToFile).toBeDefined();
  });
});

describe('EmailTemplateOps - exportEmailTemplatesToFiles()', () => {
  test('exportEmailTemplatesToFiles() 0: Method is implemented', async () => {
    expect(EmailTemplate.exportEmailTemplatesToFiles).toBeDefined();
  });
});

describe('EmailTemplateOps - importEmailTemplateFromFile()', () => {
  test('importEmailTemplateFromFile() 0: Method is implemented', async () => {
    expect(EmailTemplate.importEmailTemplateFromFile).toBeDefined();
  });
});

describe('EmailTemplateOps - importEmailTemplatesFromFile()', () => {
  test('importEmailTemplatesFromFile() 0: Method is implemented', async () => {
    expect(EmailTemplate.importEmailTemplatesFromFile).toBeDefined();
  });
});

describe('EmailTemplateOps - importEmailTemplatesFromFiles()', () => {
  test('importEmailTemplatesFromFiles() 0: Method is implemented', async () => {
    expect(EmailTemplate.importEmailTemplatesFromFiles).toBeDefined();
  });
});

describe('EmailTemplateOps - importFirstEmailTemplateFromFile()', () => {
  test('importFirstEmailTemplateFromFile() 0: Method is implemented', async () => {
    expect(EmailTemplate.importFirstEmailTemplateFromFile).toBeDefined();
  });
});

describe('EmailTemplateOps - listEmailTemplates()', () => {
  test('listEmailTemplates() 0: Method is implemented', async () => {
    expect(EmailTemplate.listEmailTemplates).toBeDefined();
  });

  test('listEmailTemplates() 1: List email templates', async () => {
    mockGetConfigEntitiesByType(mock);
    expect.assertions(2);
    const emailTemplates = await EmailTemplate.listEmailTemplates();
    expect(emailTemplates).toBeTruthy();
    expect(emailTemplates.length).toBe(17);
  });
});
