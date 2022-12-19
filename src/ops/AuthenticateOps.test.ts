import { Authenticate, state } from '../index';

describe('AuthenticationOps', () => {
  test('getTokens() 1: ', async () => {
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
