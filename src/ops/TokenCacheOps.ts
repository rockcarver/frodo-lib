import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { v5 as uuidv5 } from 'uuid';

import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import DataProtection from '../utils/DataProtection';
import { ensureDirectoryForFile } from '../utils/ExportImportUtils';
import { getFrodoHome } from '../utils/FrodoUtils';
import { get, put, stringify } from '../utils/JsonUtils';
import { UserSessionMetaType } from './AuthenticateOps';
import { type AccessTokenMetaType } from './OAuth2OidcOps';

export type TokenCache = {
  /**
   * Get connection profiles file name
   * @returns {string} connection profiles file name
   */
  getTokenCachePath(): string;
  /**
   * Initialize token cache
   *
   * This method is called from app.ts and runs before any of the message handlers are registered.
   * Therefore none of the Console message functions will produce any output.
   */
  initTokenCache(): void;
  /**
   * Check if there are suitable tokens in the cache
   * @param {tokenType} tokenType type of token
   * @returns {Promise<boolean>} true if tokens found in cache, false otherwise
   */
  hasToken(tokenType: tokenType): Promise<boolean>;
  /**
   * Check if there are suitable user session tokens in the cache
   * @returns {Promise<boolean>} true if tokens found in cache, false otherwise
   */
  hasUserSessionToken(): Promise<boolean>;
  /**
   * Check if there are suitable user bearer tokens in the cache
   * @returns {Promise<boolean>} true if tokens found in cache, false otherwise
   */
  hasUserBearerToken(): Promise<boolean>;
  /**
   * Check if there are suitable service account bearer tokens in the cache
   * @returns {Promise<boolean>} true if tokens found in cache, false otherwise
   */
  hasSaBearerToken(): Promise<boolean>;
  /**
   * Read token
   * @param {tokenType} tokenType type of token
   * @returns {Promise<string>} token or null
   */
  readToken(
    tokenType: tokenType
  ): Promise<AccessTokenMetaType | UserSessionMetaType>;
  /**
   * Read user session token
   * @returns {Promise<string>} token or null
   */
  readUserSessionToken(): Promise<UserSessionMetaType>;
  /**
   * Read user bearer token
   * @returns {Promise<string>} token or null
   */
  readUserBearerToken(): Promise<AccessTokenMetaType>;
  /**
   * Read service account bearer token
   * @returns {Promise<string>} token or null
   */
  readSaBearerToken(): Promise<AccessTokenMetaType>;
  /**
   * Save user session token for current connection
   * @param {string} subject optional real username, recorded for display by list()
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveUserSessionToken(
    token: UserSessionMetaType,
    subject?: string
  ): Promise<boolean>;
  /**
   * Save user bearer token for current connection
   * @param {string} subject optional real username, recorded for display by list()
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveUserBearerToken(
    token: AccessTokenMetaType,
    subject?: string
  ): Promise<boolean>;
  /**
   * Save service account bearer token for current connection
   * @param {string} subject optional real service-account name, recorded for display by list()
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveSaBearerToken(
    token: AccessTokenMetaType,
    subject?: string
  ): Promise<boolean>;
  /**
   * Save token of any type for current connection
   * @param {tokenType} tokenType type of token
   * @param {UserSessionMetaType | AccessTokenMetaType} token token object
   * @param {string} subject optional actual subject (e.g. username), recorded for display by list()
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveToken(
    tokenType: tokenType,
    token: UserSessionMetaType | AccessTokenMetaType,
    subject?: string
  ): Promise<boolean>;
  /**
   * Purge all expired tokens from cache
   * @returns {TokenCacheInterface} purged cache
   */
  purge(): TokenCacheInterface;
  /**
   * Flush cache
   * @returns {boolean} true if the operation succeeded, false otherwise
   */
  flush(): boolean;
  /**
   * List every cached session across all hosts
   * @returns {CachedSessionSummary[]} flattened list of cache entries
   */
  list(): CachedSessionSummary[];
  /**
   * Delete all cached tokens for a host, or just one realm under it
   * @param {string} host host to delete cached tokens for
   * @param {string} realm optional realm to scope the deletion to
   * @returns {boolean} true if a matching entry was found and removed, false otherwise
   */
  deleteHost(host: string, realm?: string): boolean;
};

export default (state: State): TokenCache => {
  return {
    getTokenCachePath(): string {
      return getTokenCachePath({ state });
    },
    initTokenCache() {
      initTokenCache({ state });
    },
    async hasToken(tokenType: tokenType): Promise<boolean> {
      return hasToken({
        tokenType,
        state,
      });
    },
    async hasUserSessionToken(): Promise<boolean> {
      return hasUserSessionToken({
        state,
      });
    },
    async hasUserBearerToken(): Promise<boolean> {
      return hasUserBearerToken({
        state,
      });
    },
    async hasSaBearerToken(): Promise<boolean> {
      return hasSaBearerToken({
        state,
      });
    },
    async readToken(
      tokenType: tokenType
    ): Promise<AccessTokenMetaType | UserSessionMetaType> {
      return readToken({ tokenType, state });
    },
    async readUserSessionToken(): Promise<UserSessionMetaType> {
      return readUserSessionToken({ state });
    },
    async readUserBearerToken(): Promise<AccessTokenMetaType> {
      return readUserBearerToken({ state });
    },
    async readSaBearerToken(): Promise<AccessTokenMetaType> {
      return readSaBearerToken({ state });
    },
    async saveUserSessionToken(
      token: UserSessionMetaType,
      subject?: string
    ): Promise<boolean> {
      return saveUserSessionToken({ token, subject, state });
    },
    async saveUserBearerToken(
      token: AccessTokenMetaType,
      subject?: string
    ): Promise<boolean> {
      return saveUserBearerToken({ token, subject, state });
    },
    async saveSaBearerToken(
      token: AccessTokenMetaType,
      subject?: string
    ): Promise<boolean> {
      return saveSaBearerToken({ token, subject, state });
    },
    async saveToken(
      tokenType: tokenType,
      token: UserSessionMetaType | AccessTokenMetaType,
      subject?: string
    ): Promise<boolean> {
      return saveToken({ tokenType, token, subject, state });
    },
    purge(): TokenCacheInterface {
      return purge({ state });
    },
    flush(): boolean {
      return flush({ state });
    },
    list(): CachedSessionSummary[] {
      return listCachedSessions({ state });
    },
    deleteHost(host: string, realm?: string): boolean {
      return deleteHostTokens({ host, realm, state });
    },
  };
};

const UUIDV5_NAMESPACE = 'e9a38338-21c0-4dcd-ba74-7ddeac58edbe';
const checksumKey = getChecksum('checksum');
const tokenKey = getChecksum('token');

const fileOptions = {
  indentation: 4,
};

// export interface tokenTypeInterface {
//   userSession: string;
//   userBearer: string;
//   wsUserBearer: string;
//   saBearer: string;
//   wsSaBearer: string;
// }

export type tokenType =
  | 'userSession'
  | 'userBearer'
  | 'pfUserBearer'
  | 'saBearer'
  | 'pfSaBearer'
  // Deliberately distinct from 'userBearer' rather than overloaded, to avoid
  // colliding with a same-host CLI-derived cache entry. Cacheable
  // unconditionally, and always encrypted with a master-key-only-derived
  // key (see generateSessionKey()) regardless of whether the token response
  // included a refresh token — so a browser-login session can be reused
  // across CLI invocations either way.
  | 'browserUserSession'
  | 'browserUserBearer';

export interface TokenCacheInterface {
  [hostKey: string]: {
    [realmKey: string]: {
      [typeKey in tokenType]: {
        [subjectKey: string]: {
          [expKey: string]: string;
        };
      };
    };
  };
}

const tokenCacheFilename = 'TokenCache.json';

/**
 * Get token cache file name
 * @param {State} state library state
 * @returns {String} connection profiles file name
 */
export function getTokenCachePath({ state }: { state: State }): string {
  debugMessage({
    message: `TokenCacheOps.getTokenCachePath: start`,
    state,
  });
  const tokenCachePath =
    state.getTokenCachePath() ||
    process.env[Constants.FRODO_TOKEN_CACHE_PATH_KEY] ||
    `${os.homedir()}/.frodo/${tokenCacheFilename}`;
  debugMessage({
    message: `TokenCacheOps.getTokenCachePath: end [tokenCachePath=${tokenCachePath}]`,
    state,
  });
  return tokenCachePath;
}

function purgeExpiredTokens(
  tokenCache: TokenCacheInterface,
  state: State
): TokenCacheInterface {
  const now = Date.now();
  debugMessage({
    message: `TokenCacheOps.purgeExpiredTokens: start [now=${now}]`,
    state,
  });
  for (const hostKey of Object.keys(tokenCache)) {
    for (const realmKey of Object.keys(tokenCache[hostKey])) {
      for (const typeKey of Object.keys(tokenCache[hostKey][realmKey])) {
        for (const subjectKey of Object.keys(
          tokenCache[hostKey][realmKey][typeKey]
        )) {
          for (const expKey of Object.keys(
            tokenCache[hostKey][realmKey][typeKey][subjectKey]
          )) {
            const exp = parseInt(expKey, 10);
            // An unparseable exp key must still get purged — `now > NaN +
            // 60000` is always false, which would otherwise let a corrupted
            // entry (e.g. from a long-fixed bug) sit in the cache forever,
            // immune to every future purge.
            if (!Number.isFinite(exp) || now > exp + 1000 * 60) {
              // purge expired token
              debugMessage({
                message: `TokenCacheOps.purgeExpiredTokens: purging expired token ${hostKey}.${realmKey}.${typeKey}.${subjectKey}.${expKey}`,
                state,
              });
              delete tokenCache[hostKey][realmKey][typeKey][subjectKey][expKey];
            }
          }
          if (
            0 ===
            Object.keys(tokenCache[hostKey][realmKey][typeKey][subjectKey])
              .length
          ) {
            // purge empty token subjects
            delete tokenCache[hostKey][realmKey][typeKey][subjectKey];
          }
        }
        if (0 === Object.keys(tokenCache[hostKey][realmKey][typeKey]).length) {
          // purge empty token types
          delete tokenCache[hostKey][realmKey][typeKey];
        }
      }
      if (0 === Object.keys(tokenCache[hostKey][realmKey]).length) {
        // purge empty realms
        delete tokenCache[hostKey][realmKey];
      }
    }
    if (0 === Object.keys(tokenCache[hostKey]).length) {
      // purge empty hosts
      delete tokenCache[hostKey];
    }
  }
  debugMessage({
    message: `TokenCacheOps.purgeExpiredTokens: end`,
    state,
  });
  return tokenCache;
}

/**
 * Initialize connection profiles
 *
 * This method is called from app.ts and runs before any of the message handlers are registered.
 * Therefore none of the Console message functions will produce any output.
 * @param {State} state library state
 */
export function initTokenCache({ state }: { state: State }) {
  try {
    debugMessage({
      message: `TokenCacheOps.initTokenCache: start`,
      state,
    });
    // create token cache file if it doesn't exist
    const filename = getTokenCachePath({ state });
    const folderName = path.dirname(filename);
    if (!fs.existsSync(filename)) {
      if (!fs.existsSync(folderName)) {
        debugMessage({
          message: `TokenCacheOps.initTokenCache: folder does not exist: ${folderName}, creating...`,
          state,
        });
        fs.mkdirSync(folderName, { recursive: true });
      }
      if (!fs.existsSync(filename)) {
        debugMessage({
          message: `TokenCacheOps.initTokenCache: file does not exist: ${filename}, creating...`,
          state,
        });
        fs.writeFileSync(
          filename,
          JSON.stringify({}, null, fileOptions.indentation)
        );
      }
    }
    // purge expired tokens
    else {
      const data = fs.readFileSync(filename, 'utf8');
      const tokenCache: TokenCacheInterface = JSON.parse(data);
      purgeExpiredTokens(tokenCache, state);
      ensureDirectoryForFile(filename);
      fs.writeFileSync(filename, stringify(tokenCache));
    }
    debugMessage({
      message: `TokenCacheOps.initTokenCache: end`,
      state,
    });
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.initTokenCache: error initializing cache: ${error}`,
      state,
    });
  }
}

export async function hasToken({
  tokenType,
  state,
}: {
  tokenType: tokenType;
  state: State;
}): Promise<boolean> {
  debugMessage({
    message: `TokenCacheOps.hasToken: start [tokenType=${tokenType}]`,
    state,
  });
  try {
    await readToken({ tokenType, state });
    debugMessage({
      message: `TokenCacheOps.hasToken: end [has ${tokenType} token: true]`,
      state,
    });
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.hasToken: end [has ${tokenType} token: false]`,
      state,
    });
    return false;
  }
}

export async function hasUserSessionToken({
  state,
}: {
  state: State;
}): Promise<boolean> {
  return hasToken({ tokenType: 'userSession', state });
}

export async function hasUserBearerToken({
  state,
}: {
  state: State;
}): Promise<boolean> {
  return hasToken({ tokenType: 'userBearer', state });
}

export async function hasSaBearerToken({
  state,
}: {
  state: State;
}): Promise<boolean> {
  return hasToken({ tokenType: 'saBearer', state });
}

function getChecksum(input: string): string {
  return uuidv5(input, UUIDV5_NAMESPACE);
}

function getHostKeyForHost(host: string): string {
  return uuidv5(host, uuidv5.URL);
}

function getHostKey(state: State): string {
  return getHostKeyForHost(state.getHost());
}

function getRealmKeyForRealm(realm: string): string {
  return uuidv5(realm, UUIDV5_NAMESPACE);
}

function getRealmKey(): string {
  // currently frodo only supports sessions and tokens minted in the root realm
  return getRealmKeyForRealm('/');
}

const hostIndexFilename = 'TokenCacheHosts.json';

/**
 * Path to the small side-index mapping a cache entry's hashed `hostKey`
 * back to the plaintext host it was derived from. Kept in the same
 * directory as the token cache itself, but deliberately NOT part of
 * `TokenCacheInterface`/`TokenCache.json`: every hostKey/realmKey/typeKey in
 * that structure is a one-way uuidv5 hash with no stored reverse mapping,
 * so without this side index, `listCachedSessions()` (frodo session list)
 * would have no way to report which host a given cache entry belongs to.
 * realm is never indexed (frodo only ever mints sessions/tokens in the root
 * realm today, so `getRealmKey()` is a single known constant), and tokenType
 * is reversible by brute-force match against its small closed enum, so
 * host is the only piece that actually needs one.
 */
function getHostIndexPath(state: State): string {
  return path.join(
    path.dirname(getTokenCachePath({ state })),
    hostIndexFilename
  );
}

function readHostIndex(state: State): Record<string, string> {
  const filename = getHostIndexPath(state);
  if (!fs.existsSync(filename)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Records `hostKey -> host` so a later `listCachedSessions()`/
 * `deleteHostTokens()` call can resolve it back. Best-effort: a failure
 * here must never block the actual token save it's called alongside.
 */
function recordHostIndexEntry(state: State): void {
  try {
    const filename = getHostIndexPath(state);
    const index = readHostIndex(state);
    index[getHostKey(state)] = state.getHost();
    ensureDirectoryForFile(filename);
    fs.writeFileSync(filename, stringify(index));
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.recordHostIndexEntry: error recording host index entry: ${error}`,
      state,
    });
  }
}

const subjectIndexFilename = 'TokenCacheSubjects.json';

/**
 * Path to a small side-index recording the actual subject (a real username
 * or service-account name wherever one can be resolved) for display by
 * `listCachedSessions()`.
 *
 * Keyed by `hostKey -> typeKey -> subject`, NOT by `subjectKey`:
 * `getSubjectKey()`'s own comment explains that browser-login's subject key
 * is a single fixed constant shared by every browser-login cache entry
 * everywhere, precisely because a cache *lookup* has to run before any
 * token — and therefore any real subject — exists. That makes subjectKey
 * useless as an index key for a per-login display value; hostKey is what
 * actually discriminates one browser-login session from another today (one
 * browser-login identity per host/realm, the same assumption
 * `getSubjectKey()` itself already makes). `typeKey` is layered on top of
 * that (not folded into a single flat key) because a single host commonly
 * carries *several* token types at once — e.g. a browser-login bearer
 * token and a service-account bearer token side by side, each with its own
 * unrelated subject — so a flat `hostKey -> subject` shape would let
 * whichever type saved most recently silently overwrite the other's
 * entry, corrupting both rows in `session list`.
 */
function getSubjectIndexPath(state: State): string {
  return path.join(
    path.dirname(getTokenCachePath({ state })),
    subjectIndexFilename
  );
}

type SubjectIndex = Record<string, Record<string, string>>;

function readSubjectIndex(state: State): SubjectIndex {
  const filename = getSubjectIndexPath(state);
  if (!fs.existsSync(filename)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Records `hostKey -> typeKey -> subject` so a later `listCachedSessions()`
 * call can show who's actually logged in instead of a generic placeholder.
 * Best-effort, same as `recordHostIndexEntry()`: a failure here must never
 * block the actual token save it's called alongside. Callers must only
 * pass a subject they're confident in — passing `undefined` leaves
 * whatever's already indexed for this host/type untouched, so a
 * low-information value (e.g. a JWT-decode failure) never overwrites a
 * better one recorded by an earlier save for the same login.
 */
function recordSubjectIndexEntry(
  subject: string | undefined,
  tokenType: tokenType,
  state: State
): void {
  if (!subject) {
    return;
  }
  try {
    const filename = getSubjectIndexPath(state);
    const index = readSubjectIndex(state);
    const hostKey = getHostKey(state);
    index[hostKey] = { ...index[hostKey], [getTypeKey(tokenType)]: subject };
    ensureDirectoryForFile(filename);
    fs.writeFileSync(filename, stringify(index));
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.recordSubjectIndexEntry: error recording subject index entry: ${error}`,
      state,
    });
  }
}

/** Removes every subject recorded for a host (all token types), e.g. when `deleteHostTokens()` clears that host entirely. */
function removeSubjectIndexEntry(hostKey: string, state: State): void {
  try {
    const filename = getSubjectIndexPath(state);
    const index = readSubjectIndex(state);
    if (hostKey in index) {
      delete index[hostKey];
      ensureDirectoryForFile(filename);
      fs.writeFileSync(filename, stringify(index));
    }
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.removeSubjectIndexEntry: error removing subject index entry: ${error}`,
      state,
    });
  }
}

/**
 * Returns the subject already recorded for `state.getHost()` and the given
 * token type (see `recordSubjectIndexEntry()`), or `undefined` if nothing's
 * been recorded for it yet. A cheap, local, synchronous file read — used
 * by `AuthenticateOps.ts`'s cache-hit browser-session reuse to show the
 * same resolved subject `frodo session list` would, without repeating the
 * (potentially network-calling) resolution work that produced it in the
 * first place.
 */
export function getRecordedSubject({
  tokenType,
  state,
}: {
  tokenType: tokenType;
  state: State;
}): string | undefined {
  return readSubjectIndex(state)[getHostKey(state)]?.[getTypeKey(tokenType)];
}

function getTypeKey(tokenType: tokenType): string {
  return uuidv5(tokenType, UUIDV5_NAMESPACE);
}

function getSubjectKey(tokenType: tokenType, state: State): string {
  if (tokenType === 'userSession') {
    return uuidv5(state.getUsername(), UUIDV5_NAMESPACE);
  } else if (tokenType === 'userBearer') {
    return uuidv5(state.getUsername(), UUIDV5_NAMESPACE);
  } else if (tokenType === 'saBearer') {
    return uuidv5(state.getServiceAccountId(), UUIDV5_NAMESPACE);
  } else if (
    tokenType === 'browserUserSession' ||
    tokenType === 'browserUserBearer'
  ) {
    // Deliberately fixed, not derived from the eventual token's `sub`
    // claim: a cache *lookup* has to run before any token has been
    // obtained in this process, so the subject key it looks up under can't
    // depend on content only known after a fresh login completes — doing
    // so would make every lookup from a brand-new process miss even a
    // perfectly valid cache entry, defeating session reuse entirely (a real
    // gap this token type had until the Phase F session-lifecycle
    // addendum). One connection profile represents one browser-login
    // configuration per host/realm today, so a single fixed subject per
    // token type is sufficient; see the plan doc's Phase F addendum for the
    // separately-tracked multi-identity-per-host follow-on.
    return uuidv5('browser-login', UUIDV5_NAMESPACE);
  }
}

export async function readToken({
  tokenType,
  state,
}: {
  tokenType: tokenType;
  state: State;
}): Promise<AccessTokenMetaType | UserSessionMetaType> {
  try {
    debugMessage({
      message: `TokenCacheOps.readToken: start`,
      state,
    });
    const dataProtection = new DataProtection({
      sessionKey: generateSessionKey(tokenType, state),
      state,
    });
    const filename = getTokenCachePath({ state });
    // bare library consumers may never have called initTokenCache(); treat a
    // missing cache file (and directory) as an empty cache so the save
    // succeeds and creates both
    const data = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : undefined;
    const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey();
    const typeKey = getTypeKey(tokenType);
    const subjectKey = getSubjectKey(tokenType, state);
    if (get(tokenCache, [hostKey, realmKey, typeKey, subjectKey])) {
      const exp = Math.max(
        ...Object.keys(tokenCache[hostKey][realmKey][typeKey][subjectKey]).map(
          (expKey) => parseInt(expKey, 10)
        )
      );
      const expKey = String(exp);
      if (exp - Date.now() > Constants.TOKEN_FRESHNESS_BUFFER_MS) {
        debugMessage({
          message: `TokenCacheOps.readToken: found ${tokenType} token in cache [expires in ${Math.floor(
            (exp - Date.now()) / 1000
          )}s]`,
          state,
        });
        const token = await dataProtection.decrypt(
          tokenCache[hostKey][realmKey][typeKey][subjectKey][expKey][tokenKey]
        );
        return JSON.parse(token);
      }
    }
  } catch (error) {
    error.message = `Error searching for ${tokenType} tokens in cache: ${error}`;
    debugMessage({
      message: `TokenCacheOps.readToken: ${error.message}: ${error.stack}`,
      state,
    });
    throw error;
  }
  const error = new Error(`No ${tokenType} tokens found in cache`);
  debugMessage({
    message: `TokenCacheOps.readToken: ${error.message}`,
    state,
  });
  throw error;
}

export async function readUserSessionToken({
  state,
}: {
  state: State;
}): Promise<UserSessionMetaType> {
  return (await readToken({
    tokenType: 'userSession',
    state,
  })) as UserSessionMetaType;
}

export async function readUserBearerToken({
  state,
}: {
  state: State;
}): Promise<AccessTokenMetaType> {
  return (await readToken({
    tokenType: 'userBearer',
    state,
  })) as AccessTokenMetaType;
}

export async function readSaBearerToken({
  state,
}: {
  state: State;
}): Promise<AccessTokenMetaType> {
  return (await readToken({
    tokenType: 'saBearer',
    state,
  })) as AccessTokenMetaType;
}

/**
 * Reads the master key's raw content, mirroring `DataProtection`'s own path
 * resolution (`FRODO_MASTER_KEY_KEY` env var directly as content, else
 * `FRODO_MASTER_KEY_PATH_KEY` env var or `state.getMasterKeyPath()` or the
 * default path). Only used for deriving a browser-login cache-entry key —
 * every other token type derives its key from the credential itself
 * (password/service-account JWK), which browser login has none of.
 *
 * Must create the file first (with a fresh random key) when it doesn't
 * exist yet, rather than returning undefined on a miss: this content gets
 * wrapped with uuidv5() by generateSessionKey() below. If this returned
 * undefined for a first-ever save, generateSessionKey() would hand
 * DataProtection a falsy sessionKey — and DataProtection's own internal
 * fallback (used whenever sessionKey is falsy) auto-generates the same file
 * itself, but uses its *raw* content directly as the encryption key, with
 * no uuidv5 wrapping. That first entry would then be encrypted with a
 * different effective key than every later call computes (uuidv5(content),
 * once the file exists) — an unrecoverable mismatch, confirmed live: a
 * freshly seeded browserUserBearer entry decrypted fine within the same
 * process, but failed with "Unsupported state or unable to authenticate
 * data" when read back from a separate process after the file had been
 * created by that same first save. Creating the file here, before
 * generateSessionKey() wraps it, keeps the derivation identical on every
 * call, first or not.
 */
function readMasterKeyContent(state: State): string {
  if (process.env[Constants.FRODO_MASTER_KEY_KEY]) {
    return process.env[Constants.FRODO_MASTER_KEY_KEY];
  }
  const masterKeyPath =
    state.getMasterKeyPath() ||
    process.env[Constants.FRODO_MASTER_KEY_PATH_KEY] ||
    path.join(getFrodoHome(), 'masterkey.key');
  if (!fs.existsSync(masterKeyPath)) {
    ensureDirectoryForFile(masterKeyPath);
    fs.writeFileSync(masterKeyPath, crypto.randomBytes(32).toString('base64'));
  }
  return fs.readFileSync(masterKeyPath, 'utf8');
}

function generateSessionKey(tokenType: tokenType, state: State) {
  switch (tokenType) {
    case 'userSession':
      return uuidv5(state.getPassword(), UUIDV5_NAMESPACE);
    case 'userBearer':
      return uuidv5(state.getPassword(), UUIDV5_NAMESPACE);
    case 'saBearer':
      return uuidv5(stringify(state.getServiceAccountJwk()), UUIDV5_NAMESPACE);
    case 'browserUserSession':
    case 'browserUserBearer': {
      // No password/JWK to derive from for a browser login, so this binds
      // the key to the master key (a stable per-installation secret already
      // used elsewhere for connection-profile encryption) alone — never to
      // the refresh token, even when one is present. Binding to the refresh
      // token was tried first and doesn't work for cache *lookups*: a
      // lookup has to run in a brand-new process before any token has been
      // obtained, so the refresh token needed to derive a matching key
      // would itself have to come from inside the very cache entry the key
      // is decrypting (see AuthenticateOps.ts's
      // tryReuseCachedBrowserSession(), the first real cross-process reader
      // of this token type). The master key already protects every other
      // secret in this same cache file, so this isn't a meaningfully weaker
      // guarantee. readMasterKeyContent() creates the file on first use if
      // missing — see its own comment for why this must never fall back to
      // a null/falsy sessionKey here.
      return uuidv5(readMasterKeyContent(state), UUIDV5_NAMESPACE);
    }
    default:
      return null;
  }
}

export async function saveUserSessionToken({
  token,
  subject,
  state,
}: {
  token: UserSessionMetaType;
  subject?: string;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `TokenCacheOps.saveUserSessionToken: start`,
      state,
    });
    const filename = getTokenCachePath({ state });
    // bare library consumers may never have called initTokenCache(); treat a
    // missing cache file (and directory) as an empty cache so the save
    // succeeds and creates both
    const data = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : undefined;
    const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
    purgeExpiredTokens(tokenCache, state);
    recordHostIndexEntry(state);
    recordSubjectIndexEntry(subject, 'userSession', state);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey();
    const typeKey = getTypeKey('userSession');
    const subjectKey = getSubjectKey('userSession', state);
    const dataProtection = new DataProtection({
      sessionKey: generateSessionKey('userSession', state),
      state,
    });
    const checksum = getChecksum(stringify(token));
    const checksums = Object.keys(
      get(tokenCache, [hostKey, realmKey, typeKey, subjectKey], {})
    ).map((expKey) =>
      get(tokenCache, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        expKey,
        checksumKey,
      ])
    );
    if (checksums.includes(checksum)) {
      debugMessage({
        message: `TokenCacheOps.saveUserSessionToken: token alreaday in cache`,
        state,
      });
    } else {
      put(tokenCache, checksum, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        checksumKey,
      ]);
      put(tokenCache, await dataProtection.encrypt(stringify(token)), [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        tokenKey,
      ]);
      ensureDirectoryForFile(filename);
      fs.writeFileSync(filename, stringify(tokenCache));
      debugMessage({
        message: `TokenCacheOps.saveUserSessionToken: saved token in cache`,
        state,
      });
    }
    debugMessage({
      message: `TokenCacheOps.saveUserSessionToken: end`,
      state,
    });
    return true;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.saveUserSessionToken: error saving token in cache: ${error}`,
      state,
    });
    debugMessage({
      message: error.stack,
      state,
    });
    return false;
  }
}

export async function saveUserBearerToken({
  token,
  subject,
  state,
}: {
  token: AccessTokenMetaType;
  subject?: string;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `TokenCacheOps.saveUserBearerToken: start`,
      state,
    });
    const filename = getTokenCachePath({ state });
    // bare library consumers may never have called initTokenCache(); treat a
    // missing cache file (and directory) as an empty cache so the save
    // succeeds and creates both
    const data = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : undefined;
    const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
    purgeExpiredTokens(tokenCache, state);
    recordHostIndexEntry(state);
    recordSubjectIndexEntry(subject, 'userBearer', state);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey();
    const typeKey = getTypeKey('userBearer');
    const subjectKey = getSubjectKey('userBearer', state);
    const dataProtection = new DataProtection({
      sessionKey: generateSessionKey('userBearer', state),
      state,
    });
    const checksum = getChecksum(stringify(token));
    const checksums = Object.keys(
      get(tokenCache, [hostKey, realmKey, typeKey, subjectKey], {})
    ).map((expKey) =>
      get(tokenCache, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        expKey,
        checksumKey,
      ])
    );
    if (checksums.includes(checksum)) {
      debugMessage({
        message: `TokenCacheOps.saveUserBearerToken: token alreaday in cache`,
        state,
      });
    } else {
      put(tokenCache, checksum, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        checksumKey,
      ]);
      put(tokenCache, await dataProtection.encrypt(stringify(token)), [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        tokenKey,
      ]);
      ensureDirectoryForFile(filename);
      fs.writeFileSync(filename, stringify(tokenCache));
      debugMessage({
        message: `TokenCacheOps.saveUserBearerToken: saved token in cache`,
        state,
      });
    }
    debugMessage({
      message: `TokenCacheOps.saveUserBearerToken: end`,
      state,
    });
    return true;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.saveUserBearerToken: error saving token in cache: ${error}`,
      state,
    });
    debugMessage({
      message: error.stack,
      state,
    });
    return false;
  }
}

export async function saveSaBearerToken({
  token,
  subject,
  state,
}: {
  token: AccessTokenMetaType;
  subject?: string;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `TokenCacheOps.saveSaBearerToken: start`,
      state,
    });
    const filename = getTokenCachePath({ state });
    // bare library consumers may never have called initTokenCache(); treat a
    // missing cache file (and directory) as an empty cache so the save
    // succeeds and creates both
    const data = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : undefined;
    const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
    purgeExpiredTokens(tokenCache, state);
    recordHostIndexEntry(state);
    recordSubjectIndexEntry(subject, 'saBearer', state);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey();
    const typeKey = getTypeKey('saBearer');
    const subjectKey = getSubjectKey('saBearer', state);
    const dataProtection = new DataProtection({
      sessionKey: generateSessionKey('saBearer', state),
      state,
    });
    const checksum = getChecksum(stringify(token));
    const checksums = Object.keys(
      get(tokenCache, [hostKey, realmKey, typeKey, subjectKey], {})
    ).map((expKey) =>
      get(tokenCache, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        expKey,
        checksumKey,
      ])
    );
    debugMessage({
      message: `TokenCacheOps.saveSaBearerToken: checksum=${checksum} checksums=${checksums}`,
      state,
    });
    if (checksums.includes(checksum)) {
      debugMessage({
        message: `TokenCacheOps.saveSaBearerToken: token already in cache`,
        state,
      });
    } else {
      put(tokenCache, checksum, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        checksumKey,
      ]);
      put(tokenCache, await dataProtection.encrypt(stringify(token)), [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        tokenKey,
      ]);
      ensureDirectoryForFile(filename);
      fs.writeFileSync(filename, stringify(tokenCache));
      debugMessage({
        message: `TokenCacheOps.saveSaBearerToken: saved token in cache`,
        state,
      });
    }
    debugMessage({
      message: `TokenCacheOps.saveSaBearerToken: end`,
      state,
    });
    return true;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.saveSaBearerToken: error saving token in cache: ${error}`,
      state,
    });
    debugMessage({
      message: error.stack,
      state,
    });
    return false;
  }
}

export async function saveToken({
  tokenType,
  token,
  subject,
  state,
}: {
  tokenType: tokenType;
  token: UserSessionMetaType | AccessTokenMetaType;
  subject?: string;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `TokenCacheOps.saveToken: start [tokenType=${tokenType}]`,
      state,
    });
    const filename = getTokenCachePath({ state });
    // bare library consumers may never have called initTokenCache(); treat a
    // missing cache file (and directory) as an empty cache so the save
    // succeeds and creates both
    const data = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : undefined;
    const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
    purgeExpiredTokens(tokenCache, state);
    recordHostIndexEntry(state);
    recordSubjectIndexEntry(subject, tokenType, state);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey();
    const typeKey = getTypeKey(tokenType);
    const subjectKey = getSubjectKey(tokenType, state);
    const dataProtection = new DataProtection({
      sessionKey: generateSessionKey(tokenType, state),
      state,
    });
    const checksum = getChecksum(stringify(token));
    const checksums = Object.keys(
      get(tokenCache, [hostKey, realmKey, typeKey, subjectKey], {})
    ).map((expKey) =>
      get(tokenCache, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        expKey,
        checksumKey,
      ])
    );
    if (checksums.includes(checksum)) {
      debugMessage({
        message: `TokenCacheOps.saveToken: token already in cache [tokenType=${tokenType}]`,
        state,
      });
    } else {
      put(tokenCache, checksum, [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        checksumKey,
      ]);
      put(tokenCache, await dataProtection.encrypt(stringify(token)), [
        hostKey,
        realmKey,
        typeKey,
        subjectKey,
        `${token.expires}`,
        tokenKey,
      ]);
      ensureDirectoryForFile(filename);
      fs.writeFileSync(filename, stringify(tokenCache));
      debugMessage({
        message: `TokenCacheOps.saveToken: saved token in cache [tokenType=${tokenType}]`,
        state,
      });
    }
    debugMessage({
      message: `TokenCacheOps.saveToken: end [tokenType=${tokenType}]`,
      state,
    });
    return true;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.saveToken: error saving token in cache [tokenType=${tokenType}]: ${error}`,
      state,
    });
    debugMessage({
      message: error.stack,
      state,
    });
    return false;
  }
}

export function purge({ state }: { state: State }): TokenCacheInterface {
  try {
    const filename = getTokenCachePath({ state });
    debugMessage({
      message: `TokenCacheOps.purge: purging expired tokens from existing token cache: ${filename}`,
      state,
    });
    // bare library consumers may never have called initTokenCache(); treat a
    // missing cache file (and directory) as an empty cache
    const data = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : undefined;
    const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
    const purgedCache = purgeExpiredTokens(tokenCache, state);
    ensureDirectoryForFile(filename);
    fs.writeFileSync(filename, stringify(purgedCache));
    debugMessage({
      message: `TokenCacheOps.purge: end`,
      state,
    });
    return purgedCache;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.purge: error purge cache: ${error}`,
      state,
    });
    return {};
  }
}

export function flush({ state }: { state: State }): boolean {
  try {
    debugMessage({
      message: `TokenCacheOps.flush: start`,
      state,
    });
    const filename = getTokenCachePath({ state });
    ensureDirectoryForFile(filename);
    fs.writeFileSync(filename, stringify({}));
    debugMessage({
      message: `TokenCacheOps.flush: end`,
      state,
    });
    return true;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.flush: error flushing cache: ${error}`,
      state,
    });
    return false;
  }
}

const ALL_TOKEN_TYPES: tokenType[] = [
  'userSession',
  'userBearer',
  'pfUserBearer',
  'saBearer',
  'pfSaBearer',
  'browserUserSession',
  'browserUserBearer',
];

// getSubjectKey() no longer depends on state for these two types (see its
// own comment) — a single constant, so it's directly computable here for
// display purposes rather than needing a stored reverse index.
const BROWSER_LOGIN_SUBJECT_KEY = uuidv5('browser-login', UUIDV5_NAMESPACE);

function resolveTokenTypeFromKey(typeKey: string): tokenType | undefined {
  return ALL_TOKEN_TYPES.find((candidate) => getTypeKey(candidate) === typeKey);
}

function removeHostIndexEntry(hostKey: string, state: State): void {
  try {
    const filename = getHostIndexPath(state);
    const index = readHostIndex(state);
    if (hostKey in index) {
      delete index[hostKey];
      ensureDirectoryForFile(filename);
      fs.writeFileSync(filename, stringify(index));
    }
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.removeHostIndexEntry: error removing host index entry: ${error}`,
      state,
    });
  }
}

export interface CachedSessionSummary {
  host: string;
  realm: string;
  tokenType: tokenType | 'unknown';
  subject: string;
  expires: number;
  isExpired: boolean;
}

/**
 * Lists every cache entry across all hosts, flattening the cache's
 * `host -> realm -> tokenType -> subject -> exp` structure. `host` is
 * resolved via the side index recorded alongside every save (see
 * `recordHostIndexEntry()`); a cache file untouched since before that index
 * existed reports `'unknown'` for entries it can't resolve yet — they
 * self-heal the next time that host's token is saved again. `subject` is
 * only resolvable for browser-login entries today (their subject key is a
 * fixed constant, not derived from anything host/user-specific); every
 * other auth mode's subject key is derived from a credential (password,
 * service-account JWK) this function has no access to, so it reports
 * `'unknown'` for those rather than guessing.
 */
export function listCachedSessions({
  state,
}: {
  state: State;
}): CachedSessionSummary[] {
  const filename = getTokenCachePath({ state });
  const data = fs.existsSync(filename)
    ? fs.readFileSync(filename, 'utf8')
    : undefined;
  const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
  const hostIndex = readHostIndex(state);
  const subjectIndex = readSubjectIndex(state);
  const rootRealmKey = getRealmKey();
  const now = Date.now();
  const summaries: CachedSessionSummary[] = [];
  for (const hostKey of Object.keys(tokenCache)) {
    const host = hostIndex[hostKey] || 'unknown';
    for (const realmKey of Object.keys(tokenCache[hostKey])) {
      const realm = realmKey === rootRealmKey ? '/' : 'unknown';
      for (const typeKey of Object.keys(tokenCache[hostKey][realmKey])) {
        const resolvedType = resolveTokenTypeFromKey(typeKey);
        for (const subjectKey of Object.keys(
          tokenCache[hostKey][realmKey][typeKey]
        )) {
          // subjectKey is a one-way hash (and, for browser-login entries, a
          // single fixed constant — see getSubjectKey()'s comment) — never
          // reversible back to a display value on its own. The actual
          // subject (a real username/service-account name where the save
          // path resolved one) comes from the host+type-keyed side index
          // recorded at save time instead, for any token type that has one.
          const recordedSubject = subjectIndex[hostKey]?.[typeKey];
          const subject =
            recordedSubject ??
            (subjectKey === BROWSER_LOGIN_SUBJECT_KEY ? 'browser-login' : 'unknown');
          for (const expKey of Object.keys(
            tokenCache[hostKey][realmKey][typeKey][subjectKey]
          )) {
            const expires = parseInt(expKey, 10);
            summaries.push({
              host,
              realm,
              tokenType: resolvedType ?? 'unknown',
              subject,
              expires,
              // An unparseable exp key (a corrupted entry, e.g. written by a
              // long-fixed bug) must never report isExpired: false — `now >
              // NaN` is always false, which would misreport a corrupt entry
              // as a permanently valid session and let it sit unpurged
              // forever. Treat anything that doesn't parse as expired.
              isExpired: !Number.isFinite(expires) || now > expires,
            });
          }
        }
      }
    }
  }
  return summaries;
}

/**
 * Removes all cached tokens for a host (or just one realm under it),
 * mirroring `flush()`'s file-rewrite shape but scoped instead of
 * whole-file. Powers `frodo session delete <host>` (v1: local cache clear
 * only, no server-side session/token invalidation — see the plan doc's
 * Phase F addendum).
 * @returns {boolean} true if a matching entry was found and removed, false if there was nothing to delete
 */
export function deleteHostTokens({
  host,
  realm,
  state,
}: {
  host: string;
  realm?: string;
  state: State;
}): boolean {
  try {
    const filename = getTokenCachePath({ state });
    const data = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : undefined;
    const tokenCache: TokenCacheInterface = data ? JSON.parse(data) : {};
    const hostKey = getHostKeyForHost(host);
    if (!tokenCache[hostKey]) {
      return false;
    }
    if (realm) {
      const realmKey = getRealmKeyForRealm(realm);
      if (!tokenCache[hostKey][realmKey]) {
        return false;
      }
      delete tokenCache[hostKey][realmKey];
      if (Object.keys(tokenCache[hostKey]).length === 0) {
        delete tokenCache[hostKey];
        removeHostIndexEntry(hostKey, state);
        removeSubjectIndexEntry(hostKey, state);
      }
    } else {
      delete tokenCache[hostKey];
      removeHostIndexEntry(hostKey, state);
      removeSubjectIndexEntry(hostKey, state);
    }
    ensureDirectoryForFile(filename);
    fs.writeFileSync(filename, stringify(tokenCache));
    return true;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.deleteHostTokens: error deleting host tokens: ${error}`,
      state,
    });
    return false;
  }
}
