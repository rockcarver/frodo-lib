/**
 * Run tests
 *
 *        npm run test:only -- src/shared/State.headerOverrides
 *
 * Part of the hardening of State defaults.
 *
 * A state is built from a module-level default object. The getters of the
 * authentication and the configuration header overrides merge the value of an
 * environment variable into the map. These tests prove that the getters leave
 * the maps alone: the default object, the map a state holds and the object a
 * caller passed to the setter are not changed by a read, so every state starts
 * from an empty map whatever other states did before.
 *
 * Hermetic: made-up values, no network, a temporary directory with a master
 * key that the test writes and a temporary home for the connection profile
 * tests, nothing under the real frodo home.
 */
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isDeepStrictEqual } from 'util';
import '../index';
import {
  loadConnectionProfileByHost,
  saveConnectionProfile,
} from '../ops/ConnectionProfileOps';
import { mergeDeep } from '../utils/JsonUtils';
import StateImpl, { State } from './State';

type Overrides = Record<string, string>;

const mapUnderTest = [
  {
    name: 'authentication',
    variable: 'FRODO_AUTHENTICATION_HEADER_OVERRIDES',
    key: 'authenticationHeaderOverrides' as const,
    set: (state: State, overrides: Overrides) =>
      state.setAuthenticationHeaderOverrides(overrides),
    get: (state: State): Overrides => state.getAuthenticationHeaderOverrides(),
  },
  {
    name: 'configuration',
    variable: 'FRODO_CONFIGURATION_HEADER_OVERRIDES',
    key: 'configurationHeaderOverrides' as const,
    set: (state: State, overrides: Overrides) =>
      state.setConfigurationHeaderOverrides(overrides),
    get: (state: State): Overrides => state.getConfigurationHeaderOverrides(),
  },
];

const variables = [
  'FRODO_AUTHENTICATION_HEADER_OVERRIDES',
  'FRODO_CONFIGURATION_HEADER_OVERRIDES',
];

const host = 'https://openam-matrix.example.com/am';
const otherHost = 'https://openam-zion.example.com/am';

describe('Header override maps of a state', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const variable of variables) {
      saved[variable] = process.env[variable];
      delete process.env[variable];
    }
  });

  afterEach(() => {
    for (const variable of variables) {
      if (saved[variable] === undefined) delete process.env[variable];
      else process.env[variable] = saved[variable];
    }
  });

  describe.each(mapUnderTest)('$name', ({ variable, key, set, get }) => {
    const fromEnvironment = { 'X-From-Environment': 'made-up-secret' };

    test('1: a state that set nothing starts with an empty map', () => {
      expect(get(StateImpl({ host }))).toEqual({});
    });

    test('2: a read with the variable set does not change what a state created later starts with', () => {
      const first = StateImpl({ host });
      process.env[variable] = JSON.stringify(fromEnvironment);
      expect(get(first)).toEqual(fromEnvironment);
      delete process.env[variable];

      expect(get(StateImpl({ host: otherHost }))).toEqual({});
    });

    test('3: a read does not change a state that exists already', () => {
      const bystander = StateImpl({ host: otherHost });
      const reader = StateImpl({ host });
      process.env[variable] = JSON.stringify(fromEnvironment);
      expect(get(reader)).toEqual(fromEnvironment);
      delete process.env[variable];

      expect(get(bystander)).toEqual({});
    });

    test('4: a read after a reset does not change what a state created later starts with', () => {
      const first = StateImpl({ host });
      set(first, { 'X-Own': 'made-up-own' });
      first.reset();
      process.env[variable] = JSON.stringify(fromEnvironment);
      expect(get(first)).toEqual(fromEnvironment);
      delete process.env[variable];

      expect(get(StateImpl({ host: otherHost }))).toEqual({});
    });

    test('5: the map of one state is not the map of another', () => {
      const first = StateImpl({ host });
      const second = StateImpl({ host: otherHost });
      set(first, { 'X-Own': 'made-up-own' });

      expect(get(first)).toEqual({ 'X-Own': 'made-up-own' });
      expect(get(second)).toEqual({});
      expect(get(StateImpl({ host }))).toEqual({});
    });

    test('6: a read leaves the object that the setter was given as it was', () => {
      const given: Overrides = { 'X-Own': 'made-up-own' };
      const state = StateImpl({ host });
      set(state, given);
      process.env[variable] = JSON.stringify(fromEnvironment);

      get(state);

      expect(given).toEqual({ 'X-Own': 'made-up-own' });
    });

    test('7: a read does not keep the value of the variable in the state', () => {
      const state = StateImpl({ host });
      set(state, { 'X-Own': 'made-up-own' });
      process.env[variable] = JSON.stringify(fromEnvironment);
      expect(get(state)).toEqual({
        'X-Own': 'made-up-own',
        ...fromEnvironment,
      });
      delete process.env[variable];

      expect(get(state)).toEqual({ 'X-Own': 'made-up-own' });
    });

    test('8: changing the result of a read does not change the state', () => {
      const state = StateImpl({ host });
      set(state, { 'X-Own': 'made-up-own' });

      // the pattern of the callers that merge into what the getter returns
      mergeDeep(get(state), { 'X-Added': 'made-up-added' });
      get(state)['X-Direct'] = 'made-up-direct';

      expect(get(state)).toEqual({ 'X-Own': 'made-up-own' });
      expect(get(StateImpl({ host }))).toEqual({});
    });

    test('9: with the variable set, the variable wins and new names are added', () => {
      const state = StateImpl({ host });
      set(state, { 'X-One': 'made-up-1', 'X-Two': 'made-up-2' });
      process.env[variable] = JSON.stringify({
        'X-Two': 'made-up-env-2',
        'X-Three': 'made-up-env-3',
      });

      const expected = {
        'X-One': 'made-up-1',
        'X-Two': 'made-up-env-2',
        'X-Three': 'made-up-env-3',
      };
      expect(get(state)).toEqual(expected);
      // and the same on every read
      expect(get(state)).toEqual(expected);
    });

    test('10: nested objects are merged key by key, as before', () => {
      const state = StateImpl({ host });
      set(state, { nested: { one: '1' } } as unknown as Overrides);
      process.env[variable] = JSON.stringify({ nested: { two: '2' } });

      expect(get(state)).toEqual({ nested: { one: '1', two: '2' } });
      delete process.env[variable];
      expect(get(state)).toEqual({ nested: { one: '1' } });
    });

    test('11: without the variable the map is returned as it was set', () => {
      const state = StateImpl({ host });
      set(state, { 'X-One': 'made-up-1' });

      expect(get(state)).toEqual({ 'X-One': 'made-up-1' });
    });

    test('12: a state created with the map of its own uses that map', () => {
      const state = StateImpl({ host, [key]: { 'X-Initial': 'made-up-i' } });
      process.env[variable] = JSON.stringify(fromEnvironment);

      expect(get(state)).toEqual({
        'X-Initial': 'made-up-i',
        ...fromEnvironment,
      });
      delete process.env[variable];
      expect(get(state)).toEqual({ 'X-Initial': 'made-up-i' });
      expect(get(StateImpl({ host }))).toEqual({});
    });

    test('13: a state without a map answers without one, with or without the variable', () => {
      const state = StateImpl({ host, [key]: undefined });
      expect(get(state)).toBeUndefined();
      process.env[variable] = JSON.stringify(fromEnvironment);
      expect(get(state)).toBeUndefined();
    });

    test('14: an empty variable counts as no variable', () => {
      const state = StateImpl({ host });
      set(state, { 'X-One': 'made-up-1' });
      process.env[variable] = '';

      expect(get(state)).toEqual({ 'X-One': 'made-up-1' });
    });

    test('15: the result is a plain object that compares as strictly equal to one', () => {
      const state = StateImpl({ host });
      set(state, { 'X-One': 'made-up-1' });
      process.env[variable] = JSON.stringify(fromEnvironment);

      // the profile code compares a result with `isDeepStrictEqual`, which
      // looks at the prototype: a copy made in another realm would differ
      expect(
        isDeepStrictEqual(get(state), {
          'X-One': 'made-up-1',
          ...fromEnvironment,
        })
      ).toBe(true);
    });
  });

  describe('the two maps are independent', () => {
    test('16: a variable for one map does not appear in the other', () => {
      process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES = JSON.stringify({
        'X-Auth': 'made-up-auth',
      });
      const state = StateImpl({ host });

      expect(state.getAuthenticationHeaderOverrides()).toEqual({
        'X-Auth': 'made-up-auth',
      });
      expect(state.getConfigurationHeaderOverrides()).toEqual({});
      delete process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES;
      expect(StateImpl({ host }).getAuthenticationHeaderOverrides()).toEqual(
        {}
      );
    });
  });

  describe('connection profiles', () => {
    let directory: string;
    let filename: string;
    let keyFile: string;
    const environment: Record<string, string | undefined> = {};
    const profileEnvironment = [
      'HOME',
      'USERPROFILE',
      'FRODO_CONNECTION_PROFILES_PATH',
      'FRODO_MASTER_KEY_PATH',
      'FRODO_MASTER_KEY',
    ];

    function profileState(settings: { host: string }): State {
      const state = StateImpl(settings);
      state.setConnectionProfilesPath(filename);
      state.setMasterKeyPath(keyFile);
      return state;
    }

    beforeEach(() => {
      directory = fs.mkdtempSync(join(tmpdir(), 'frodo-state-defaults-'));
      filename = join(directory, 'connections.json');
      keyFile = join(directory, 'masterkey.key');
      fs.writeFileSync(keyFile, 'test-only-master-key');
      for (const name of profileEnvironment) {
        environment[name] = process.env[name];
        delete process.env[name];
      }
      // a home that is a temporary directory: nothing can reach the real one
      process.env.HOME = directory;
      process.env.USERPROFILE = directory;
    });

    afterEach(() => {
      for (const name of profileEnvironment) {
        if (environment[name] === undefined) delete process.env[name];
        else process.env[name] = environment[name];
      }
      fs.rmSync(directory, { recursive: true, force: true });
    });

    async function saveProfile() {
      const saver = profileState({ host });
      saver.setAuthenticationHeaderOverrides({
        'X-Profile-Auth': 'made-up-profile-auth',
      });
      saver.setConfigurationHeaderOverrides({
        'X-Profile-Config': 'made-up-profile-config',
      });
      saver.setUsername('neo');
      expect(await saveConnectionProfile({ host, state: saver })).toBe(true);
    }

    test('17: loading a profile into one state leaves the other states unchanged', async () => {
      await saveProfile();
      const before = profileState({ host: otherHost });
      const target = profileState({ host });

      expect(await loadConnectionProfileByHost({ host, state: target })).toBe(
        true
      );

      expect(target.getAuthenticationHeaderOverrides()).toEqual({
        'X-Profile-Auth': 'made-up-profile-auth',
      });
      expect(target.getConfigurationHeaderOverrides()).toEqual({
        'X-Profile-Config': 'made-up-profile-config',
      });
      const after = profileState({ host: otherHost });
      for (const other of [before, after, StateImpl({ host })]) {
        expect(other.getAuthenticationHeaderOverrides()).toEqual({});
        expect(other.getConfigurationHeaderOverrides()).toEqual({});
      }
    });

    test('18: loading a profile with the variables set keeps the merge result', async () => {
      await saveProfile();
      process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES = JSON.stringify({
        'X-Profile-Auth': 'made-up-env-wins',
        'X-Env-Auth': 'made-up-env-auth',
      });
      const target = profileState({ host });

      await loadConnectionProfileByHost({ host, state: target });

      // the variable wins over the profile, and adds its own names
      expect(target.getAuthenticationHeaderOverrides()).toEqual({
        'X-Profile-Auth': 'made-up-env-wins',
        'X-Env-Auth': 'made-up-env-auth',
      });
      delete process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES;
      // the load stored the profile merged over the values of the variable
      expect(target.getAuthenticationHeaderOverrides()).toEqual({
        'X-Profile-Auth': 'made-up-profile-auth',
        'X-Env-Auth': 'made-up-env-auth',
      });
      expect(
        profileState({ host: otherHost }).getAuthenticationHeaderOverrides()
      ).toEqual({});
    });
  });
});
