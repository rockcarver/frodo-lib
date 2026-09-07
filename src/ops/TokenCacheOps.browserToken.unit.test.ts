/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent TokenCacheOps.browserToken
 *
 * Regression coverage for the browser-login cache-entry key derivation
 * added in Phase E and relaxed in the Phase F session-lifecycle addendum:
 * since there is no password/service-account JWK to derive an encryption
 * key from for a browser-login session, the key prefers binding the master
 * key to the refresh token, but falls back to the master key alone when no
 * refresh token is available (e.g. cloud's AICMCPClient/AICMCPExchangeClient,
 * which never return one) — real, isolated file I/O against a scratch
 * directory (not mocked), matching this repo's existing
 * `BaseApi.connectionReuse.test.ts` convention for tests that need genuine
 * file-system behavior.
 */
import fs from 'fs';
import { resolve } from 'path';

import {
  readToken,
  saveToken,
  type tokenType,
} from './TokenCacheOps';
import StateImpl from '../shared/State';

const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'TokenCacheOps.browserToken');

function freshState() {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
  });
  state.setTokenCachePath(resolve(TMP_DIR, `${Math.random()}.TokenCache.json`));
  state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  return state;
}

function fakeAccessTokenJwtWithSub(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe('TokenCacheOps browser-login cache-entry key derivation', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    // A stable, known master key for reproducible key derivation across
    // save/read in the same test — avoids relying on DataProtection's own
    // auto-generation behavior for this test's purposes.
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test('1: A browser bearer token saved with a refresh token present can be read back', async () => {
    const state = freshState();
    state.setRefreshToken('refresh-token-abc');
    state.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-1'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);

    const saved = await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: state.getBearerTokenMeta(),
      state,
    });
    expect(saved).toBe(true);

    const read = await readToken({ tokenType: 'browserUserBearer', state });
    expect(read).toEqual(state.getBearerTokenMeta());
  });

  test('2: The subject key is fixed (not derived from the sub claim), so a cache LOOKUP works before any token is known', async () => {
    // The whole point of a cache lookup (unlike a save, which always
    // follows a real login) is that it has to run in a brand-new process
    // BEFORE any token has been obtained — so the subject key it looks up
    // under cannot depend on content (the JWT `sub` claim) only known
    // after a fresh login completes. This test's `readerState` deliberately
    // never sets a bearer/id token at all, mirroring
    // AuthenticateOps.ts's tryReuseCachedBrowserSession() reading the cache
    // as the very first thing it does.
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const writerState = freshState();
    writerState.setTokenCachePath(cachePath);
    writerState.setRefreshToken('refresh-token-a');
    writerState.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-a'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: writerState.getBearerTokenMeta(),
      state: writerState,
    });

    const readerState = freshState();
    readerState.setTokenCachePath(cachePath);
    const read = await readToken({
      tokenType: 'browserUserBearer',
      state: readerState,
    });
    expect((read as any).access_token).toBe(fakeAccessTokenJwtWithSub('user-a'));
  });

  test('2b: A second browser-login identity against the SAME host shares the one cache slot, by design', async () => {
    // One connection profile represents one browser-login configuration
    // per host/realm today, so a second identity logging in against the
    // same host overwrites (last-write-wins) rather than getting a second,
    // independent cache slot — see TokenCacheOps.ts's getSubjectKey() for
    // the full rationale. Multiple simultaneous identities per host is
    // tracked as a separate follow-on (the plan doc's Phase F addendum's
    // connection-profile data-model question), not attempted here.
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const stateA = freshState();
    stateA.setTokenCachePath(cachePath);
    stateA.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-a'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: stateA.getBearerTokenMeta(),
      state: stateA,
    });

    const stateB = freshState();
    stateB.setTokenCachePath(cachePath);
    stateB.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-b'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_900_000,
    } as any);
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: stateB.getBearerTokenMeta(),
      state: stateB,
    });

    const read = await readToken({ tokenType: 'browserUserBearer', state: stateA });
    expect((read as any).access_token).toBe(fakeAccessTokenJwtWithSub('user-b'));
  });

  test('2c: Different HOSTS still get fully isolated cache entries', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const stateA = StateImpl({ host: 'https://host-a.example.com/am' });
    stateA.setTokenCachePath(cachePath);
    stateA.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    stateA.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-a'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: stateA.getBearerTokenMeta(),
      state: stateA,
    });

    const stateB = StateImpl({ host: 'https://host-b.example.com/am' });
    stateB.setTokenCachePath(cachePath);
    stateB.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    stateB.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-b'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: stateB.getBearerTokenMeta(),
      state: stateB,
    });

    const readA = await readToken({ tokenType: 'browserUserBearer', state: stateA });
    const readB = await readToken({ tokenType: 'browserUserBearer', state: stateB });
    expect((readA as any).access_token).toBe(fakeAccessTokenJwtWithSub('user-a'));
    expect((readB as any).access_token).toBe(fakeAccessTokenJwtWithSub('user-b'));
  });

  test('3: A browser bearer token with no refresh token is still cacheable (master-key-only key derivation)', async () => {
    const state = freshState();
    // Deliberately no state.setRefreshToken(...) call — mirrors cloud's
    // AICMCPClient/AICMCPExchangeClient, which never return one.
    state.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-no-refresh'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);

    const saved = await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: state.getBearerTokenMeta(),
      state,
    });
    expect(saved).toBe(true);
    const read = await readToken({ tokenType: 'browserUserBearer', state });
    expect((read as any).access_token).toBe(
      fakeAccessTokenJwtWithSub('user-no-refresh')
    );
  });

  test('4: End-to-end cross-process reuse: no refresh token AND a brand-new reader state with no token set at all', async () => {
    // Combines tests 2 and 3's two separately-verified fixes into the one
    // scenario that actually matters: cloud's browser-login tokens (no
    // refresh token) restored by a brand-new CLI process (no token set on
    // state yet either) — this is exactly what
    // AuthenticateOps.ts's tryReuseCachedBrowserSession() does.
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const writerState = freshState();
    writerState.setTokenCachePath(cachePath);
    // Deliberately no state.setRefreshToken(...) call.
    writerState.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-reuse'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);
    await saveToken({
      tokenType: 'browserUserBearer' as tokenType,
      token: writerState.getBearerTokenMeta(),
      state: writerState,
    });

    const readerState = freshState();
    readerState.setTokenCachePath(cachePath);
    const read = await readToken({
      tokenType: 'browserUserBearer',
      state: readerState,
    });
    expect((read as any).access_token).toBe(
      fakeAccessTokenJwtWithSub('user-reuse')
    );
  });

  test('5: A browser-login user-session token (session-capture path) is cacheable and readable', async () => {
    const state = freshState();
    state.setBearerTokenMeta({
      access_token: fakeAccessTokenJwtWithSub('user-session-capture'),
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    } as any);
    const userSessionMeta = {
      tokenId: 'fake-am-session-id',
      successUrl: '',
      realm: '/',
      expires: Date.now() + 1_800_000,
      from_cache: false,
    };

    const saved = await saveToken({
      tokenType: 'browserUserSession' as tokenType,
      token: userSessionMeta as any,
      state,
    });
    expect(saved).toBe(true);
    const read = await readToken({ tokenType: 'browserUserSession', state });
    expect(read).toEqual(userSessionMeta);
  });
});
