import { setupServer } from 'msw/node';
import { promises as fs } from 'fs';
import { rest } from 'msw';
import util from 'util';
import * as state from '../shared/State';
import { Service } from '../index';
// import OAuthOIDCService from ;

import {
  serviceURLTemplate,
  serviceURLNextDescendentTemplate,
} from '../api/ServiceApi';
import { getCurrentRealmPath } from '../api/utils/ApiUtils';

// this is needed for state setup such as the host
import '../utils/AutoSetupPolly';

const putServiceUrl = util.format(
  serviceURLTemplate,
  state.getHost(),
  getCurrentRealmPath(),
  'realm-config',
  'testServiceId'
);

const putServiceDescendentUrl = util.format(
  serviceURLNextDescendentTemplate,
  state.getHost(),
  getCurrentRealmPath(),
  'realm-config',
  'testServiceId',
  'oauth-oidc',
  'descendentTestId'
);

const handleMockSuccessApi = rest.put(putServiceUrl, (req, res, ctx) => {
  return res(ctx.status(200), ctx.json({}));
});

const handleMockErrorApi = rest.put(putServiceUrl, (req, res, ctx) => {
  return res(ctx.status(400), ctx.json({}));
});

const handleMockDescendentErrorApi = rest.put(
  putServiceDescendentUrl,
  (req, res, ctx) => {
    return res(ctx.status(400), ctx.json({}));
  }
);

const server = setupServer();

describe('ServiceOps throws', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());

  describe('importService', () => {
    it('should throw when the API is 400', async () => {
      server.use(handleMockErrorApi);
      const serviceImport = await fs.readFile(
        './src/test/mocks/ServiceOps/OAuthOIDC.service.json',
        { encoding: 'utf-8' }
      );
      const serviceImportData = JSON.parse(serviceImport);
      await expect(
        Service.importService('testServiceId', serviceImportData, false)
      ).rejects.toMatchSnapshot();
      server.resetHandlers();
    });

    it('should throw when the API has failing descendents', async () => {
      server.use(handleMockSuccessApi, handleMockDescendentErrorApi);
      const serviceImport = await fs.readFile(
        './src/test/mocks/ServiceOps/OAuthOIDCWithDescendents.service.json',
        { encoding: 'utf-8' }
      );
      const serviceImportData = JSON.parse(serviceImport);
      await expect(
        Service.importService('testServiceId', serviceImportData, false)
      ).rejects.toMatchSnapshot();
      server.resetHandlers();
    });
  });
});
