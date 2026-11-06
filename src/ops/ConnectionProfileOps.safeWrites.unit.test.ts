/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent ConnectionProfileOps.safeWrites
 *
 * The connection profiles file holds every saved connection and its
 * credentials, and several processes may change it at once. These tests pin
 * what keeps it safe: a save changes only its own profile, saving what is
 * already saved writes nothing, a file that cannot be parsed is never
 * overwritten, and no lock or temporary file is left behind. Real file I/O
 * against a scratch directory (not mocked).
 */
// the library entry first, as the other suites that load this module do: the
// parts of the library import each other in a cycle that only resolves in the
// order of the entry
import '../index';
import fs from 'fs';
import { resolve } from 'path';
import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import DataProtection from '../utils/DataProtection';
import {
  deleteConnectionProfile,
  deleteConnectionProfileAlias,
  initConnectionProfiles,
  saveConnectionProfile,
  setConnectionProfileAlias,
} from './ConnectionProfileOps';
import { FrodoError } from './FrodoError';

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'ConnectionProfileOps.safeWrites'
);
const MASTER_KEY = resolve(TMP_DIR, 'masterkey.key');
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function newFile(): string {
  return resolve(TMP_DIR, `${Math.random()}.Connections.json`);
}

function stateFor(file: string, host: string, password = 'password') {
  const state = StateImpl({ host });
  state.setConnectionProfilesPath(file);
  state.setMasterKeyPath(MASTER_KEY);
  state.setDeploymentType('classic');
  state.setUsername('someone');
  state.setPassword(password);
  return state;
}

/** Files in the directory of a profiles file that are not the file itself. */
function leftovers(file: string): string[] {
  const own = file.split(/[\\/]/).pop();
  return fs
    .readdirSync(TMP_DIR)
    .filter(
      (name) =>
        name !== 'masterkey.key' &&
        (name.startsWith(own as string) ? name !== own : false)
    );
}

/**
 * Make the next check whether a file exists answer "no", although it does:
 * what another process creating the file just after the check looks like.
 */
function pretendMissingOnce(file: string) {
  const exists = fs.existsSync.bind(fs);
  let pretend = true;
  return jest
    .spyOn(fs, 'existsSync')
    .mockImplementation((candidate: fs.PathLike) => {
      if (pretend && candidate === file) {
        pretend = false;
        return false;
      }
      return exists(candidate);
    });
}

describe('connection profiles file: safe writes', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(MASTER_KEY, 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test('1: a save changes only its own profile and keeps the others as they are', async () => {
    const file = newFile();
    const other = {
      'https://openam-other.example.com/am': {
        username: 'other',
        encodedPassword: 'unchanged-cipher',
        // a field this library version knows nothing about
        customField: { kept: true },
      },
    };
    fs.writeFileSync(file, JSON.stringify(other, null, 2));
    const host = 'https://openam-mine.example.com/am';
    expect(
      await saveConnectionProfile({ host, state: stateFor(file, host) })
    ).toBe(true);

    const profiles = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(Object.keys(profiles).sort()).toEqual([
      'https://openam-mine.example.com/am',
      'https://openam-other.example.com/am',
    ]);
    expect(profiles['https://openam-other.example.com/am']).toEqual(
      other['https://openam-other.example.com/am']
    );
    expect(profiles[host].username).toBe('someone');
    expect(leftovers(file)).toEqual([]);
  });

  test('2: saving what is already saved writes nothing', async () => {
    const file = newFile();
    const host = 'https://openam-same.example.com/am';
    await saveConnectionProfile({ host, state: stateFor(file, host) });
    const before = fs.readFileSync(file, 'utf8');
    const modified = fs.statSync(file).mtimeMs;
    await wait(25);

    await saveConnectionProfile({ host, state: stateFor(file, host) });

    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(fs.statSync(file).mtimeMs).toBe(modified);
  });

  test('3: saving a changed password writes it, and it decrypts to the new one', async () => {
    const file = newFile();
    const host = 'https://openam-changed.example.com/am';
    await saveConnectionProfile({ host, state: stateFor(file, host) });
    const first = JSON.parse(fs.readFileSync(file, 'utf8'))[host];

    await saveConnectionProfile({
      host,
      state: stateFor(file, host, 'another-password'),
    });

    const second = JSON.parse(fs.readFileSync(file, 'utf8'))[host];
    expect(second.encodedPassword).not.toBe(first.encodedPassword);
    const dataProtection = new DataProtection({
      pathToMasterKey: MASTER_KEY,
      state: StateImpl({ host }),
    });
    expect(await dataProtection.decrypt(second.encodedPassword)).toBe(
      'another-password'
    );
  });

  test('4: a file that cannot be parsed is not overwritten by a save, an alias change or a delete', async () => {
    const file = newFile();
    const garbage = '{"https://openam-x.example.com/am": {"username": "x"'; // cut off
    fs.writeFileSync(file, garbage);
    const host = 'https://openam-garbage.example.com/am';

    await expect(
      saveConnectionProfile({ host, state: stateFor(file, host) })
    ).rejects.toBeInstanceOf(FrodoError);
    // the message says why, so that it is not mistaken for "no such profile"
    expect(() =>
      setConnectionProfileAlias({
        host: 'x',
        alias: 'a',
        state: stateFor(file, host),
      })
    ).toThrow(/cannot be parsed/);
    expect(() =>
      deleteConnectionProfile({ host: 'x', state: stateFor(file, host) })
    ).toThrow(/cannot be parsed/);

    expect(fs.readFileSync(file, 'utf8')).toBe(garbage);
    expect(leftovers(file)).toEqual([]);
  });

  test('5: an alias that is already taken is refused, the file is untouched and no lock is left', async () => {
    const file = newFile();
    const a = 'https://openam-a.example.com/am';
    const b = 'https://openam-b.example.com/am';
    await saveConnectionProfile({ host: a, state: stateFor(file, a) });
    await saveConnectionProfile({ host: b, state: stateFor(file, b) });
    setConnectionProfileAlias({
      host: a,
      alias: 'first',
      state: stateFor(file, a),
    });
    const before = fs.readFileSync(file, 'utf8');

    expect(() =>
      setConnectionProfileAlias({
        host: b,
        alias: 'first',
        state: stateFor(file, b),
      })
    ).toThrow(/already in use/);

    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(leftovers(file)).toEqual([]);
  });

  test('6: alias set, alias delete and profile delete change the file and leave the other profiles alone', async () => {
    const file = newFile();
    const a = 'https://openam-alias-a.example.com/am';
    const b = 'https://openam-alias-b.example.com/am';
    await saveConnectionProfile({ host: a, state: stateFor(file, a) });
    await saveConnectionProfile({ host: b, state: stateFor(file, b) });
    const untouched = JSON.parse(fs.readFileSync(file, 'utf8'))[b];

    setConnectionProfileAlias({
      host: a,
      alias: 'mine',
      state: stateFor(file, a),
    });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))[a].alias).toBe('mine');
    deleteConnectionProfileAlias({ host: 'mine', state: stateFor(file, a) });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))[a].alias).toBeUndefined();
    deleteConnectionProfile({ host: a, state: stateFor(file, a) });

    const profiles = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(Object.keys(profiles)).toEqual([b]);
    expect(profiles[b]).toEqual(untouched);
    expect(leftovers(file)).toEqual([]);
  });

  test('7: initializing creates a missing file, converts clear-text secrets once and leaves the other profiles alone', async () => {
    const file = newFile();
    const state = stateFor(file, 'https://openam-init.example.com/am');
    await initConnectionProfiles({ state });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({});

    fs.writeFileSync(
      file,
      JSON.stringify({
        'https://openam-legacy.example.com/am': {
          username: 'legacy',
          password: 'clear-text',
          logApiSecret: 'clear-log-secret',
        },
        'https://openam-modern.example.com/am': {
          username: 'modern',
          encodedPassword: 'already-encrypted',
        },
      })
    );
    await initConnectionProfiles({ state });
    const converted = JSON.parse(fs.readFileSync(file, 'utf8'));
    const legacy = converted['https://openam-legacy.example.com/am'];
    expect(legacy.password).toBeUndefined();
    expect(legacy.logApiSecret).toBeUndefined();
    const dataProtection = new DataProtection({
      pathToMasterKey: MASTER_KEY,
      state,
    });
    expect(await dataProtection.decrypt(legacy.encodedPassword)).toBe(
      'clear-text'
    );
    expect(await dataProtection.decrypt(legacy.encodedLogApiSecret)).toBe(
      'clear-log-secret'
    );
    expect(converted['https://openam-modern.example.com/am']).toEqual({
      username: 'modern',
      encodedPassword: 'already-encrypted',
    });

    // a second start has nothing left to convert and writes nothing
    const modified = fs.statSync(file).mtimeMs;
    await wait(25);
    await initConnectionProfiles({ state });
    expect(fs.statSync(file).mtimeMs).toBe(modified);
    expect(leftovers(file)).toEqual([]);
  });

  test('8: a profiles file that another process created a moment ago is not overwritten by the empty one', async () => {
    const file = newFile();
    const content = JSON.stringify({
      'https://openam-just-saved.example.com/am': { username: 'saved' },
    });
    fs.writeFileSync(file, content);
    const spy = pretendMissingOnce(file);
    try {
      await initConnectionProfiles({
        state: stateFor(file, 'https://openam-init.example.com/am'),
      });
    } finally {
      spy.mockRestore();
    }
    expect(fs.readFileSync(file, 'utf8')).toBe(content);
  });

  test('9: a master key that another process created a moment ago is used, not replaced', async () => {
    const keyPath = resolve(TMP_DIR, `${Math.random()}.masterkey.key`);
    fs.writeFileSync(keyPath, 'key-of-the-other-process');
    const spy = pretendMissingOnce(keyPath);
    const state = StateImpl({ host: 'https://openam-key.example.com/am' });
    try {
      const encrypted = await new DataProtection({
        pathToMasterKey: keyPath,
        state,
      }).encrypt('secret');
      spy.mockRestore();
      expect(fs.readFileSync(keyPath, 'utf8')).toBe('key-of-the-other-process');
      expect(
        await new DataProtection({
          pathToMasterKey: keyPath,
          state,
        }).decrypt(encrypted)
      ).toBe('secret');
    } finally {
      spy.mockRestore();
    }
  });
});
