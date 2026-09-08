/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent TokenCacheOps.sessionManagement
 *
 * Regression coverage for the Phase F session-lifecycle addendum's
 * `listCachedSessions()`/`deleteHostTokens()` primitives (powering
 * `frodo session list`/`describe`/`delete`). Every hostKey/realmKey/typeKey/
 * subjectKey in TokenCacheInterface is a one-way uuidv5 hash with no stored
 * reverse mapping, so `listCachedSessions()` depends on the small
 * `TokenCacheHosts.json` side index this file also exercises directly.
 * Real, isolated file I/O against a scratch directory (not mocked), same
 * convention as TokenCacheOps.browserToken.unit.test.ts.
 */
import fs from 'fs';
import { resolve } from 'path';
import { v5 as uuidv5 } from 'uuid';

import {
  deleteHostTokens,
  getRecordedSubject,
  listCachedSessions,
  saveToken,
  type tokenType,
} from './TokenCacheOps';
import StateImpl from '../shared/State';

// Mirrors TokenCacheOps.ts's own uuidv5 namespace/key derivation, so these
// tests can write a cache file with the exact real, hashed key shape
// directly — needed to reproduce a corrupted entry (an unparseable "NaN"
// exp key), which no exported function would ever itself write.
const UUIDV5_NAMESPACE = 'e9a38338-21c0-4dcd-ba74-7ddeac58edbe';

function writeCorruptedCacheFile(cachePath: string, host: string): void {
  const hostKey = uuidv5(host, uuidv5.URL);
  const realmKey = uuidv5('/', UUIDV5_NAMESPACE);
  const typeKey = uuidv5('userSession', UUIDV5_NAMESPACE);
  const subjectKey = uuidv5('someuser', UUIDV5_NAMESPACE);
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      [hostKey]: {
        [realmKey]: {
          [typeKey]: {
            [subjectKey]: {
              NaN: { checksum: 'x', token: 'y' },
            },
          },
        },
      },
    })
  );
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

  test('1: lists a browser-login session with its host resolved via the side index', async () => {
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

  test('2: lists sessions across multiple hosts sharing one cache file, each resolved to its own host', async () => {
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
    const state = freshState('https://openam-never-logged-in.example.com/am', cachePath);
    const deleted = deleteHostTokens({
      host: 'https://openam-never-logged-in.example.com/am',
      state,
    });
    expect(deleted).toBe(false);
  });

  test('5: an empty/nonexistent cache file lists as no sessions', () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const state = freshState('https://openam-empty.example.com/am', cachePath);
    expect(listCachedSessions({ state })).toEqual([]);
  });

  test('6: a corrupted entry with an unparseable exp key reports isExpired: true, not false', () => {
    // Regression: a real, observed cache file had a literal "NaN" string as
    // an exp key (from an old, since-fixed bug elsewhere writing an invalid
    // expires value). `now > NaN` is always false, so the naive computation
    // reported isExpired: false — a corrupted entry masquerading as a
    // permanently valid session, and the reason `frodo session list` used
    // to crash entirely (`new Date(NaN).toISOString()` throws) instead of
    // just treating that one entry as expired.
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const host = 'https://openam-corrupt.example.com/am';
    writeCorruptedCacheFile(cachePath, host);

    const sessions = listCachedSessions({ state: freshState(host, cachePath) });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].isExpired).toBe(true);
    expect(Number.isNaN(sessions[0].expires)).toBe(true);
  });

  test('7: a save purges a corrupted, unparseable-exp entry the same as a genuinely expired one', async () => {
    // Regression: purgeExpiredTokens() had the identical `now > NaN` bug,
    // so a corrupted entry was never purged either — it would sit in the
    // cache forever, immune to every future save.
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const corruptHost = 'https://openam-purge-corrupt.example.com/am';
    writeCorruptedCacheFile(cachePath, corruptHost);

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

    const sessions = listCachedSessions({
      state: freshState(otherHost, cachePath),
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].host).toBe(otherHost);
  });

  test('8: a browser-login session saved with a resolved subject shows that subject, not the generic "browser-login" placeholder', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const host = 'https://openam-list-subject.example.com/am';
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: {
        access_token: fakeAccessTokenJwtWithSub('63dce142-2ade-4311-a43f-165d8705c236'),
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
      token: { tokenId: 'AQIC1', successUrl: '', realm: '/', expires: Date.now() + 1_800_000, from_cache: false } as any,
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
