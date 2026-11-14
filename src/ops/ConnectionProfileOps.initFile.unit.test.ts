/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent ConnectionProfileOps.initFile
 *
 * `initConnectionProfiles` makes sure the connection profiles file exists. These tests pin where it creates it and
 * what it leaves alone: the default `Connections.json` of the Frodo home is created empty with owner-only
 * permissions; a legacy `.frodorc` file next to it is not touched, copied or renamed (the migration of that file was
 * removed because it could never run for the default file, frodo-lib#1076); and a caller that names its own profiles
 * file, by the state or by the environment, gets nothing created in the Frodo home. The Frodo home is the temporary
 * home that the test guard gives every test file (`os.homedir()`); real file I/O, not mocked.
 */
// the library entry first, as the other suites that load this module do: the parts of the library import each
// other in a cycle that only resolves in the order of the entry
import '../index';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, test } from '@jest/globals';
import Constants from '../shared/Constants';
import StateImpl from '../shared/State';
import { initConnectionProfiles } from './ConnectionProfileOps';

const isWindows = process.platform === 'win32';
const OWNER_ONLY_FILE = 0o600;

const TMP_DIR = path.resolve(
  '.',
  'test',
  'fs_tmp',
  'ConnectionProfileOps.initFile'
);
const MASTER_KEY = path.join(TMP_DIR, 'masterkey.key');

const frodoHome = () => path.join(os.homedir(), '.frodo');
const defaultFile = () => path.join(frodoHome(), 'Connections.json');
const legacyFile = () => path.join(frodoHome(), '.frodorc');
const LEGACY_CONTENT = JSON.stringify({
  'https://openam-legacy.example.com/am': { username: 'legacy-user' },
});
const NEW_CONTENT = JSON.stringify({
  'https://openam-new.example.com/am': { username: 'new-user' },
});

function mode(file: string): number {
  return fs.statSync(file).mode & 0o777;
}

/** What is in the Frodo home (names only), sorted. */
function homeListing(): string[] {
  return fs.existsSync(frodoHome()) ? fs.readdirSync(frodoHome()).sort() : [];
}

function newState(profilesPath?: string) {
  const state = StateImpl({
    host: 'https://openam-init-file.example.com/am',
  });
  if (profilesPath) state.setConnectionProfilesPath(profilesPath);
  state.setMasterKeyPath(MASTER_KEY);
  state.setDeploymentType('classic');
  return state;
}

/** A profiles file of its own, outside the Frodo home. */
function ownFile(): string {
  return path.join(TMP_DIR, `${Math.random()}.Connections.json`);
}

beforeEach(() => {
  fs.rmSync(frodoHome(), { recursive: true, force: true });
  fs.mkdirSync(frodoHome(), { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

describe('initializing the default profiles file', () => {
  test('1: a missing file is created empty, readable by the owner only, and nothing else is created in the Frodo home', async () => {
    await initConnectionProfiles({ state: newState() });
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(
      JSON.stringify({}, null, 4)
    );
    if (!isWindows) expect(mode(defaultFile())).toBe(OWNER_ONLY_FILE);
    expect(homeListing()).toEqual(['Connections.json']);
  });

  test('2: a legacy .frodorc next to a missing Connections.json is not touched, copied or renamed', async () => {
    fs.writeFileSync(legacyFile(), LEGACY_CONTENT, { mode: 0o644 });
    const legacyBefore = fs.statSync(legacyFile());
    await initConnectionProfiles({ state: newState() });
    // the new file is the empty one: the old profiles are not migrated (the migration was removed: frodo-lib#1076)
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(
      JSON.stringify({}, null, 4)
    );
    expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
    const legacyAfter = fs.statSync(legacyFile());
    expect(legacyAfter.mtimeMs).toBe(legacyBefore.mtimeMs);
    if (!isWindows) expect(mode(legacyFile())).toBe(0o644);
    expect(homeListing()).toEqual(['.frodorc', 'Connections.json']);
  });

  test('3: an existing Connections.json next to a legacy .frodorc: both stay as they are', async () => {
    fs.writeFileSync(legacyFile(), LEGACY_CONTENT, { mode: 0o644 });
    fs.writeFileSync(defaultFile(), NEW_CONTENT);
    await initConnectionProfiles({ state: newState() });
    expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
    if (!isWindows) expect(mode(legacyFile())).toBe(0o644);
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(NEW_CONTENT);
    expect(homeListing()).toEqual(['.frodorc', 'Connections.json']);
  });

  test('4: an existing Connections.json alone stays as it is and no legacy file appears', async () => {
    fs.writeFileSync(defaultFile(), NEW_CONTENT);
    await initConnectionProfiles({ state: newState() });
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(NEW_CONTENT);
    expect(homeListing()).toEqual(['Connections.json']);
  });
});

describe('a caller that names its own profiles file (frodo-lib#1076)', () => {
  test('1: by the state, an existing file is left as it is and the Frodo home stays empty', async () => {
    const file = ownFile();
    fs.writeFileSync(file, '{}');
    await initConnectionProfiles({ state: newState(file) });
    expect(fs.readFileSync(file, 'utf8')).toBe('{}');
    expect(homeListing()).toEqual([]);
  });

  test('2: by the state, a missing file is created there, readable by the owner only, and nothing is created in the Frodo home', async () => {
    const file = ownFile();
    await initConnectionProfiles({ state: newState(file) });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({});
    if (!isWindows) expect(mode(file)).toBe(OWNER_ONLY_FILE);
    expect(homeListing()).toEqual([]);
  });

  test('3: by the state, a legacy .frodorc in the Frodo home is not touched', async () => {
    const file = ownFile();
    fs.writeFileSync(file, '{}');
    fs.writeFileSync(legacyFile(), LEGACY_CONTENT, { mode: 0o644 });
    await initConnectionProfiles({ state: newState(file) });
    expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
    expect(homeListing()).toEqual(['.frodorc']);
  });

  test('4: by the environment, the same: the Frodo home stays as it is', async () => {
    const key = Constants.FRODO_CONNECTION_PROFILES_PATH_KEY;
    const before = process.env[key];
    const file = ownFile();
    process.env[key] = file;
    try {
      fs.writeFileSync(legacyFile(), LEGACY_CONTENT, { mode: 0o644 });
      await initConnectionProfiles({ state: newState() });
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({});
      expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
      expect(homeListing()).toEqual(['.frodorc']);
    } finally {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    }
  });
});
