import { jest } from '@jest/globals';
import { Authenticate, state } from '../index';

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

describe('AuthenticateOps', () => {
  describe('getTokens()', () => {
    test('0: Method is implemented', async () => {
      expect(Authenticate.getTokens).toBeDefined();
    });

    test('1: Authenticate as user', async () => {
      state.setHost(process.env.FRODO_HOST || 'frodo-dev');
      state.setRealm('alpha');
      if (
        process.env.FRODO_HOST &&
        process.env.FRODO_USER &&
        process.env.FRODO_PASSWORD
      ) {
        state.setUsername(process.env.FRODO_USER);
        state.setPassword(process.env.FRODO_PASSWORD);
      }
      await Authenticate.getTokens();
      expect(state.getCookieName()).toBeTruthy();
      expect(state.getCookieValue()).toBeTruthy();
      expect(state.getBearerToken()).toBeTruthy();
    });
  });
});
