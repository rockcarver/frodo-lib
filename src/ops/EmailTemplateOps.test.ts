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
import * as TestData from '../test/setup/EmailTemplateSetup';
import * as EmailTemplateOps from './EmailTemplateOps';
import { EmailTemplateExportInterface } from './EmailTemplateOps';

describe('EmailTemplateOps', () => {

  TestData.setup();

  describe('readEmailTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.readEmailTemplate).toBeDefined();
    });

    test(`1: Read email template '${TestData.template1._id}'`, async () => {
      const response = await EmailTemplateOps.readEmailTemplate({
        templateId: TestData.template1._id,
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
      const response = await EmailTemplateOps.readEmailTemplates({ includeDefault: false, state });
      expect(response).toMatchSnapshot();
    });

    test('2: Read all email templates including defaults', async () => {
      const response = await EmailTemplateOps.readEmailTemplates({ includeDefault: true, state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportEmailTemplates()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.exportEmailTemplates).toBeDefined();
    });

    test('1: Export email templates', async () => {
      const response = await EmailTemplateOps.exportEmailTemplates({ includeDefault: false, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });

    test('2: Export email templates with default templates', async () => {
      const response = await EmailTemplateOps.exportEmailTemplates({ includeDefault: true, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });
  });

  describe('updateEmailTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.updateEmailTemplate).toBeDefined();
    });

    test(`1: Create email template '${TestData.template3._id}'`, async () => {
      const response = await EmailTemplateOps.updateEmailTemplate({
        templateId: TestData.template3._id,
        templateData: TestData.template3,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('importEmailTemplates()', () => {
    test('0: Method is implemented', async () => {
      expect(EmailTemplateOps.importEmailTemplates).toBeDefined();
    });

    test(`1: importEmailTemplates`, async () => {
      const importData: EmailTemplateExportInterface = {
        emailTemplate: {
          [TestData.template1._id]: TestData.template1,
          [TestData.template2._id]: TestData.template2,
          [TestData.template3._id]: TestData.template3
        }
      }
      const response = await EmailTemplateOps.importEmailTemplates({
        importData,
        state
      });
      expect(response).toMatchSnapshot();
    });
  });
});