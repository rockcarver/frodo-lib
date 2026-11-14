/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent ConnectionProfileOps.legacyMigration
 *
 * The legacy connection profiles file `.frodorc` lives in the Frodo home next to the default profiles file
 * `Connections.json`, and its migration belongs to that location only. These tests pin what the migration does for
 * the default location (the three cases it has) and that a caller that names its own profiles file, by the state or
 * by the environment, gets nothing created, copied or renamed in the Frodo home (frodo-lib#1076). The Frodo home is
 * the temporary home that the test guard gives every test file (`os.homedir()`); real file I/O, not mocked.
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
import {
  initConnectionProfiles,
  migrateFromLegacyProfile,
} from './ConnectionProfileOps';
import { FrodoError } from './FrodoError';

const isWindows = process.platform === 'win32';
const OWNER_ONLY_FILE = 0o600;

const TMP_DIR = path.resolve(
  '.',
  'test',
  'fs_tmp',
  'ConnectionProfileOps.legacyMigration'
);
const MASTER_KEY = path.join(TMP_DIR, 'masterkey.key');

const frodoHome = () => path.join(os.homedir(), '.frodo');
const defaultFile = () => path.join(frodoHome(), 'Connections.json');
const legacyFile = () => path.join(frodoHome(), '.frodorc');
const deprecatedFile = () => `${legacyFile()}.deprecated`;
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
    host: 'https://openam-legacy-migration.example.com/am',
  });
  if (profilesPath) state.setConnectionProfilesPath(profilesPath);
  state.setMasterKeyPath(MASTER_KEY);
  state.setDeploymentType('classic');
  return state;
}

/** A profiles file of its own, outside the Frodo home. */
function ownFile(name = `${Math.random()}.Connections.json`): string {
  return path.join(TMP_DIR, name);
}

beforeEach(() => {
  fs.rmSync(frodoHome(), { recursive: true, force: true });
  fs.mkdirSync(frodoHome(), { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

describe('the migration for the default profiles file', () => {
  test('1: neither file exists: an empty Connections.json is created, readable by the owner only', () => {
    migrateFromLegacyProfile({ state: newState() });
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(
      JSON.stringify({}, null, 4)
    );
    if (!isWindows) expect(mode(defaultFile())).toBe(OWNER_ONLY_FILE);
    expect(homeListing()).toEqual(['Connections.json']);
  });

  test('2: only the legacy file exists: it is copied to Connections.json and renamed to .frodorc.deprecated, both readable by the owner only', () => {
    fs.writeFileSync(legacyFile(), LEGACY_CONTENT, { mode: 0o644 });
    migrateFromLegacyProfile({ state: newState() });
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(LEGACY_CONTENT);
    expect(fs.readFileSync(deprecatedFile(), 'utf8')).toBe(LEGACY_CONTENT);
    expect(fs.existsSync(legacyFile())).toBe(false);
    if (!isWindows) {
      expect(mode(defaultFile())).toBe(OWNER_ONLY_FILE);
      expect(mode(deprecatedFile())).toBe(OWNER_ONLY_FILE);
    }
    expect(homeListing()).toEqual(['.frodorc.deprecated', 'Connections.json']);
  });

  test('3: both files exist: nothing changes, nothing is renamed, nothing is overwritten', () => {
    fs.writeFileSync(legacyFile(), LEGACY_CONTENT);
    fs.writeFileSync(defaultFile(), NEW_CONTENT);
    migrateFromLegacyProfile({ state: newState() });
    expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(NEW_CONTENT);
    expect(homeListing()).toEqual(['.frodorc', 'Connections.json']);
  });

  test('4: only Connections.json exists: nothing changes and no legacy file appears', () => {
    fs.writeFileSync(defaultFile(), NEW_CONTENT);
    migrateFromLegacyProfile({ state: newState() });
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(NEW_CONTENT);
    expect(homeListing()).toEqual(['Connections.json']);
  });

  test('5: the default file named explicitly, also spelled with a detour, is the default file', () => {
    const detour = `${frodoHome()}${path.sep}..${path.sep}.frodo${path.sep}Connections.json`;
    migrateFromLegacyProfile({ state: newState(detour) });
    expect(fs.existsSync(defaultFile())).toBe(true);
    expect(homeListing()).toEqual(['Connections.json']);
  });

  test('6: a failure is a FrodoError that names the migration and keeps the cause', () => {
    // the Frodo home is a file: nothing can be created in it
    fs.rmSync(frodoHome(), { recursive: true, force: true });
    fs.writeFileSync(frodoHome(), 'not a directory');
    let thrown: unknown;
    try {
      migrateFromLegacyProfile({ state: newState() });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FrodoError);
    expect((thrown as FrodoError).message).toContain(
      'Error migrating from legacy connection profile'
    );
    expect((thrown as FrodoError).originalErrors.length).toBeGreaterThan(0);
  });
});

describe('a caller that names its own profiles file (frodo-lib#1076)', () => {
  test('1: by the state, with an empty Frodo home: nothing is created in the home', () => {
    migrateFromLegacyProfile({ state: newState(ownFile()) });
    expect(homeListing()).toEqual([]);
  });

  test('2: by the state, with a legacy file in the Frodo home: it is neither copied nor renamed', () => {
    fs.writeFileSync(legacyFile(), LEGACY_CONTENT);
    migrateFromLegacyProfile({ state: newState(ownFile()) });
    expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
    expect(homeListing()).toEqual(['.frodorc']);
  });

  test('3: by the environment: the same', () => {
    const key = Constants.FRODO_CONNECTION_PROFILES_PATH_KEY;
    const before = process.env[key];
    process.env[key] = ownFile();
    try {
      fs.writeFileSync(legacyFile(), LEGACY_CONTENT);
      migrateFromLegacyProfile({ state: newState() });
      expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
      expect(homeListing()).toEqual(['.frodorc']);
      fs.rmSync(legacyFile());
      migrateFromLegacyProfile({ state: newState() });
      expect(homeListing()).toEqual([]);
    } finally {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    }
  });

  test('4: initializing an existing profiles file of its own leaves the Frodo home as it is (the three suites that reached it)', async () => {
    const file = ownFile();
    fs.writeFileSync(file, '{}');
    await initConnectionProfiles({ state: newState(file) });
    expect(fs.readFileSync(file, 'utf8')).toBe('{}');
    expect(homeListing()).toEqual([]);

    fs.writeFileSync(legacyFile(), LEGACY_CONTENT);
    await initConnectionProfiles({ state: newState(file) });
    expect(homeListing()).toEqual(['.frodorc']);
    expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
  });

  test('5: initializing a missing profiles file of its own creates that file and nothing in the Frodo home', async () => {
    const file = ownFile();
    await initConnectionProfiles({ state: newState(file) });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({});
    expect(homeListing()).toEqual([]);
  });
});

describe('initializing the default profiles file', () => {
  test('1: an existing Connections.json next to a legacy file: both stay as they are (the migration has nothing to do once the new file exists)', async () => {
    fs.writeFileSync(legacyFile(), LEGACY_CONTENT);
    fs.writeFileSync(defaultFile(), NEW_CONTENT);
    await initConnectionProfiles({ state: newState() });
    expect(fs.readFileSync(legacyFile(), 'utf8')).toBe(LEGACY_CONTENT);
    expect(fs.readFileSync(defaultFile(), 'utf8')).toBe(NEW_CONTENT);
    expect(homeListing()).toEqual(['.frodorc', 'Connections.json']);
  });
});
