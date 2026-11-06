/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent TokenCacheOps.sessionManagement
 *
 * Regression coverage for the Phase F session-lifecycle addendum's
 * `listCachedSessions()`/`deleteHostTokens()` primitives (powering
 * `frodo session list`/`describe`/`delete`). Every key in an entry file name is
 * a one-way uuidv5 hash, so `listCachedSessions()` reads the host, realm and
 * subject from the plain fields of the entry itself.
 * Real, isolated file I/O against a scratch directory (not mocked), same
 * convention as TokenCacheOps.browserToken.unit.test.ts.
 */
import fs from 'fs';
import { resolve } from 'path';
import { v5 as uuidv5 } from 'uuid';
import StateImpl from '../shared/State';
import {
  deleteHostTokens,
  getRecordedSubject,
  listCachedSessions,
  purge,
  saveToken,
  type tokenType,
} from './TokenCacheOps';

// Mirrors TokenCacheOps.ts's own uuidv5 namespace/key derivation, so these
// tests can write an entry file with the exact real, hashed name directly —
// needed to reproduce a corrupted entry, which no exported function would
// ever itself write.
const UUIDV5_NAMESPACE = 'e9a38338-21c0-4dcd-ba74-7ddeac58edbe';

/** The directory of the entry files of a cache file path. */
function entryDirectory(cachePath: string): string {
  return cachePath.replace(/\.json$/, '');
}

function writeCorruptedEntry(
  cachePath: string,
  host: string,
  content: string,
  subject = 'someuser'
): string {
  const hostKey = uuidv5(host, uuidv5.URL);
  const realmKey = uuidv5('/', UUIDV5_NAMESPACE);
  const typeKey = uuidv5('userSession', UUIDV5_NAMESPACE);
  const subjectKey = uuidv5(subject, UUIDV5_NAMESPACE);
  const directory = entryDirectory(cachePath);
  fs.mkdirSync(directory, { recursive: true });
  const file = resolve(
    directory,
    `${hostKey}.${realmKey}.${typeKey}.${subjectKey}.json`
  );
  fs.writeFileSync(file, content);
  return file;
}

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'TokenCacheOps.sessionManagement'
);

function freshState(host: string, cachePath: string) {
  const state = StateImpl({ host });
  state.setTokenCachePath(cachePath);
  state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  return state;
}

function fakeAccessTokenJwtWithSub(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe('listCachedSessions / deleteHostTokens', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test('1: lists a browser-login session with its host read from the entry', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const host = 'https://openam-list-a.example.com/am';
    const state = freshState(host, cachePath);
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('jdoe'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      state,
    });

    const sessions = listCachedSessions({ state });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      host,
      realm: '/',
      tokenType: 'browserUserBearer',
      subject: 'browser-login',
      isExpired: false,
    });
  });

  test('2: lists sessions across multiple hosts sharing one cache, each resolved to its own host', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const hostA = 'https://openam-list-b.example.com/am';
    const hostB = 'https://openam-list-c.example.com/am';
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('a'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      state: freshState(hostA, cachePath),
    });
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('b'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      state: freshState(hostB, cachePath),
    });

    const sessions = listCachedSessions({
      state: freshState(hostA, cachePath),
    });
    expect(sessions.map((s) => s.host).sort()).toEqual([hostA, hostB].sort());
  });

  test('3: deleteHostTokens removes only the named host, leaving other hosts intact', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const hostA = 'https://openam-delete-a.example.com/am';
    const hostB = 'https://openam-delete-b.example.com/am';
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('a'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      state: freshState(hostA, cachePath),
    });
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('b'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      state: freshState(hostB, cachePath),
    });

    const stateA = freshState(hostA, cachePath);
    const deleted = deleteHostTokens({ host: hostA, state: stateA });
    expect(deleted).toBe(true);

    const remaining = listCachedSessions({ state: stateA });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].host).toBe(hostB);
  });

  test('4: deleteHostTokens returns false when there is nothing to delete for that host', () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const state = freshState(
      'https://openam-never-logged-in.example.com/am',
      cachePath
    );
    const deleted = deleteHostTokens({
      host: 'https://openam-never-logged-in.example.com/am',
      state,
    });
    expect(deleted).toBe(false);
  });

  test('5: an empty or nonexistent cache lists as no sessions', () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const state = freshState('https://openam-empty.example.com/am', cachePath);
    expect(listCachedSessions({ state })).toEqual([]);
  });

  test('6: an unreadable entry is not listed and does not break the listing of the others', async () => {
    // Regression: a real, observed cache file had a literal "NaN" string as
    // an exp key, which made `frodo session list` crash. An entry that cannot
    // be read (an invalid expiry, a truncated file) is now simply not an
    // entry: it is skipped, and the entries next to it still list.
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const host = 'https://openam-corrupt.example.com/am';
    writeCorruptedEntry(
      cachePath,
      host,
      JSON.stringify({ version: 1, expires: 'NaN', token: 'y' })
    );
    writeCorruptedEntry(cachePath, host, '{"expires": 17', 'another');
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('c'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      state: freshState(host, cachePath),
    });

    const sessions = listCachedSessions({ state: freshState(host, cachePath) });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenType).toBe('browserUserBearer');
  });

  test('7: purge removes unreadable and expired entries and the legacy files, and keeps the live ones', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const corruptHost = 'https://openam-purge-corrupt.example.com/am';
    const corruptFile = writeCorruptedEntry(
      cachePath,
      corruptHost,
      JSON.stringify({ version: 1, expires: 'NaN', token: 'y' })
    );
    const expiredFile = writeCorruptedEntry(
      cachePath,
      corruptHost,
      JSON.stringify({
        version: 1,
        expires: Date.now() - 3_600_000,
        token: 'y',
      }),
      'expired'
    );
    // what an older frodo wrote: one file plus two side indexes
    fs.writeFileSync(cachePath, '{}');
    fs.writeFileSync(resolve(TMP_DIR, 'TokenCacheHosts.json'), '{}');
    fs.writeFileSync(resolve(TMP_DIR, 'TokenCacheSubjects.json'), '{}');

    const otherHost = 'https://openam-purge-other.example.com/am';
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('c'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      state: freshState(otherHost, cachePath),
    });

    const remaining = purge({ state: freshState(otherHost, cachePath) });
    expect(fs.existsSync(corruptFile)).toBe(false);
    expect(fs.existsSync(expiredFile)).toBe(false);
    expect(fs.existsSync(cachePath)).toBe(false);
    expect(fs.existsSync(resolve(TMP_DIR, 'TokenCacheHosts.json'))).toBe(false);
    expect(fs.existsSync(resolve(TMP_DIR, 'TokenCacheSubjects.json'))).toBe(
      false
    );
    expect(Object.keys(remaining)).toHaveLength(1);
    const sessions = listCachedSessions({
      state: freshState(otherHost, cachePath),
    });
    expect(sessions.map((s) => s.host)).toEqual([otherHost]);
  });

  test('8: a browser-login session saved with a resolved subject shows that subject, not the generic "browser-login" placeholder', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const host = 'https://openam-list-subject.example.com/am';
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub(
          '63dce142-2ade-4311-a43f-165d8705c236'
        ),
        token_type: 'Bearer',
        scope: 'fr:am:* fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      subject: 'jdoe',
      state: freshState(host, cachePath),
    });

    const sessions = listCachedSessions({ state: freshState(host, cachePath) });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].subject).toBe('jdoe');
    expect(
      getRecordedSubject({
        tokenType: 'browserUserBearer' as tokenType,
        state: freshState(host, cachePath),
      })
    ).toBe('jdoe');
  });

  test('9: two different token types for the same host get independent subject entries — one never overwrites or leaks into the other', async () => {
    // Regression: the subject index used to be keyed by host alone, so a
    // browser-login session (a real username from session-capture) and a
    // service-account bearer token (a different identity) hitting the same
    // host would silently clobber each other's entry — whichever saved
    // last would incorrectly appear as the subject for *both* rows in
    // `session list`.
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const host = 'https://openam-independent-subjects.example.com/am';
    await saveToken({
      tokenType: 'browserUserSession' as tokenType,
      token: {
        tokenId: 'AQIC1',
        successUrl: '',
        realm: '/',
        expires: Date.now() + 1_800_000,
        from_cache: false,
      } as any,
      subject: 'jdoe',
      state: freshState(host, cachePath),
    });
    const saState = freshState(host, cachePath);
    saState.setServiceAccountId('svc-account-uuid');
    saState.setServiceAccountJwk({ kid: 'test-key' } as any);
    await saveToken({
      tokenType: 'saBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('svc-account-uuid'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      subject: 'my-service-account',
      state: saState,
    });

    expect(
      getRecordedSubject({
        tokenType: 'browserUserSession' as tokenType,
        state: freshState(host, cachePath),
      })
    ).toBe('jdoe');
    expect(
      getRecordedSubject({
        tokenType: 'saBearer' as tokenType,
        state: freshState(host, cachePath),
      })
    ).toBe('my-service-account');

    const sessions = listCachedSessions({ state: freshState(host, cachePath) });
    expect(sessions).toHaveLength(2);
    expect(
      sessions.find((s) => s.tokenType === 'browserUserSession')?.subject
    ).toBe('jdoe');
    expect(sessions.find((s) => s.tokenType === 'saBearer')?.subject).toBe(
      'my-service-account'
    );
  });

  test('10: a save with no subject leaves a previously-recorded one for that same type intact, rather than clobbering it with nothing', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const host = 'https://openam-preserve-subject.example.com/am';
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('jdoe'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000,
      } as any,
      subject: 'jdoe',
      state: freshState(host, cachePath),
    });
    // A refresh-triggered re-save with no subject (e.g. the JWT sub claim
    // wasn't decodable this time) must not erase the username the earlier
    // save for the same host and token type already recorded.
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('jdoe'),
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 1800,
        expires: Date.now() + 1_800_000 + 1000,
      } as any,
      state: freshState(host, cachePath),
    });

    expect(
      getRecordedSubject({
        tokenType: 'browserUserBearer' as tokenType,
        state: freshState(host, cachePath),
      })
    ).toBe('jdoe');
  });
});
