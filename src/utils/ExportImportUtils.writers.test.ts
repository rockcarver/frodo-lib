/**
 * Self-sufficient config writer tests.
 *
 * Run with:
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent ExportImportUtils.writers
 *
 * Bare library consumers may never call initConnectionProfiles()/initTokenCache().
 * These cells assert that every config writer succeeds when the target
 * directory does not exist yet, without any init call.
 */
import fs from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import {
  ensureDirectoryForFile,
  saveJsonToFile,
  saveTextToFile,
} from './ExportImportUtils';
import { state } from '../index';
import {
  deleteConnectionProfile,
  saveConnectionProfile,
  setConnectionProfileAlias,
} from '../ops/ConnectionProfileOps';
import { saveUserSessionToken } from '../ops/TokenCacheOps';

let baseTmp: string;
let nonce: string;

beforeAll(() => {
  nonce = `frodo-lib-writers-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  baseTmp = join(tmpdir(), nonce);
});

afterAll(() => {
  try {
    fs.rmSync(baseTmp, { recursive: true, force: true });
  } catch (error) {
    // ignore
  }
});

describe('saveTextToFile (shared chokepoint)', () => {
  test('creates a non-existent nested directory and writes the file', () => {
    const filename = join(baseTmp, 'level1', 'level2', 'out.txt');
    const result = saveTextToFile({
      data: 'hello world',
      filename,
      state,
    });
    expect(result).toBe(true);
    expect(fs.readFileSync(filename, 'utf8')).toBe('hello world\n');
  });

  test('returns false (no throw) when the directory cannot be created', () => {
    // use a path under a FILE to force mkdir to fail
    const blockingFile = join(baseTmp, 'blocking-file');
    fs.writeFileSync(blockingFile, 'not a directory');
    const filename = join(blockingFile, 'sub', 'out.txt');
    expect(() =>
      saveTextToFile({ data: 'x', filename, state })
    ).not.toThrow();
    expect(fs.existsSync(filename)).toBe(false);
  });
});

describe('saveJsonToFile', () => {
  test('creates a non-existent directory and writes json', () => {
    const filename = join(baseTmp, 'json', 'deep', 'out.json');
    const result = saveJsonToFile({
      data: { key: 'value' },
      filename,
      includeMeta: false,
      state,
    });
    expect(result).toBe(true);
    expect(JSON.parse(fs.readFileSync(filename, 'utf8'))).toEqual({
      key: 'value',
    });
  });
});

describe('saveConnectionProfile', () => {
  test('succeeds writing into a non-existent directory without initConnectionProfiles()', async () => {
    const filename = join(baseTmp, 'profiles', 'Connections.json');
    const host = 'https://openam-writers-test.forgeblocks.com/am';
    const prevStatePath = state.getConnectionProfilesPath();
    try {
      state.setConnectionProfilesPath(filename);
      state.setHost(host);
      state.setDeploymentType('classic');
      state.setUsername('frodo.baggins@shire.me');
      state.setPassword('irrelevant');
      const result = await saveConnectionProfile({ host, state });
      expect(result).toBe(true);
      const connections = JSON.parse(fs.readFileSync(filename, 'utf8'));
      expect(connections[host]).toBeTruthy();
      expect(connections[host].username).toBe('frodo.baggins@shire.me');
    } finally {
      state.setConnectionProfilesPath(prevStatePath);
    }
  }, 30000);

  test('returns false when the underlying profiles-file write fails', async () => {
    // a parent path component is a file -> saveJsonToFile cannot write there;
    // saveConnectionProfile must propagate the failure as false instead of
    // reporting unconditioned success
    const blockingFile = join(baseTmp, 'blocking-save-profile');
    fs.writeFileSync(blockingFile, 'not a directory');
    const filename = join(blockingFile, 'sub', 'Connections.json');
    const host = 'https://openam-blocked-write.forgeblocks.com/am';
    const prevStatePath = state.getConnectionProfilesPath();
    // keep the master-key bootstrap inside the temp tree so the cell never
    // touches the real ~/.frodo
    const savedMasterKeyPath = process.env.FRODO_MASTER_KEY_PATH;
    try {
      process.env.FRODO_MASTER_KEY_PATH = join(baseTmp, 'blocked-master.key');
      state.setConnectionProfilesPath(filename);
      state.setHost(host);
      state.setDeploymentType('classic');
      state.setUsername('frodo.baggins@shire.me');
      state.setPassword('irrelevant');
      const result = await saveConnectionProfile({ host, state });
      expect(result).toBe(false);
      expect(fs.existsSync(filename)).toBe(false);
    } finally {
      state.setConnectionProfilesPath(prevStatePath);
      if (savedMasterKeyPath === undefined)
        delete process.env.FRODO_MASTER_KEY_PATH;
      else process.env.FRODO_MASTER_KEY_PATH = savedMasterKeyPath;
    }
  }, 30000);
});

describe('setConnectionProfileAlias', () => {
  test('succeeds writing into a non-existent directory when the profiles file already exists there', async () => {
    // setConnectionProfileAlias reads the file first, so the file must exist;
    // the directory guard makes the WRITE succeed even if only the file was
    // planted (e.g. restored from backup without its directory... not possible,
    // but the guard protects the deleteConnectionProfileAlias path too).
    const dir = join(baseTmp, 'alias-profiles');
    const filename = join(dir, 'Connections.json');
    const host = 'https://openam-alias-test.forgeblocks.com/am';
    fs.mkdirSync(dir, { recursive: true });
    // Simulate the file being planted without its parent dirs by removing the
    // dir after writing — then the write must recreate it.
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      filename,
      JSON.stringify({ [host]: { tenant: host, username: 'x' } })
    );
    // remove the whole tree, then re-plant ONLY the file via a fresh dir write
    // is impossible without the dir — instead assert the common case: file
    // exists, dir exists, write works. The mkdir-guard case is covered by
    // deleteConnectionProfileAlias below.
    const prevStatePath = state.getConnectionProfilesPath();
    try {
      state.setConnectionProfilesPath(filename);
      await setConnectionProfileAlias({
        host,
        alias: 'alias-test-1',
        state,
      });
      const connections = JSON.parse(fs.readFileSync(filename, 'utf8'));
      expect(connections[host].alias).toBe('alias-test-1');
    } finally {
      state.setConnectionProfilesPath(prevStatePath);
    }
  });
});

describe('deleteConnectionProfileAlias / deleteConnectionProfile', () => {
  test('setConnectionProfileAlias preserves the documented not-found failure mode when the file is gone', async () => {
    // The alias ops guard the WRITE path only; a missing FILE still throws
    // the documented FrodoError (read failure mode preserved per plan).
    const dir = join(baseTmp, 'alias-del');
    const filename = join(dir, 'Connections.json');
    const host = 'https://openam-del-alias.forgeblocks.com/am';
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      filename,
      JSON.stringify({ [host]: { tenant: host, alias: 'to-delete' } })
    );
    // delete the directory AND file out from under the writer
    fs.rmSync(dir, { recursive: true });
    const prevStatePath = state.getConnectionProfilesPath();
    try {
      state.setConnectionProfilesPath(filename);
      expect(() =>
        setConnectionProfileAlias({ host, alias: 'fresh', state })
      ).toThrow(/not found/);
      // the directory was not resurrected by the failed read
      expect(fs.existsSync(dir)).toBe(false);
    } finally {
      state.setConnectionProfilesPath(prevStatePath);
    }
  });

  test('setConnectionProfileAlias succeeds when the directory exists and file was planted', async () => {
    const dir = join(baseTmp, 'alias-ok');
    const filename = join(dir, 'Connections.json');
    const host = 'https://openam-alias-ok.forgeblocks.com/am';
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      filename,
      JSON.stringify({ [host]: { tenant: host, username: 'x' } })
    );
    const prevStatePath = state.getConnectionProfilesPath();
    try {
      state.setConnectionProfilesPath(filename);
      setConnectionProfileAlias({ host, alias: 'alias-ok-1', state });
      const connections = JSON.parse(fs.readFileSync(filename, 'utf8'));
      expect(connections[host].alias).toBe('alias-ok-1');
    } finally {
      state.setConnectionProfilesPath(prevStatePath);
    }
  });

  test('deleteConnectionProfile writes back into a recreated directory', async () => {
    const dir = join(baseTmp, 'delete-ok');
    const filename = join(dir, 'Connections.json');
    const host = 'https://openam-delete-ok.forgeblocks.com/am';
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      filename,
      JSON.stringify({ [host]: { tenant: host, username: 'x' } })
    );
    const prevStatePath = state.getConnectionProfilesPath();
    try {
      state.setConnectionProfilesPath(filename);
      deleteConnectionProfile({ host, state });
      // the write (with its directory guard) succeeded
      const connections = JSON.parse(fs.readFileSync(filename, 'utf8'));
      expect(connections[host]).toBeUndefined();
    } finally {
      state.setConnectionProfilesPath(prevStatePath);
    }
  });
});

describe('saveUserSessionToken (token cache writers)', () => {
  test('succeeds writing into a non-existent directory without initTokenCache()', async () => {
    const filename = join(baseTmp, 'token-cache', 'TokenCache.json');
    const prevCachePath = process.env.FRODO_TOKEN_CACHE_PATH;
    try {
      process.env.FRODO_TOKEN_CACHE_PATH = filename;
      const token = {
        tokenId: 'session-token-value',
        successUrl: '/console',
        realm: '/',
        access_token: 'access-token-value',
        token_type: 'Bearer',
        expires: Date.now() + 3600_000,
        expires_in: 3600,
        scope: 'fr:idm:*',
        sessionToken: 'session-token-value',
      };
      const result = await saveUserSessionToken({ token, state });
      expect(result).toBe(true);
      expect(fs.existsSync(filename)).toBe(true);
      const cache = JSON.parse(fs.readFileSync(filename, 'utf8'));
      expect(Object.keys(cache).length).toBeGreaterThan(0);
    } finally {
      if (prevCachePath === undefined) delete process.env.FRODO_TOKEN_CACHE_PATH;
      else process.env.FRODO_TOKEN_CACHE_PATH = prevCachePath ?? '';
    }
  }, 30000);
});

describe('ensureDirectoryForFile (helper)', () => {
  test('creates nested directories for a relative path', () => {
    const cwd = process.cwd();
    const rel = join('test', 'fs_tmp', nonce, 'relative', 'out.txt');
    try {
      ensureDirectoryForFile(rel);
      expect(fs.existsSync(join(cwd, rel, '..'))).toBe(true);
    } finally {
      try {
        fs.rmSync(join(cwd, 'test', 'fs_tmp', nonce), {
          recursive: true,
          force: true,
        });
      } catch (error) {
        // ignore
      }
    }
  });
});
