/**
 * Note this file uses msw to fake requests
 *  - it seems pollyjs might be interfering with this when I tried to use them both in the same file
 */
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import util from 'util';
import * as state from '../shared/State';
import { OAuth2Client } from '../index';

import { oauth2ClientURLTemplate } from '../api/OAuth2ClientApi';
import { getCurrentRealmPath } from '../api/utils/ApiUtils';

// this is needed for state setup
import '../utils/AutoSetupPolly';

const putForgerockOAuthClientAPIUrl = util.format(
  oauth2ClientURLTemplate,
  state.getHost(),
  getCurrentRealmPath(),
  'testAppId'
);

const handleMockErrorOAuth2ClientApi = rest.put(
  putForgerockOAuthClientAPIUrl,
  (req, res, ctx) => {
    return res(ctx.status(400), ctx.json({}));
  }
);

const server = setupServer();

describe('OAuth2ClientOps throws', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());

  describe('importOAuth2ClientsFromFile', () => {
    it('should throw when the API is down', async () => {
      server.use(handleMockErrorOAuth2ClientApi);
      await expect(
        OAuth2Client.importOAuth2ClientsFromFile(
          './src/test/mocks/OAuth2ClientOps/OAuth2ClientOps.app.json'
        )
      ).rejects.toMatchSnapshot();
    });
  });
});
