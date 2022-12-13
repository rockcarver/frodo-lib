import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { EmailTemplate, state } from '../index';
import * as global from '../storage/StaticStorage';
import { mockGetConfigEntitiesByType } from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setCookieValue('cookieValue');
state.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

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
