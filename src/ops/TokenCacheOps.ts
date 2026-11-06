import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v5 as uuidv5 } from 'uuid';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import DataProtection from '../utils/DataProtection';
import {
  ensureSecureDirectoryForFile,
  secureExistingFileSync,
  writeSecureFileAtomicSync,
  writeSecureFileSync,
} from '../utils/ExportImportUtils';
import { getFrodoHome } from '../utils/FrodoUtils';
import { stringify } from '../utils/JsonUtils';
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

/**
 * What the cache stores, one file per entry (host, authentication realm, token
 * type and subject): the token itself stays encrypted exactly as before, and
 * the plain fields are what a listing needs and what the former side-index
 * files held (the host and the subject of a session). The file name is made of
 * the four hashed keys, so it discloses nothing.
 *
 * One file per entry means no write ever has to read another entry first, so
 * several processes can use the cache at the same time without a lock: a
 * writer replaces its own file atomically, and a reader never sees a partial
 * file. A corrupt or unreadable entry is a cache miss and is replaced by the
 * next login.
 */
interface CacheEntry {
  version: number;
  host: string;
  realm: string;
  type: tokenType;
  subject?: string;
  expires: number;
  token: string;
}

const ENTRY_VERSION = 1;
const ENTRY_FILE_EXTENSION = '.json';
const TEMPORARY_FILE_EXTENSION = '.tmp';
/** A temporary file this old belongs to a process that died while writing. */
const STALE_TEMPORARY_FILE_MS = 1000 * 60 * 5;
/** Expired entries are kept this long before they are removed. */
const EXPIRED_ENTRY_GRACE_MS = 1000 * 60;

/**
 * The legacy single-file layout: the configured cache file and the two
 * side-index files next to it. Nothing reads them any more; they are removed.
 */
const LEGACY_INDEX_FILENAMES = [
  'TokenCacheHosts.json',
  'TokenCacheSubjects.json',
];

/**
 * Get the directory that holds the cache entries: the configured cache file
 * path without its extension (`TokenCache.json` becomes `TokenCache`), or the
 * path with `.d` appended when it has none.
 * @param {State} state library state
 * @returns {string} cache directory
 */
export function getTokenCacheDir({ state }: { state: State }): string {
  const file = getTokenCachePath({ state });
  const extension = path.extname(file);
  return extension ? file.slice(0, -extension.length) : `${file}.d`;
}

function getEntryFile(tokenType: tokenType, state: State): string {
  return path.join(
    getTokenCacheDir({ state }),
    [
      getHostKey(state),
      getRealmKey(state),
      getTypeKey(tokenType),
      getSubjectKey(tokenType, state),
    ].join('.') + ENTRY_FILE_EXTENSION
  );
}

function parseEntry(text: string): CacheEntry | undefined {
  try {
    const entry = JSON.parse(text);
    if (
      entry &&
      typeof entry === 'object' &&
      Number.isFinite(entry.expires) &&
      typeof entry.token === 'string'
    ) {
      return entry as CacheEntry;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // not an entry
  }
  return undefined;
}

function readEntryFile(file: string): CacheEntry | undefined {
  try {
    return parseEntry(fs.readFileSync(file, 'utf8'));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return undefined;
  }
}

function removeFile(file: string): boolean {
  try {
    fs.unlinkSync(file);
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return false;
  }
}

/**
 * Names of the entry files in the cache directory (no temporary files, no
 * other files).
 */
function listEntryNames(state: State): string[] {
  try {
    return fs
      .readdirSync(getTokenCacheDir({ state }))
      .filter((name) => name.endsWith(ENTRY_FILE_EXTENSION));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return [];
  }
}

/**
 * The four hashed keys an entry file name is made of.
 */
function parseEntryName(name: string):
  | {
      hostKey: string;
      realmKey: string;
      typeKey: string;
      subjectKey: string;
    }
  | undefined {
  const parts = name.slice(0, -ENTRY_FILE_EXTENSION.length).split('.');
  if (parts.length !== 4) return undefined;
  const [hostKey, realmKey, typeKey, subjectKey] = parts;
  return { hostKey, realmKey, typeKey, subjectKey };
}

/**
 * Remove temporary files that an interrupted writer left behind.
 */
function removeStaleTemporaryFiles(state: State): void {
  const directory = getTokenCacheDir({ state });
  try {
    for (const name of fs.readdirSync(directory)) {
      if (!name.endsWith(TEMPORARY_FILE_EXTENSION)) continue;
      const file = path.join(directory, name);
      try {
        if (Date.now() - fs.statSync(file).mtimeMs > STALE_TEMPORARY_FILE_MS) {
          removeFile(file);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // gone already
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // no cache directory yet
  }
}

/**
 * Remove the files of the legacy single-file layout, which nothing reads any
 * more. An older frodo running next to this one may write them again; they are
 * harmless and removed on the next start.
 */
function removeLegacyFiles(state: State): void {
  const file = getTokenCachePath({ state });
  removeFile(file);
  for (const name of LEGACY_INDEX_FILENAMES) {
    removeFile(path.join(path.dirname(file), name));
  }
}

/**
 * Remove expired entries and unreadable ones, and return what is left in the
 * shape of the legacy cache object (host, realm, type, subject and expiry
 * keys, as the public `purge()` has always returned it).
 */
function purgeEntries(state: State): TokenCacheInterface {
  const now = Date.now();
  const directory = getTokenCacheDir({ state });
  const remaining: TokenCacheInterface = {};
  removeStaleTemporaryFiles(state);
  for (const name of listEntryNames(state)) {
    const file = path.join(directory, name);
    const keys = parseEntryName(name);
    const entry = readEntryFile(file);
    if (!keys || !entry || now > entry.expires + EXPIRED_ENTRY_GRACE_MS) {
      debugMessage({
        message: `TokenCacheOps.purgeEntries: purging ${name}`,
        state,
      });
      removeFile(file);
      continue;
    }
    const { hostKey, realmKey, typeKey, subjectKey } = keys;
    remaining[hostKey] ??= {};
    remaining[hostKey][realmKey] ??= {} as TokenCacheInterface[string][string];
    remaining[hostKey][realmKey][typeKey as tokenType] ??= {};
    remaining[hostKey][realmKey][typeKey as tokenType][subjectKey] = {
      [`${entry.expires}`]: entry.token,
    };
  }
  return remaining;
}

/**
 * Initialize the token cache
 *
 * This method is called from app.ts and runs before any of the message handlers are registered.
 * Therefore none of the Console message functions will produce any output.
 *
 * Creates the cache directory and removes what is expired or left behind. It
 * does not write a shared file: processes that start at the same time cannot
 * interfere with each other here.
 * @param {State} state library state
 */
export function initTokenCache({ state }: { state: State }) {
  try {
    debugMessage({
      message: `TokenCacheOps.initTokenCache: start`,
      state,
    });
    ensureSecureDirectoryForFile(
      path.join(getTokenCacheDir({ state }), 'entry')
    );
    purgeEntries(state);
    removeLegacyFiles(state);
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

/**
 * Whether the cache holds a token of this type for the current host that
 * readToken() would return: same location, same freshness rule (it must
 * still have Constants.TOKEN_FRESHNESS_BUFFER_MS to live). Looks at the
 * cache entry only. It decrypts nothing, so it needs no master key and has no
 * side effect; a token that passes may still fail to decrypt or be revoked
 * by the server, which only the real read can tell.
 * @param {object} params parameters object
 * @param {tokenType} params.tokenType token type
 * @param {State} params.state library state
 * @returns {boolean} true if a fresh token of this type is cached for the current host
 */
export function hasFreshTokenEntry({
  tokenType,
  state,
}: {
  tokenType: tokenType;
  state: State;
}): boolean {
  const entry = readEntryFile(getEntryFile(tokenType, state));
  return (
    !!entry && entry.expires - Date.now() > Constants.TOKEN_FRESHNESS_BUFFER_MS
  );
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

function getHostKeyForHost(host: string): string {
  return uuidv5(host, uuidv5.URL);
}

function getHostKey(state: State): string {
  return getHostKeyForHost(state.getHost());
}

function getRealmKeyForRealm(realm: string): string {
  return uuidv5(realm, UUIDV5_NAMESPACE);
}

/**
 * The realm a credential authenticates against, which is part of every cache
 * key. Never the realm a request is made in: one session serves every request
 * realm. Frodo only mints sessions and tokens in the root realm today; when
 * realm user logins arrive, this is where their realm comes from, so that a
 * realm user and an administrator of the same name do not share an entry.
 */
function getAuthenticationRealm(state: State): string {
  void state;
  return '/';
}

function getRealmKey(state: State): string {
  return getRealmKeyForRealm(getAuthenticationRealm(state));
}

/**
 * Returns the subject already recorded in the cache entries for
 * `state.getHost()` and the given token type (the one of the entry that
 * expires last when there are several), or `undefined` if there is none. A
 * cheap, local, synchronous file read that needs no credential — used by
 * `AuthenticateOps.ts`'s cache-hit browser-session reuse to show the same
 * resolved subject `frodo session list` would, without repeating the
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
  const directory = getTokenCacheDir({ state });
  const hostKey = getHostKey(state);
  const typeKey = getTypeKey(tokenType);
  let subject: string | undefined;
  let expires = -Infinity;
  for (const name of listEntryNames(state)) {
    const keys = parseEntryName(name);
    if (!keys || keys.hostKey !== hostKey || keys.typeKey !== typeKey) continue;
    const entry = readEntryFile(path.join(directory, name));
    if (entry?.subject && entry.expires > expires) {
      subject = entry.subject;
      expires = entry.expires;
    }
  }
  return subject;
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
    const entry = readEntryFile(getEntryFile(tokenType, state));
    if (entry) {
      const exp = entry.expires;
      if (exp - Date.now() > Constants.TOKEN_FRESHNESS_BUFFER_MS) {
        debugMessage({
          message: `TokenCacheOps.readToken: found ${tokenType} token in cache [expires in ${Math.floor(
            (exp - Date.now()) / 1000
          )}s]`,
          state,
        });
        const token = await dataProtection.decrypt(entry.token);
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
    writeSecureFileSync(
      masterKeyPath,
      crypto.randomBytes(32).toString('base64')
    );
  } else {
    // self-heal an existing key file created by an older frodo version
    // that didn't restrict permissions
    secureExistingFileSync(masterKeyPath);
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

async function decryptsWith(
  entry: CacheEntry,
  dataProtection: DataProtection
): Promise<boolean> {
  try {
    await dataProtection.decrypt(entry.token);
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return false;
  }
}

/**
 * Store a token in its entry file. The entry is replaced only when the token
 * expires later than the one stored (or the stored one cannot be read with
 * this credential), so a writer that saves later never puts an older token
 * back. Nothing is written when the entry is already up to date.
 *
 * Two processes that check the entry at the same moment both write, and the
 * later rename stays. That is accepted: both tokens are valid, and the one
 * that stays only expires a little sooner.
 */
async function saveEntry({
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
    // A token without a usable expiry can never be judged fresh.
    if (!Number.isFinite(token.expires)) {
      debugMessage({
        message: `TokenCacheOps.saveToken: token has no usable expiry, not cached [tokenType=${tokenType}]`,
        state,
      });
      return false;
    }
    const file = getEntryFile(tokenType, state);
    const dataProtection = new DataProtection({
      sessionKey: generateSessionKey(tokenType, state),
      state,
    });
    const existing = readEntryFile(file);
    if (
      existing &&
      existing.expires >= token.expires &&
      (await decryptsWith(existing, dataProtection))
    ) {
      debugMessage({
        message: `TokenCacheOps.saveToken: cache entry is up to date [tokenType=${tokenType}]`,
        state,
      });
      return true;
    }
    const entry: CacheEntry = {
      version: ENTRY_VERSION,
      host: state.getHost(),
      realm: getAuthenticationRealm(state),
      type: tokenType,
      subject: subject ?? existing?.subject,
      expires: token.expires,
      token: await dataProtection.encrypt(stringify(token)),
    };
    writeSecureFileAtomicSync(file, stringify(entry));
    debugMessage({
      message: `TokenCacheOps.saveToken: saved token in cache [tokenType=${tokenType}]`,
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

export async function saveUserSessionToken({
  token,
  subject,
  state,
}: {
  token: UserSessionMetaType;
  subject?: string;
  state: State;
}): Promise<boolean> {
  return saveEntry({ tokenType: 'userSession', token, subject, state });
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
  return saveEntry({ tokenType: 'userBearer', token, subject, state });
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
  return saveEntry({ tokenType: 'saBearer', token, subject, state });
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
  return saveEntry({ tokenType, token, subject, state });
}

export function purge({ state }: { state: State }): TokenCacheInterface {
  try {
    debugMessage({
      message: `TokenCacheOps.purge: purging expired tokens from the token cache: ${getTokenCacheDir({ state })}`,
      state,
    });
    const purgedCache = purgeEntries(state);
    removeLegacyFiles(state);
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
    const directory = getTokenCacheDir({ state });
    try {
      for (const name of fs.readdirSync(directory)) {
        if (
          name.endsWith(ENTRY_FILE_EXTENSION) ||
          name.endsWith(TEMPORARY_FILE_EXTENSION)
        ) {
          removeFile(path.join(directory, name));
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // no cache directory, nothing to flush
    }
    removeLegacyFiles(state);
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

export interface CachedSessionSummary {
  host: string;
  realm: string;
  tokenType: tokenType | 'unknown';
  subject: string;
  expires: number;
  isExpired: boolean;
}

/**
 * Lists every cache entry across all hosts. `host`, `realm` and `subject` are
 * read from the plain fields of the entry. An entry that records no subject
 * reports `'browser-login'` for the browser-login types (their subject key is a
 * fixed constant) and `'unknown'` for every other type, whose subject key is
 * derived from a credential this function has no access to.
 */
export function listCachedSessions({
  state,
}: {
  state: State;
}): CachedSessionSummary[] {
  const directory = getTokenCacheDir({ state });
  const now = Date.now();
  const summaries: CachedSessionSummary[] = [];
  for (const name of listEntryNames(state)) {
    const keys = parseEntryName(name);
    const entry = readEntryFile(path.join(directory, name));
    if (!keys || !entry) continue;
    const resolvedType = resolveTokenTypeFromKey(keys.typeKey);
    summaries.push({
      host: entry.host || 'unknown',
      realm: entry.realm || 'unknown',
      tokenType: resolvedType ?? 'unknown',
      subject:
        entry.subject ??
        (keys.subjectKey === BROWSER_LOGIN_SUBJECT_KEY
          ? 'browser-login'
          : 'unknown'),
      expires: entry.expires,
      isExpired: now > entry.expires,
    });
  }
  return summaries;
}

/**
 * Removes all cached tokens for a host (or just one realm under it). Powers
 * `frodo session delete <host>` (local cache clear only, no server-side
 * session/token invalidation).
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
    const directory = getTokenCacheDir({ state });
    const hostKey = getHostKeyForHost(host);
    const realmKey = realm ? getRealmKeyForRealm(realm) : undefined;
    let found = false;
    for (const name of listEntryNames(state)) {
      const keys = parseEntryName(name);
      if (!keys || keys.hostKey !== hostKey) continue;
      if (realmKey && keys.realmKey !== realmKey) continue;
      if (removeFile(path.join(directory, name))) found = true;
    }
    return found;
  } catch (error) {
    debugMessage({
      message: `TokenCacheOps.deleteHostTokens: error deleting host tokens: ${error}`,
      state,
    });
    return false;
  }
}
