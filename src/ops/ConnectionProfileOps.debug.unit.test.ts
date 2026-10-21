import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { jest } from '@jest/globals';
import '../index';
import StateImpl, { State } from '../shared/State';
import {
  getConnectionProfileByHost,
  saveConnectionProfile,
} from './ConnectionProfileOps';

describe('Connection profile debug output', () => {
  const host = 'https://profile-debug.example.com/am';
  const password = 'test-only-profile-password';
  const logApiSecret = 'test-only-log-secret';
  const amsterPrivateKey = 'test-only-amster-private-key';
  const svcacctJwk = {
    kty: 'RSA',
    n: 'test-only-modulus',
    e: 'AQAB',
    d: 'test-only-private-exponent',
    p: 'test-only-first-prime',
    q: 'test-only-second-prime',
    dp: 'test-only-first-exponent',
    dq: 'test-only-second-exponent',
    qi: 'test-only-coefficient',
  };
  const authenticationHeaderOverrides = {
    Authorization: password,
    'X-Custom-Auth': 'test-only-custom-auth',
  };
  const configurationHeaderOverrides = {
    Authorization: logApiSecret,
  };
  let directory: string;
  let state: State;
  let originalDebugHandler: ReturnType<State['getDebugHandler']>;
  const debugHandler = jest.fn();

  beforeEach(() => {
    directory = fs.mkdtempSync(join(tmpdir(), 'frodo-profile-debug-'));
    fs.writeFileSync(join(directory, 'masterkey.key'), 'test-only-master-key');
    state = StateImpl({ host });
    state.setConnectionProfilesPath(join(directory, 'connections.json'));
    state.setMasterKeyPath(join(directory, 'masterkey.key'));
    originalDebugHandler = state.getDebugHandler();
    debugHandler.mockClear();
    state.setDebugHandler(debugHandler);
  });

  afterEach(() => {
    state.setDebugHandler(originalDebugHandler);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function setCredentials() {
    state.setUsername('profile-user');
    state.setPassword(password);
    state.setLogApiKey('profile-log-key');
    state.setLogApiSecret(logApiSecret);
    state.setServiceAccountId('profile-service-account');
    state.setServiceAccountJwk(svcacctJwk);
    state.setAmsterPrivateKey(amsterPrivateKey);
    state.setAuthenticationHeaderOverrides(authenticationHeaderOverrides);
    state.setConfigurationHeaderOverrides(configurationHeaderOverrides);
  }

  function expectNoSecrets() {
    const output = JSON.stringify(debugHandler.mock.calls);
    for (const secret of [
      password,
      logApiSecret,
      amsterPrivateKey,
      ...Object.values(svcacctJwk),
      ...Object.values(authenticationHeaderOverrides),
      ...Object.values(configurationHeaderOverrides),
    ]) {
      expect(output).not.toContain(secret);
    }
  }

  test('lookup logs all profile fields with secrets masked but returns credentials unchanged', async () => {
    setCredentials();
    expect(await saveConnectionProfile({ host, state })).toBe(true);
    debugHandler.mockClear();

    const profile = await getConnectionProfileByHost({ host, state });

    expect(profile).toMatchObject({
      tenant: host,
      username: 'profile-user',
      password,
      logApiKey: 'profile-log-key',
      logApiSecret,
      svcacctId: 'profile-service-account',
      svcacctJwk,
      amsterPrivateKey,
      authenticationHeaderOverrides,
      configurationHeaderOverrides,
    });
    expectNoSecrets();
    const diagnostic = debugHandler.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('retrieved connection profile'));
    expect(diagnostic).toContain(host);
    expect(diagnostic).toContain('"username": "profile-user"');
    expect(diagnostic).toContain('"svcacctId": "profile-service-account"');
    expect(diagnostic).toContain('"logApiKey": "profile-log-key"');
    expect(JSON.parse(diagnostic.slice(diagnostic.indexOf('{')))).toEqual({
      ...profile,
      password: '<present>',
      logApiSecret: '<present>',
      svcacctJwk: '<present>',
      amsterPrivateKey: '<present>',
      authenticationHeaderOverrides: {
        Authorization: '<present>',
        'X-Custom-Auth': '<present>',
      },
      configurationHeaderOverrides: {
        Authorization: '<present>',
      },
    });
  });

  test.each(['username', 'logApiKey'])(
    'lookup dynamically masks %s when its encoded key is present',
    async (key) => {
      setCredentials();
      expect(await saveConnectionProfile({ host, state })).toBe(true);
      const filename = state.getConnectionProfilesPath();
      const connections = JSON.parse(fs.readFileSync(filename, 'utf8'));
      connections[host][
        `encoded${key.charAt(0).toUpperCase()}${key.slice(1)}`
      ] = 'test-only-encoded-value';
      fs.writeFileSync(filename, JSON.stringify(connections));
      debugHandler.mockClear();

      const profile = await getConnectionProfileByHost({ host, state });

      expect(profile[key]).toBe(connections[host][key]);
      const diagnostic = debugHandler.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.includes('retrieved connection profile'));
      const loggedProfile = JSON.parse(
        diagnostic.slice(diagnostic.indexOf('{'))
      );
      expect(loggedProfile[key]).toBe('<present>');
      expect(diagnostic).not.toContain(profile[key]);
      expectNoSecrets();
    }
  );

  test('lookup handles profiles without optional credentials', async () => {
    expect(await saveConnectionProfile({ host, state })).toBe(true);
    debugHandler.mockClear();

    const profile = await getConnectionProfileByHost({ host, state });
    expect(profile).toMatchObject({
      tenant: host,
      password: null,
      logApiSecret: null,
      svcacctJwk: null,
      amsterPrivateKey: null,
      authenticationHeaderOverrides: {},
      configurationHeaderOverrides: {},
    });
    expectNoSecrets();
    const diagnostic = debugHandler.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('retrieved connection profile'));
    expect(JSON.parse(diagnostic.slice(diagnostic.indexOf('{')))).toEqual(
      profile
    );
  });

  test.each(['new', 'existing'])(
    'saving a %s profile never logs header values or raw profiles',
    async (kind) => {
      setCredentials();
      if (kind === 'existing') {
        expect(await saveConnectionProfile({ host, state })).toBe(true);
        debugHandler.mockClear();
      }

      expect(await saveConnectionProfile({ host, state })).toBe(true);

      expectNoSecrets();
      expect(
        debugHandler.mock.calls.every(
          ([message]) => typeof message === 'string'
        )
      ).toBe(true);
      expect(JSON.stringify(debugHandler.mock.calls)).toContain(
        'Authorization'
      );
      expect(await getConnectionProfileByHost({ host, state })).toMatchObject({
        authenticationHeaderOverrides,
        configurationHeaderOverrides,
      });
    }
  );
});
