/**
 * Cross-platform permission tests for the credential-file writers
 * (writeSecureFileSync/writeSecureFile/ensureSecureDirectoryForFile/
 * secureExistingFileSync) used to store the master key, connection
 * profiles, and token cache with owner-only permissions.
 *
 * These must pass on every OS frodo ships a binary for (Linux, macOS,
 * Windows), so this file is run by CI on all three. POSIX mode bits
 * (0600/0700) are only meaningful on Linux/macOS: Windows' Node.js `fs`
 * layer emulates just the owner-write bit via the file's read-only
 * attribute and always reports full read/execute bits, so strict mode
 * assertions are skipped there in favor of platform-appropriate checks
 * (the call doesn't throw, content round-trips, the file isn't left
 * read-only). See https://nodejs.org/api/fs.html#file-modes.
 *
 * Run with:
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent ExportImportUtils.secureFile
 */
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { state } from '../index';
import { initConnectionProfiles } from '../ops/ConnectionProfileOps';
import {
  ensureSecureDirectoryForFile,
  secureExistingFileSync,
  writeSecureFile,
  writeSecureFileSync,
} from './ExportImportUtils';

const isWindows = process.platform === 'win32';
const OWNER_ONLY_FILE = 0o600;
const OWNER_ONLY_DIR = 0o700;

function mode(path: string): number {
  return fs.statSync(path).mode & 0o777;
}

/**
 * True if the owner-write bit is set, which is the one POSIX permission
 * bit Windows' fs layer actually emulates (via the read-only attribute).
 */
function isOwnerWritable(path: string): boolean {
  return (fs.statSync(path).mode & 0o200) !== 0;
}

let baseTmp: string;

beforeAll(() => {
  const nonce = `frodo-lib-securefile-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  baseTmp = join(tmpdir(), nonce);
});

afterAll(() => {
  try {
    fs.rmSync(baseTmp, { recursive: true, force: true });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  }
});

describe('ensureSecureDirectoryForFile', () => {
  test('creates a non-existent nested directory', () => {
    const filename = join(baseTmp, 'ensure', 'nested', 'file.txt');
    expect(() => ensureSecureDirectoryForFile(filename)).not.toThrow();
    expect(fs.existsSync(join(baseTmp, 'ensure', 'nested'))).toBe(true);
  });

  (isWindows ? test.skip : test)(
    'creates the directory owner-only (0700) on POSIX',
    () => {
      const filename = join(baseTmp, 'ensure-mode', 'file.txt');
      ensureSecureDirectoryForFile(filename);
      expect(mode(join(baseTmp, 'ensure-mode'))).toBe(OWNER_ONLY_DIR);
    }
  );

  (isWindows ? test.skip : test)(
    'tightens an existing, group/world-readable directory in place',
    () => {
      const dir = join(baseTmp, 'ensure-existing');
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      fs.chmodSync(dir, 0o755);
      expect(mode(dir)).toBe(0o755);
      ensureSecureDirectoryForFile(join(dir, 'file.txt'));
      expect(mode(dir)).toBe(OWNER_ONLY_DIR);
    }
  );
});

describe('writeSecureFileSync', () => {
  test('writes content that round-trips and creates missing parent directories', () => {
    const filename = join(baseTmp, 'write-sync', 'deep', 'Connections.json');
    writeSecureFileSync(filename, JSON.stringify({ key: 'value' }));
    expect(JSON.parse(fs.readFileSync(filename, 'utf8'))).toEqual({
      key: 'value',
    });
  });

  test('leaves the file owner-writable', () => {
    const filename = join(baseTmp, 'write-sync-writable', 'masterkey.key');
    writeSecureFileSync(filename, 'secret-key-material');
    expect(isOwnerWritable(filename)).toBe(true);
  });

  (isWindows ? test.skip : test)(
    'creates a new file owner-only (0600) on POSIX',
    () => {
      const filename = join(baseTmp, 'write-sync-mode', 'masterkey.key');
      writeSecureFileSync(filename, 'secret-key-material');
      expect(mode(filename)).toBe(OWNER_ONLY_FILE);
      expect(mode(join(baseTmp, 'write-sync-mode'))).toBe(OWNER_ONLY_DIR);
    }
  );

  (isWindows ? test.skip : test)(
    'tightens an existing, group/world-readable file when overwritten',
    () => {
      // fs.writeFileSync's `mode` option only applies to file *creation*
      // (open() with O_CREAT); it's silently ignored when truncating an
      // existing file, which is what makes the explicit chmodSync in
      // writeSecureFileSync necessary. This asserts that chmod actually
      // runs, not just that new files come out owner-only.
      const dir = join(baseTmp, 'write-sync-existing');
      const filename = join(dir, 'Connections.json');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filename, '{}', { mode: 0o644 });
      fs.chmodSync(filename, 0o644);
      expect(mode(filename)).toBe(0o644);
      writeSecureFileSync(filename, JSON.stringify({ updated: true }));
      expect(mode(filename)).toBe(OWNER_ONLY_FILE);
      expect(JSON.parse(fs.readFileSync(filename, 'utf8'))).toEqual({
        updated: true,
      });
    }
  );
});

describe('writeSecureFile (async)', () => {
  test('writes content that round-trips and creates missing parent directories', async () => {
    const filename = join(baseTmp, 'write-async', 'deep', 'TokenCache.json');
    await writeSecureFile(filename, JSON.stringify({ key: 'value' }));
    expect(JSON.parse(fs.readFileSync(filename, 'utf8'))).toEqual({
      key: 'value',
    });
  });

  (isWindows ? test.skip : test)(
    'creates a new file owner-only (0600) on POSIX',
    async () => {
      const filename = join(baseTmp, 'write-async-mode', 'masterkey.key');
      await writeSecureFile(filename, 'secret-key-material');
      expect(mode(filename)).toBe(OWNER_ONLY_FILE);
    }
  );

  (isWindows ? test.skip : test)(
    'tightens an existing, group/world-readable file when overwritten',
    async () => {
      const dir = join(baseTmp, 'write-async-existing');
      const filename = join(dir, 'masterkey.key');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filename, 'old-key', { mode: 0o644 });
      fs.chmodSync(filename, 0o644);
      await writeSecureFile(filename, 'new-key');
      expect(mode(filename)).toBe(OWNER_ONLY_FILE);
      expect(fs.readFileSync(filename, 'utf8')).toBe('new-key');
    }
  );
});

describe('secureExistingFileSync', () => {
  (isWindows ? test.skip : test)(
    'tightens an existing file and its directory without touching content',
    () => {
      const dir = join(baseTmp, 'secure-existing');
      const filename = join(dir, 'masterkey.key');
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      fs.chmodSync(dir, 0o755);
      fs.writeFileSync(filename, 'unchanged-key', { mode: 0o644 });
      fs.chmodSync(filename, 0o644);
      secureExistingFileSync(filename);
      expect(mode(dir)).toBe(OWNER_ONLY_DIR);
      expect(mode(filename)).toBe(OWNER_ONLY_FILE);
      expect(fs.readFileSync(filename, 'utf8')).toBe('unchanged-key');
    }
  );

  test('is a silent no-op (does not throw) when the file does not exist', () => {
    const filename = join(baseTmp, 'secure-missing', 'nope.key');
    expect(() => secureExistingFileSync(filename)).not.toThrow();
    expect(fs.existsSync(filename)).toBe(false);
  });
});

describe('initConnectionProfiles (end-to-end self-heal)', () => {
  (isWindows ? test.skip : test)(
    'tightens an already-migrated profiles file and the master key on every call, not just when converting legacy secrets',
    async () => {
      // The common case for an existing install: Connections.json already
      // has no plaintext secrets to convert, so the encrypt()/decrypt()
      // calls that would otherwise self-heal the master key never run.
      // initConnectionProfiles must still tighten both files on every
      // invocation -- this is what lets "just run any frodo command" (no
      // manual chmod) actually hold.
      const dir = join(baseTmp, 'init-profiles-self-heal');
      const profilesPath = join(dir, 'Connections.json');
      const masterKeyPath = join(dir, 'masterkey.key');
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      fs.chmodSync(dir, 0o755);
      fs.writeFileSync(profilesPath, '{}', { mode: 0o644 });
      fs.chmodSync(profilesPath, 0o644);
      fs.writeFileSync(masterKeyPath, 'pre-existing-key-material', {
        mode: 0o644,
      });
      fs.chmodSync(masterKeyPath, 0o644);

      const prevProfilesPath = state.getConnectionProfilesPath();
      const prevMasterKeyPath = state.getMasterKeyPath();
      try {
        state.setConnectionProfilesPath(profilesPath);
        state.setMasterKeyPath(masterKeyPath);
        await initConnectionProfiles({ state });

        expect(mode(profilesPath)).toBe(OWNER_ONLY_FILE);
        expect(mode(masterKeyPath)).toBe(OWNER_ONLY_FILE);
        // content untouched: still no connections, still the same key
        expect(fs.readFileSync(profilesPath, 'utf8')).toBe('{}');
        expect(fs.readFileSync(masterKeyPath, 'utf8')).toBe(
          'pre-existing-key-material'
        );
      } finally {
        state.setConnectionProfilesPath(prevProfilesPath);
        state.setMasterKeyPath(prevMasterKeyPath);
      }
    }
  );
});
