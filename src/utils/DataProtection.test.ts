import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { jest } from '@jest/globals';

import Constants from '../shared/Constants';
import StateImpl from '../shared/State';

/**
 * Unit tests for DataProtection's master-key bootstrap.
 *
 * Run with:
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent DataProtection
 *
 * The bootstrap generates+persists a master key when none exists
 * (no FRODO_MASTER_KEY env var, no key file at FRODO_MASTER_KEY_PATH or the
 * default ~/.frodo/masterkey.key). It must create the key file's directory
 * (bare consumers point FRODO_MASTER_KEY_PATH into non-existent trees) and
 * must FAIL loudly when it cannot persist the key instead of silently
 * degrading to encryption under scrypt('', salt, 32).
 */

const savedMasterKey = process.env[Constants.FRODO_MASTER_KEY_KEY];
const savedMasterKeyPath = process.env[Constants.FRODO_MASTER_KEY_PATH_KEY];

// jest's ESM VM does not propagate process.env.HOME changes to os.homedir()
// (libuv reads the real process env), so the default-path cell (below)
// redirects getFrodoHome() into a temp tree via unstable_mockModule instead.
// The mock must be registered before ./DataProtection is first imported, so
// the import here is dynamic and the registration sits above it. The mock
// only affects getFrodoHome()'s default (~/.frodo) path — every other cell
// sets FRODO_MASTER_KEY_PATH, which takes precedence over it, so the mock is
// inert there; the developer's real ~/.frodo is never touched either way.
const dataprotectionTmpBase = join(
  tmpdir(),
  `frodo-lib-dataprotection-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
);
const mockedFrodoHome = join(dataprotectionTmpBase, 'fakehome', '.frodo');
const getFrodoHomeMock = jest.fn(() => mockedFrodoHome);
jest.unstable_mockModule('./FrodoUtils', () => ({
  default: () => ({ getFrodoHome: () => getFrodoHomeMock() }),
  getFrodoHome: getFrodoHomeMock,
}));
const { default: DataProtection } = await import('./DataProtection');

function cleanupEnv() {
  if (savedMasterKey === undefined)
    delete process.env[Constants.FRODO_MASTER_KEY_KEY];
  else process.env[Constants.FRODO_MASTER_KEY_KEY] = savedMasterKey;
  if (savedMasterKeyPath === undefined)
    delete process.env[Constants.FRODO_MASTER_KEY_PATH_KEY];
  else process.env[Constants.FRODO_MASTER_KEY_PATH_KEY] = savedMasterKeyPath;
}

afterEach(() => {
  cleanupEnv();
});

afterAll(() => {
  try {
    fs.rmSync(dataprotectionTmpBase, { recursive: true, force: true });
  } catch (error) {
    // ignore
  }
});

describe('DataProtection master-key bootstrap', () => {
  test('generates a real key into a non-existent nested directory and round-trips', async () => {
    const masterKeyPath = join(
      dataprotectionTmpBase,
      'deep',
      'nested',
      'master.key'
    );
    process.env[Constants.FRODO_MASTER_KEY_PATH_KEY] = masterKeyPath;
    delete process.env[Constants.FRODO_MASTER_KEY_KEY];

    const dp = new DataProtection({ state: StateImpl({}) });
    const secret = 'One ring to rule them all.';
    const encrypted = await dp.encrypt(secret);

    // bootstrap created the directory and wrote a non-empty key file
    expect(fs.existsSync(masterKeyPath)).toBe(true);
    const persistedKey = fs.readFileSync(masterKeyPath, 'utf8');
    expect(persistedKey.length).toBeGreaterThan(0);
    // 32 random bytes base64-encoded
    expect(persistedKey).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

    // encryption used that real key: round-trip through a second instance
    // (which loads the same persisted key) succeeds
    const dp2 = new DataProtection({ state: StateImpl({}) });
    expect(await dp2.decrypt(encrypted)).toBe(secret);
    // ...and through the same instance
    expect(await dp.decrypt(encrypted)).toBe(secret);
  }, 30000);

  test('bootstrap failure (blocked path) throws instead of silently encrypting under an empty key', async () => {
    // a parent path component is a file -> mkdir cannot create the key dir
    const blockingFile = join(dataprotectionTmpBase, 'blocking-file');
    fs.writeFileSync(blockingFile, 'not a directory');
    const masterKeyPath = join(blockingFile, 'sub', 'master.key');
    process.env[Constants.FRODO_MASTER_KEY_PATH_KEY] = masterKeyPath;
    delete process.env[Constants.FRODO_MASTER_KEY_KEY];

    const dp = new DataProtection({ state: StateImpl({}) });

    // encrypt() surfaces the bootstrap failure (pre-fix it swallowed the
    // ENOENT and encrypted under scrypt('', salt, 32))
    await expect(dp.encrypt('anything')).rejects.toThrow(
      /master\.key|not a directory|directory/i
    );
    // no key file and no encrypted output were persisted
    expect(fs.existsSync(masterKeyPath)).toBe(false);
  }, 30000);

  test('loads a pre-existing master key file and round-trips with it', async () => {
    const masterKeyPath = join(
      dataprotectionTmpBase,
      'pre-existing',
      'master.key'
    );
    fs.mkdirSync(join(dataprotectionTmpBase, 'pre-existing'), {
      recursive: true,
    });
    const existingKey = 'bxnQlhcU5VfyDs+BBPhRhK09yHaNtdIIk85HUMKBnqg=';
    fs.writeFileSync(masterKeyPath, existingKey);
    process.env[Constants.FRODO_MASTER_KEY_PATH_KEY] = masterKeyPath;
    delete process.env[Constants.FRODO_MASTER_KEY_KEY];

    const dp = new DataProtection({ state: StateImpl({}) });
    const secret = 'The road goes ever on and on.';
    const encrypted = await dp.encrypt(secret);

    // the pre-existing key file was loaded, not overwritten
    expect(fs.readFileSync(masterKeyPath, 'utf8')).toBe(existingKey);
    // and the round-trip works with it
    expect(await dp.decrypt(encrypted)).toBe(secret);
  });

  test('FRODO_MASTER_KEY env var takes precedence and no key file is touched', async () => {
    const masterKeyPath = join(dataprotectionTmpBase, 'env-key', 'master.key');
    process.env[Constants.FRODO_MASTER_KEY_PATH_KEY] = masterKeyPath;
    process.env[Constants.FRODO_MASTER_KEY_KEY] =
      'bxnQlhcU5VfyDs+BBPhRhK09yHaNtdIIk85HUMKBnqg=';

    const dp = new DataProtection({ state: StateImpl({}) });
    const secret = 'Not all those who wander are lost.';
    const encrypted = await dp.encrypt(secret);

    // the env key was used; no key file was created
    expect(fs.existsSync(masterKeyPath)).toBe(false);
    expect(await dp.decrypt(encrypted)).toBe(secret);
  });

  test('default path (no FRODO_MASTER_KEY_PATH) bootstraps the redirected frodo home', async () => {
    // With FRODO_MASTER_KEY_PATH unset, the bootstrap falls back to
    // getFrodoHome()/masterkey.key (mocked above into the temp tree). It must
    // create the frodo home directory and write a real key, exactly like a
    // first-ever frodo run, and the round-trip must work with that key.
    delete process.env[Constants.FRODO_MASTER_KEY_PATH_KEY];
    delete process.env[Constants.FRODO_MASTER_KEY_KEY];
    const defaultKeyPath = join(mockedFrodoHome, 'masterkey.key');
    expect(fs.existsSync(defaultKeyPath)).toBe(false);

    const dp = new DataProtection({ state: StateImpl({}) });
    const secret = 'I would rather share one lifetime with you.';
    const encrypted = await dp.encrypt(secret);
    const decrypted = await dp.decrypt(encrypted);

    // the default-path bootstrap created the key file with a real key and
    // round-trips with it
    expect(fs.existsSync(defaultKeyPath)).toBe(true);
    expect(fs.readFileSync(defaultKeyPath, 'utf8').length).toBeGreaterThan(0);
    expect(decrypted).toBe(secret);
  }, 30000);
});
