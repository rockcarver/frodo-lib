import { Authenticate, state } from '../index';

describe('AuthenticationOps', () => {
  test('getTokens() 1: ', async () => {
    state.default.session.setTenant(process.env.FRODO_HOST || 'frodo-dev');
    state.default.session.setRealm('alpha');
    if (
      process.env.FRODO_HOST &&
      process.env.FRODO_USER &&
      process.env.FRODO_PASSWORD
    ) {
      state.default.session.setUsername(process.env.FRODO_USER);
      state.default.session.setPassword(process.env.FRODO_PASSWORD);
    }
    await Authenticate.getTokens();
    expect(state.default.session.getCookieName()).toBeTruthy();
    expect(state.default.session.getCookieValue()).toBeTruthy();
    expect(state.default.session.getBearerToken()).toBeTruthy();
  });
});
