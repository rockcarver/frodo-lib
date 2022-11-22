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

describe('EmailTemplateOps - getEmailTemplate()', () => {
  test('getEmailTemplate() 0: Method is implemented', async () => {
    expect(EmailTemplate.getEmailTemplate).toBeDefined();
  });
});

describe('EmailTemplateOps - getEmailTemplates()', () => {
  test('getEmailTemplates() 0: Method is implemented', async () => {
    expect(EmailTemplate.getEmailTemplates).toBeDefined();
  });

  test('getEmailTemplates() 1: Get email templates', async () => {
    mockGetConfigEntitiesByType(mock);
    expect.assertions(2);
    const emailTemplates = await EmailTemplate.getEmailTemplates();
    expect(emailTemplates).toBeTruthy();
    expect(emailTemplates.result.length).toBe(17);
  });
});

describe('EmailTemplateOps - putEmailTemplate()', () => {
  test('putEmailTemplate() 0: Method is implemented', async () => {
    expect(EmailTemplate.putEmailTemplate).toBeDefined();
  });
});
