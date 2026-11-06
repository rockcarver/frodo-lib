/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent TokenCacheOps.entries
 *
 * The token cache keeps one file per entry. These tests pin what makes that
 * safe for several processes: a write replaces one file atomically, a cache
 * hit never writes, an older token never replaces a newer one, an unreadable
 * entry is a miss that the next login replaces, and starting up or flushing
 * touches no shared file. Real file I/O against a scratch directory (not
 * mocked), same convention as TokenCacheOps.sessionManagement.unit.test.ts.
 */
import fs from 'fs';
import { join, resolve } from 'path';
import StateImpl from '../shared/State';
import {
  deleteHostTokens,
  evictToken,
  flush,
  getTokenCacheDir,
  hasFreshTokenEntry,
  hasToken,
  initTokenCache,
  listCachedSessions,
  purge,
  readToken,
  saveToken,
} from './TokenCacheOps';

const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'TokenCacheOps.entries');
const HOST = 'https://openam-entries.example.com/am';

function stateFor({
  cachePath,
  host = HOST,
  username = 'someone',
  password = 'password',
}: {
  cachePath: string;
  host?: string;
  username?: string;
  password?: string;
}) {
  const state = StateImpl({ host });
  state.setTokenCachePath(cachePath);
  state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  state.setUsername(username);
  state.setPassword(password);
  return state;
}

function newCachePath(): string {
  return resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
}

function session(expires: number, tokenId = 'secret-session-value') {
  return { tokenId, successUrl: '', realm: '/', expires } as any;
}

function entryFiles(cachePath: string): string[] {
  const directory = getTokenCacheDir({ state: stateFor({ cachePath }) });
  return fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((name) => name.endsWith('.json'))
    : [];
}

/** Content and modification time of every file of the cache directory. */
function snapshot(cachePath: string): Record<string, string> {
  const directory = getTokenCacheDir({ state: stateFor({ cachePath }) });
  const result: Record<string, string> = {};
  for (const name of fs.readdirSync(directory)) {
    const file = join(directory, name);
    result[name] =
      `${fs.statSync(file).mtimeMs}:${fs.readFileSync(file, 'utf8')}`;
  }
  return result;
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('token cache: one file per entry', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test('1: entries live in a directory named like the cache file without its extension, one file each, and the legacy file is not written', async () => {
    const cachePath = newCachePath();
    const a = stateFor({ cachePath, username: 'a' });
    const b = stateFor({ cachePath, username: 'b' });
    const otherHost = stateFor({
      cachePath,
      host: 'https://openam-entries-other.example.com/am',
    });
    for (const state of [a, b, otherHost]) {
      await saveToken({
        tokenType: 'userSession',
        token: session(Date.now() + 600_000),
        state,
      });
    }
    await saveToken({
      tokenType: 'userBearer',
      token: { access_token: 'x', expires: Date.now() + 600_000 } as any,
      state: a,
    });

    expect(getTokenCacheDir({ state: a })).toBe(cachePath.replace('.json', ''));
    expect(entryFiles(cachePath)).toHaveLength(4);
    expect(fs.existsSync(cachePath)).toBe(false);
    expect(fs.existsSync(resolve(TMP_DIR, 'TokenCacheHosts.json'))).toBe(false);
    expect(fs.existsSync(resolve(TMP_DIR, 'TokenCacheSubjects.json'))).toBe(
      false
    );
  });

  test('2: a cache path without an extension gets a directory with .d appended', () => {
    const state = StateImpl({ host: HOST });
    state.setTokenCachePath(resolve(TMP_DIR, 'cache-without-extension'));
    expect(getTokenCacheDir({ state })).toBe(
      resolve(TMP_DIR, 'cache-without-extension.d')
    );
  });

  test('3: an entry holds the plain fields a listing needs and the token only encrypted', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    const expires = Date.now() + 600_000;
    await saveToken({
      tokenType: 'userSession',
      token: session(expires),
      subject: 'someone',
      state,
    });
    const [name] = entryFiles(cachePath);
    const raw = fs.readFileSync(
      join(getTokenCacheDir({ state }), name),
      'utf8'
    );
    const entry = JSON.parse(raw);
    expect(entry).toMatchObject({
      host: HOST,
      realm: '/',
      type: 'userSession',
      subject: 'someone',
      expires,
    });
    expect(raw).not.toContain('secret-session-value');
    expect(await readToken({ tokenType: 'userSession', state })).toMatchObject({
      tokenId: 'secret-session-value',
    });
  });

  test('4: the directory and the entry files are owner-only', async () => {
    if (process.platform === 'win32') return;
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000),
      state,
    });
    const directory = getTokenCacheDir({ state });
    expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
    for (const name of entryFiles(cachePath)) {
      expect(fs.statSync(join(directory, name)).mode & 0o777).toBe(0o600);
    }
  });

  test('5: a cache hit writes nothing: reading, checking and saving the same token again leave the directory as it was', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    const token = session(Date.now() + 600_000);
    await saveToken({ tokenType: 'userSession', token, state });
    const before = snapshot(cachePath);
    await wait(25);

    expect(await hasToken({ tokenType: 'userSession', state })).toBe(true);
    expect(hasFreshTokenEntry({ tokenType: 'userSession', state })).toBe(true);
    const hit = await readToken({ tokenType: 'userSession', state });
    await saveToken({
      tokenType: 'userSession',
      token: { ...hit, from_cache: true } as any,
      state,
    });

    expect(snapshot(cachePath)).toEqual(before);
  });

  test('6: a token that expires later replaces the entry, one that expires earlier does not', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    const now = Date.now();
    await saveToken({
      tokenType: 'userSession',
      token: session(now + 300_000, 'middle'),
      state,
    });
    await saveToken({
      tokenType: 'userSession',
      token: session(now + 900_000, 'latest'),
      state,
    });
    await saveToken({
      tokenType: 'userSession',
      token: session(now + 100_000, 'earlier'),
      state,
    });

    expect(entryFiles(cachePath)).toHaveLength(1);
    expect(await readToken({ tokenType: 'userSession', state })).toMatchObject({
      tokenId: 'latest',
    });
  });

  test('7: an entry that cannot be read with the current credential is replaced even when it expires later', async () => {
    const cachePath = newCachePath();
    const now = Date.now();
    await saveToken({
      tokenType: 'userSession',
      token: session(now + 900_000, 'old-password-session'),
      state: stateFor({ cachePath, password: 'one' }),
    });
    const changed = stateFor({ cachePath, password: 'two' });
    // the stored session is not readable with the new password: a miss
    await expect(
      readToken({ tokenType: 'userSession', state: changed })
    ).rejects.toThrow();

    await saveToken({
      tokenType: 'userSession',
      token: session(now + 100_000, 'new-password-session'),
      state: changed,
    });
    expect(
      await readToken({ tokenType: 'userSession', state: changed })
    ).toMatchObject({ tokenId: 'new-password-session' });
  });

  test('8: an unreadable entry file is a miss, and the next save replaces it', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000),
      state,
    });
    const [name] = entryFiles(cachePath);
    const file = join(getTokenCacheDir({ state }), name);
    fs.writeFileSync(file, '{"expires": 17'); // cut off in the middle

    expect(hasFreshTokenEntry({ tokenType: 'userSession', state })).toBe(false);
    expect(await hasToken({ tokenType: 'userSession', state })).toBe(false);
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000, 'after-corruption'),
      state,
    });
    expect(await readToken({ tokenType: 'userSession', state })).toMatchObject({
      tokenId: 'after-corruption',
    });
  });

  test('9: a token that is about to expire is a miss', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 5_000),
      state,
    });
    expect(hasFreshTokenEntry({ tokenType: 'userSession', state })).toBe(false);
    expect(await hasToken({ tokenType: 'userSession', state })).toBe(false);
  });

  test('10: a token without a usable expiry is not cached', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    const saved = await saveToken({
      tokenType: 'userSession',
      token: session(NaN),
      state,
    });
    expect(saved).toBe(false);
    expect(entryFiles(cachePath)).toEqual([]);
  });

  test('11: initTokenCache creates the directory, removes expired and unreadable entries, stale temporary files and the legacy files, and keeps the rest', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000),
      state,
    });
    const other = stateFor({ cachePath, username: 'expired' });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() - 3_600_000),
      state: other,
    });
    const directory = getTokenCacheDir({ state });
    const garbage = join(directory, 'a.b.c.d.json');
    fs.writeFileSync(garbage, 'not json');
    const stale = join(directory, 'x.json.1.abc.tmp');
    const fresh = join(directory, 'y.json.2.def.tmp');
    fs.writeFileSync(stale, '{}');
    fs.writeFileSync(fresh, '{}');
    const tenMinutesAgo = new Date(Date.now() - 600_000);
    fs.utimesSync(stale, tenMinutesAgo, tenMinutesAgo);
    fs.writeFileSync(cachePath, '{}');
    fs.writeFileSync(resolve(TMP_DIR, 'TokenCacheHosts.json'), '{}');

    initTokenCache({ state });

    expect(entryFiles(cachePath)).toHaveLength(1);
    expect(fs.existsSync(garbage)).toBe(false);
    expect(fs.existsSync(stale)).toBe(false);
    // a temporary file that young may belong to a write in progress
    expect(fs.existsSync(fresh)).toBe(true);
    expect(fs.existsSync(cachePath)).toBe(false);
    expect(fs.existsSync(resolve(TMP_DIR, 'TokenCacheHosts.json'))).toBe(false);
  });

  test('12: initTokenCache on a fresh path creates the directory and nothing else', () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    initTokenCache({ state });
    expect(fs.readdirSync(getTokenCacheDir({ state }))).toEqual([]);
    expect(fs.existsSync(cachePath)).toBe(false);
  });

  test('13: flush removes every entry and temporary file, and keeps the directory', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000),
      state,
    });
    const directory = getTokenCacheDir({ state });
    fs.writeFileSync(join(directory, 'z.json.1.abc.tmp'), '{}');

    expect(flush({ state })).toBe(true);
    expect(fs.readdirSync(directory)).toEqual([]);
    expect(listCachedSessions({ state })).toEqual([]);
  });

  test('14: flush on a cache that does not exist is a success', () => {
    expect(flush({ state: stateFor({ cachePath: newCachePath() }) })).toBe(
      true
    );
  });

  test('15: purge keeps what is live and reports it', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000),
      state,
    });
    const remaining = purge({ state });
    expect(Object.keys(remaining)).toHaveLength(1);
    expect(entryFiles(cachePath)).toHaveLength(1);
  });

  test('16: deleteHostTokens removes the entries of a host, or only those of one realm', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000),
      state,
    });
    expect(deleteHostTokens({ host: HOST, realm: '/alpha', state })).toBe(
      false
    );
    expect(entryFiles(cachePath)).toHaveLength(1);
    expect(deleteHostTokens({ host: HOST, realm: '/', state })).toBe(true);
    expect(entryFiles(cachePath)).toHaveLength(0);
  });

  test('17: two identities on one host have entries of their own', async () => {
    const cachePath = newCachePath();
    const a = stateFor({ cachePath, username: 'a' });
    const b = stateFor({ cachePath, username: 'b' });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000, 'for-a'),
      state: a,
    });
    await saveToken({
      tokenType: 'userSession',
      token: session(Date.now() + 600_000, 'for-b'),
      state: b,
    });
    expect(
      await readToken({ tokenType: 'userSession', state: a })
    ).toMatchObject({ tokenId: 'for-a' });
    expect(
      await readToken({ tokenType: 'userSession', state: b })
    ).toMatchObject({ tokenId: 'for-b' });
  });

  test('18: evictToken removes an entry that holds the rejected token and leaves one that holds a newer token', async () => {
    const cachePath = newCachePath();
    const state = stateFor({ cachePath });
    const expires = Date.now() + 600_000;
    await saveToken({
      tokenType: 'userSession',
      token: session(expires),
      state,
    });

    // another process has replaced it: the rejected token is not in the cache
    expect(
      evictToken({ tokenType: 'userSession', expires: expires - 1000, state })
    ).toBe(false);
    expect(entryFiles(cachePath)).toHaveLength(1);

    expect(evictToken({ tokenType: 'userSession', expires, state })).toBe(true);
    expect(entryFiles(cachePath)).toHaveLength(0);
    // nothing left to remove
    expect(evictToken({ tokenType: 'userSession', expires, state })).toBe(
      false
    );
  });

  test('19: evictToken does not touch the entry of another identity or another type', async () => {
    const cachePath = newCachePath();
    const a = stateFor({ cachePath, username: 'a' });
    const b = stateFor({ cachePath, username: 'b' });
    const expires = Date.now() + 600_000;
    await saveToken({
      tokenType: 'userSession',
      token: session(expires),
      state: a,
    });
    await saveToken({
      tokenType: 'userSession',
      token: session(expires),
      state: b,
    });
    await saveToken({
      tokenType: 'userBearer',
      token: { access_token: 'x', expires } as any,
      state: a,
    });

    expect(evictToken({ tokenType: 'userSession', expires, state: a })).toBe(
      true
    );
    expect(entryFiles(cachePath)).toHaveLength(2);
    expect(await hasToken({ tokenType: 'userSession', state: b })).toBe(true);
    expect(await hasToken({ tokenType: 'userBearer', state: a })).toBe(true);
  });
});
