/**
 * Run tests
 *
 *        npm run test:only -- src/ops/ConnectionProfileOps.headerOverrides
 *
 * The values of the authentication and configuration header overrides of a
 * connection profile are secrets (core 0013): a profile stores them encrypted,
 * like the password, and reads the plain maps that older versions wrote.
 *
 * Hermetic: a temporary directory per test with a master key that the test
 * writes, no network, nothing under the real frodo home.
 */
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { jest } from '@jest/globals';
import '../index';
import { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from '../mcp/CapabilityRegistry';
import StateImpl, { State } from '../shared/State';
import {
  decryptSavedAuthenticationHeaderOverrides,
  findSavedConnectionTarget,
  getConnectionProfileByHost,
  initConnectionProfiles,
  loadConnectionProfileByHost,
  saveConnectionProfile,
} from './ConnectionProfileOps';
import { FrodoError } from './FrodoError';

const host = 'https://openam-matrix.example.com/am';
const otherHost = 'https://openam-zion.example.com/am';
// made-up values, never real ones
const authenticationHeaderOverrides = {
  'X-Gateway-Key': 'test-only-gateway-secret',
  Host: 'test-only-internal.example.com:8081',
};
const configurationHeaderOverrides = {
  'X-Configuration-Type': 'test-only-mutable-secret',
};
const allValues = [
  ...Object.values(authenticationHeaderOverrides),
  ...Object.values(configurationHeaderOverrides),
];
const allNames = [
  ...Object.keys(authenticationHeaderOverrides),
  ...Object.keys(configurationHeaderOverrides),
];

describe('Connection profile header overrides', () => {
  let directory: string;
  let filename: string;
  let keyFile: string;
  let debugMessages: string[];

  function newState(settings: { key?: string } = {}): State {
    const state = StateImpl({ host });
    state.setConnectionProfilesPath(filename);
    state.setMasterKeyPath(settings.key ?? keyFile);
    state.setDebugHandler((message) => debugMessages.push(String(message)));
    // each state gets its own (empty) maps: a state that does not set them
    // shares the default object of the module with every other such state
    state.setAuthenticationHeaderOverrides({});
    state.setConfigurationHeaderOverrides({});
    return state;
  }

  function stateWithOverrides(): State {
    const state = newState();
    state.setAuthenticationHeaderOverrides({
      ...authenticationHeaderOverrides,
    });
    state.setConfigurationHeaderOverrides({ ...configurationHeaderOverrides });
    return state;
  }

  function readFileText(): string {
    return fs.readFileSync(filename, 'utf8');
  }

  function readProfile(profileHost = host) {
    return JSON.parse(readFileText())[profileHost];
  }

  /** The file as an older version wrote it: plain header override maps. */
  function writeOlderVersionProfile(extra: Record<string, unknown> = {}) {
    fs.writeFileSync(
      filename,
      JSON.stringify(
        {
          [host]: {
            username: 'neo',
            authenticationHeaderOverrides: {
              ...authenticationHeaderOverrides,
            },
            configurationHeaderOverrides: {
              ...configurationHeaderOverrides,
            },
            ...extra,
          },
        },
        null,
        2
      )
    );
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(join(tmpdir(), 'frodo-header-overrides-'));
    filename = join(directory, 'connections.json');
    keyFile = join(directory, 'masterkey.key');
    fs.writeFileSync(keyFile, 'test-only-master-key');
    debugMessages = [];
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  describe('storage', () => {
    test('1: both maps are stored encrypted: no value and no name is in the file', async () => {
      expect(
        await saveConnectionProfile({ host, state: stateWithOverrides() })
      ).toBe(true);

      const text = readFileText();
      for (const secret of [...allValues, ...allNames]) {
        expect(text).not.toContain(secret);
      }
      const profile = readProfile();
      expect(typeof profile.encodedAuthenticationHeaderOverrides).toBe(
        'string'
      );
      expect(typeof profile.encodedConfigurationHeaderOverrides).toBe('string');
      expect(profile.authenticationHeaderOverrides).toBeUndefined();
      expect(profile.configurationHeaderOverrides).toBeUndefined();
    });

    test('2: the second map is stored on its own: only configuration overrides', async () => {
      const state = newState();
      state.setConfigurationHeaderOverrides({
        ...configurationHeaderOverrides,
      });
      await saveConnectionProfile({ host, state });

      const profile = readProfile();
      expect(profile.encodedConfigurationHeaderOverrides).toBeDefined();
      expect(profile.encodedAuthenticationHeaderOverrides).toBeUndefined();
      expect(readFileText()).not.toContain('test-only-mutable-secret');
    });

    test('3: reading gives back the maps with their names and values', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });

      const profile = await getConnectionProfileByHost({
        host,
        state: newState(),
      });

      expect(profile.authenticationHeaderOverrides).toEqual(
        authenticationHeaderOverrides
      );
      expect(profile.configurationHeaderOverrides).toEqual(
        configurationHeaderOverrides
      );
    });

    test('4: loading a profile puts the decrypted maps into the state', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });

      const state = newState();
      await loadConnectionProfileByHost({ host, state });

      expect(state.getAuthenticationHeaderOverrides()).toEqual(
        authenticationHeaderOverrides
      );
      expect(state.getConfigurationHeaderOverrides()).toEqual(
        configurationHeaderOverrides
      );
    });

    test('5: the values are encrypted with the key, not stored under another encoding', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const stored = readProfile().encodedAuthenticationHeaderOverrides;

      // a profile read with another master key does not give the values
      const otherKey = join(directory, 'other.key');
      fs.writeFileSync(otherKey, 'test-only-other-master-key');
      await expect(
        getConnectionProfileByHost({
          host,
          state: newState({ key: otherKey }),
        })
      ).rejects.toThrow(FrodoError);
      // the stored text is not the JSON of the map in base64
      expect(Buffer.from(stored, 'base64').toString('utf8')).not.toContain(
        'test-only-gateway-secret'
      );
    });

    test('6: saving the same profile again leaves the file as it is', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const before = readFileText();
      const modified = fs.statSync(filename).mtimeMs;

      expect(
        await saveConnectionProfile({ host, state: stateWithOverrides() })
      ).toBe(true);

      expect(readFileText()).toBe(before);
      expect(fs.statSync(filename).mtimeMs).toBe(modified);
    });

    test('7: a changed value is stored again, an unchanged map keeps its text', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const before = readProfile();

      const state = newState();
      state.setAuthenticationHeaderOverrides({
        ...authenticationHeaderOverrides,
        'X-Gateway-Key': 'test-only-rotated-secret',
      });
      state.setConfigurationHeaderOverrides({
        ...configurationHeaderOverrides,
      });
      await saveConnectionProfile({ host, state });

      const after = readProfile();
      expect(after.encodedAuthenticationHeaderOverrides).not.toBe(
        before.encodedAuthenticationHeaderOverrides
      );
      expect(after.encodedConfigurationHeaderOverrides).toBe(
        before.encodedConfigurationHeaderOverrides
      );
      const read = await getConnectionProfileByHost({
        host,
        state: newState(),
      });
      expect(read.authenticationHeaderOverrides['X-Gateway-Key']).toBe(
        'test-only-rotated-secret'
      );
      expect(readFileText()).not.toContain('test-only-rotated-secret');
    });

    test('8: a profile saved without overrides stores none', async () => {
      const state = newState();
      state.setUsername('neo');
      await saveConnectionProfile({ host, state });

      const profile = readProfile();
      expect(profile.encodedAuthenticationHeaderOverrides).toBeUndefined();
      expect(profile.encodedConfigurationHeaderOverrides).toBeUndefined();
      expect(profile.authenticationHeaderOverrides).toBeUndefined();
      const read = await getConnectionProfileByHost({
        host,
        state: newState(),
      });
      expect(read.authenticationHeaderOverrides).toEqual({});
      expect(read.configurationHeaderOverrides).toEqual({});
    });

    test('9: the overrides of one profile are not another profile’s', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const other = StateImpl({ host: otherHost });
      other.setConnectionProfilesPath(filename);
      other.setMasterKeyPath(keyFile);
      other.setAuthenticationHeaderOverrides({});
      other.setConfigurationHeaderOverrides({});
      other.setUsername('trinity');
      await saveConnectionProfile({ host: otherHost, state: other });

      const read = await getConnectionProfileByHost({
        host: otherHost,
        state: newState(),
      });
      expect(read.authenticationHeaderOverrides).toEqual({});
      expect(
        readProfile(otherHost).encodedAuthenticationHeaderOverrides
      ).toBeUndefined();
    });

    test('10: overrides given by the environment are stored encrypted too', async () => {
      process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES = JSON.stringify({
        'X-Env-Key': 'test-only-env-secret',
      });
      try {
        await saveConnectionProfile({ host, state: newState() });
      } finally {
        delete process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES;
      }

      expect(readFileText()).not.toContain('test-only-env-secret');
      const read = await getConnectionProfileByHost({
        host,
        state: newState(),
      });
      expect(read.authenticationHeaderOverrides).toEqual({
        'X-Env-Key': 'test-only-env-secret',
      });
    });
  });

  describe('profiles written by an older version', () => {
    test('11: a plain profile is read', async () => {
      writeOlderVersionProfile();

      const profile = await getConnectionProfileByHost({
        host,
        state: newState(),
      });

      expect(profile.authenticationHeaderOverrides).toEqual(
        authenticationHeaderOverrides
      );
      expect(profile.configurationHeaderOverrides).toEqual(
        configurationHeaderOverrides
      );
    });

    test('12: reading it, loading it and starting up do not rewrite it', async () => {
      writeOlderVersionProfile();
      const before = readFileText();
      const modified = fs.statSync(filename).mtimeMs;

      await getConnectionProfileByHost({ host, state: newState() });
      await loadConnectionProfileByHost({ host, state: newState() });
      await initConnectionProfiles({ state: newState() });
      findSavedConnectionTarget({ host, state: newState() });
      await decryptSavedAuthenticationHeaderOverrides({
        saved: findSavedConnectionTarget({ host, state: newState() }),
        state: newState(),
      });

      expect(readFileText()).toBe(before);
      expect(fs.statSync(filename).mtimeMs).toBe(modified);
    });

    test('13: saving it after it was loaded replaces the plain maps with encrypted ones', async () => {
      writeOlderVersionProfile();
      const state = newState();
      await loadConnectionProfileByHost({ host, state });

      await saveConnectionProfile({ host, state });

      const text = readFileText();
      for (const secret of [...allValues, ...allNames]) {
        expect(text).not.toContain(secret);
      }
      const profile = readProfile();
      expect(profile.authenticationHeaderOverrides).toBeUndefined();
      expect(profile.configurationHeaderOverrides).toBeUndefined();
      expect(profile.encodedAuthenticationHeaderOverrides).toBeDefined();
      expect(profile.username).toBe('neo');
      const read = await getConnectionProfileByHost({
        host,
        state: newState(),
      });
      expect(read.authenticationHeaderOverrides).toEqual(
        authenticationHeaderOverrides
      );
    });

    test('14: saving it without overrides in the state encrypts the plain maps it holds', async () => {
      writeOlderVersionProfile();
      const state = newState();
      state.setAlias('matrix');

      await saveConnectionProfile({ host, state });

      const text = readFileText();
      for (const secret of [...allValues, ...allNames]) {
        expect(text).not.toContain(secret);
      }
      expect(readProfile().alias).toBe('matrix');
      const read = await getConnectionProfileByHost({
        host,
        state: newState(),
      });
      expect(read.authenticationHeaderOverrides).toEqual(
        authenticationHeaderOverrides
      );
      expect(read.configurationHeaderOverrides).toEqual(
        configurationHeaderOverrides
      );
    });

    test('15: overrides in the state replace the plain ones of the profile', async () => {
      writeOlderVersionProfile();
      const state = newState();
      state.setAuthenticationHeaderOverrides({
        'X-New': 'test-only-new-value',
      });

      await saveConnectionProfile({ host, state });

      const read = await getConnectionProfileByHost({
        host,
        state: newState(),
      });
      expect(read.authenticationHeaderOverrides).toEqual({
        'X-New': 'test-only-new-value',
      });
      expect(readProfile().authenticationHeaderOverrides).toBeUndefined();
    });

    test('16: a plain map next to an encrypted one (an older version saved last) wins per header', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const profiles = JSON.parse(readFileText());
      profiles[host].authenticationHeaderOverrides = {
        'X-Gateway-Key': 'test-only-newer-plain-value',
        'X-Added': 'test-only-added-value',
      };
      fs.writeFileSync(filename, JSON.stringify(profiles));

      const read = await getConnectionProfileByHost({
        host,
        state: newState(),
      });

      expect(read.authenticationHeaderOverrides).toEqual({
        ...authenticationHeaderOverrides,
        'X-Gateway-Key': 'test-only-newer-plain-value',
        'X-Added': 'test-only-added-value',
      });
    });

    test('17: what an older version does with the encrypted profile', async () => {
      // The older reader picks the fields it knows and ignores the rest, so the
      // new fields are not a parse error there; its save keeps unknown fields
      // of the profile (`profile` is a copy of the stored one). Proven here on
      // the stored shape: the encrypted maps are extra string fields beside the
      // fields an older version reads, and the plain fields are absent.
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const profile = readProfile();
      expect(Object.keys(profile).sort()).toEqual([
        'encodedAuthenticationHeaderOverrides',
        'encodedConfigurationHeaderOverrides',
      ]);
    });
  });

  describe('the key', () => {
    test('18: a wrong key fails like an unreadable password: the profile is not given', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const otherKey = join(directory, 'other.key');
      fs.writeFileSync(otherKey, 'test-only-other-master-key');

      await expect(
        getConnectionProfileByHost({ host, state: newState({ key: otherKey }) })
      ).rejects.toThrow('Error decrypting connection profile');
    });

    test('19: saving other settings with a wrong key leaves the encrypted maps as they are', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const before = readProfile();
      const otherKey = join(directory, 'other.key');
      fs.writeFileSync(otherKey, 'test-only-other-master-key');
      const state = newState({ key: otherKey });
      state.setAlias('matrix');

      await saveConnectionProfile({ host, state });

      const after = readProfile();
      expect(after.alias).toBe('matrix');
      expect(after.encodedAuthenticationHeaderOverrides).toBe(
        before.encodedAuthenticationHeaderOverrides
      );
      expect(after.encodedConfigurationHeaderOverrides).toBe(
        before.encodedConfigurationHeaderOverrides
      );
    });

    test('19b: a plain map next to an encrypted map that the key cannot read: saving other settings does not fail and changes neither', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const profiles = JSON.parse(readFileText());
      profiles[host].authenticationHeaderOverrides = {
        'X-Added': 'test-only-added-value',
      };
      fs.writeFileSync(filename, JSON.stringify(profiles));
      const before = readProfile();
      const otherKey = join(directory, 'other.key');
      fs.writeFileSync(otherKey, 'test-only-other-master-key');
      const state = newState({ key: otherKey });
      state.setAlias('matrix');

      expect(await saveConnectionProfile({ host, state })).toBe(true);

      const after = readProfile();
      expect(after.alias).toBe('matrix');
      expect(after.authenticationHeaderOverrides).toEqual(
        before.authenticationHeaderOverrides
      );
      expect(after.encodedAuthenticationHeaderOverrides).toBe(
        before.encodedAuthenticationHeaderOverrides
      );
    });

    test('19c: an empty plain map is not turned into an encrypted one', async () => {
      writeOlderVersionProfile({
        authenticationHeaderOverrides: {},
        configurationHeaderOverrides: {},
      });
      const state = newState();
      state.setAlias('matrix');

      await saveConnectionProfile({ host, state });

      const profile = readProfile();
      expect(profile.alias).toBe('matrix');
      expect(profile.encodedAuthenticationHeaderOverrides).toBeUndefined();
      expect(profile.encodedConfigurationHeaderOverrides).toBeUndefined();
    });

    test('20: a profile without overrides never touches the master key', async () => {
      fs.rmSync(keyFile);
      fs.writeFileSync(
        filename,
        JSON.stringify({ [host]: { username: 'neo' } })
      );
      const state = newState();

      const saved = findSavedConnectionTarget({ host, state });
      const overrides = await decryptSavedAuthenticationHeaderOverrides({
        saved,
        state,
      });

      expect(overrides).toEqual({});
      expect(fs.existsSync(keyFile)).toBe(false);
    });

    test('21: a login that reads no credential decrypts the overrides of the profile', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const state = newState();

      const saved = findSavedConnectionTarget({ host, state });

      // found without a key, and still encrypted
      expect(saved.encodedAuthenticationHeaderOverrides).toEqual(
        expect.any(String)
      );
      expect(saved.authenticationHeaderOverrides).toBeUndefined();
      expect(
        await decryptSavedAuthenticationHeaderOverrides({ saved, state })
      ).toEqual(authenticationHeaderOverrides);
    });

    test('22: that decryption fails with a wrong key, like the password of the profile', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const otherKey = join(directory, 'other.key');
      fs.writeFileSync(otherKey, 'test-only-other-master-key');
      const state = newState({ key: otherKey });

      await expect(
        decryptSavedAuthenticationHeaderOverrides({
          saved: findSavedConnectionTarget({ host, state }),
          state,
        })
      ).rejects.toThrow('Error decrypting connection profile');
    });

    test('23: that decryption reads the plain map of an older profile without a key', async () => {
      fs.rmSync(keyFile);
      writeOlderVersionProfile();
      const state = newState();

      const overrides = await decryptSavedAuthenticationHeaderOverrides({
        saved: findSavedConnectionTarget({ host, state }),
        state,
      });

      expect(overrides).toEqual(authenticationHeaderOverrides);
      expect(fs.existsSync(keyFile)).toBe(false);
    });
  });

  describe('output', () => {
    test('24: debug output names the headers and never shows a value', async () => {
      const saveState = stateWithOverrides();
      await saveConnectionProfile({ host, state: saveState });
      await getConnectionProfileByHost({ host, state: newState() });

      const output = debugMessages.join('\n');
      for (const value of allValues) {
        expect(output).not.toContain(value);
      }
      expect(output).toContain('X-Gateway-Key');
      expect(output).toContain('X-Configuration-Type');
    });

    test('25: debug output of an older profile never shows a value either', async () => {
      writeOlderVersionProfile();
      await getConnectionProfileByHost({ host, state: newState() });
      await saveConnectionProfile({ host, state: newState() });

      const output = debugMessages.join('\n');
      for (const value of allValues) {
        expect(output).not.toContain(value);
      }
    });

    test('26: the error of a failed decryption holds no header value', async () => {
      await saveConnectionProfile({ host, state: stateWithOverrides() });
      const otherKey = join(directory, 'other.key');
      fs.writeFileSync(otherKey, 'test-only-other-master-key');

      let error: unknown;
      try {
        await getConnectionProfileByHost({
          host,
          state: newState({ key: otherKey }),
        });
      } catch (e) {
        error = e;
      }

      const message = String((error as FrodoError).getCombinedMessage());
      for (const value of allValues) {
        expect(message).not.toContain(value);
      }
    });

    test('27: the connection profile functions are not capabilities of the MCP server', () => {
      const inventory = buildCapabilityInventory(frodo);

      expect(inventory.filter((c) => c.id.startsWith('conn.'))).toEqual([]);
    });

    test('28: nothing prints a value through the print handler when saving', async () => {
      const printed = jest.fn();
      const state = stateWithOverrides();
      state.setPrintHandler(printed as never);
      state.setVerboseHandler(printed as never);

      await saveConnectionProfile({ host, state });

      for (const value of allValues) {
        expect(JSON.stringify(printed.mock.calls)).not.toContain(value);
      }
    });
  });
});
