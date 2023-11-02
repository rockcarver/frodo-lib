import fs from 'fs';
import os from 'os';
import path from 'path';
import { v5 as uuidv5 } from 'uuid';

import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import DataProtection from '../utils/DataProtection';
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
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveUserSessionToken(token: UserSessionMetaType): Promise<boolean>;
  /**
   * Save user bearer token for current connection
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveUserBearerToken(token: AccessTokenMetaType): Promise<boolean>;
  /**
   * Save service account bearer token for current connection
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveSaBearerToken(token: AccessTokenMetaType): Promise<boolean>;
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
    async saveUserSessionToken(token: UserSessionMetaType): Promise<boolean> {
      return saveUserSessionToken({ token, state });
    },
    async saveUserBearerToken(token: AccessTokenMetaType): Promise<boolean> {
      return saveUserBearerToken({ token, state });
    },
    async saveSaBearerToken(token: AccessTokenMetaType): Promise<boolean> {
      return saveSaBearerToken({ token, state });
    },
    purge(): TokenCacheInterface {
      return purge({ state });
    },
    flush(): boolean {
      return flush({ state });
    },
  };
};

const UUIDV5_NAMESPACE = 'e9a38338-21c0-4dcd-ba74-7ddeac58edbe';
const checksumKey = getChecksum('checksum');
const tokenKey = getChecksum('token');

const fileOptions = {
  indentation: 4,
};

export interface tokenTypeInterface {
  userSession: string;
  userBearer: string;
  saBearer: string;
}

export type tokenType = 'userSession' | 'userBearer' | 'saBearer';

export interface TokenCacheInterface {
  [hostKey: string]: {
    [realmKey: string]: {
      [typeKey in keyof typeKey]: {
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
            if (now > exp + 1000 * 60) {
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

function getHostKey(state: State): string {
  return uuidv5(state.getHost(), uuidv5.URL);
}

function getRealmKey(state: State): string {
  // currently frodo only supports sessions and tokens minted in the root realm
  return uuidv5('/' || state.getRealm(), UUIDV5_NAMESPACE);
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
    const data = fs.readFileSync(filename, 'utf8');
    const tokenCache: TokenCacheInterface = JSON.parse(data);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey(state);
    const typeKey = getTypeKey(tokenType);
    const subjectKey = getSubjectKey(tokenType, state);
    if (get(tokenCache, [hostKey, realmKey, typeKey, subjectKey])) {
      const exp = Math.max(
        ...Object.keys(tokenCache[hostKey][realmKey][typeKey][subjectKey]).map(
          (expKey) => parseInt(expKey, 10)
        )
      );
      const expKey = String(exp);
      if (Math.floor((exp - Date.now()) / 1000) > 30) {
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

function generateSessionKey(tokenType: tokenType, state: State) {
  switch (tokenType) {
    case 'userSession':
      return uuidv5(state.getPassword(), UUIDV5_NAMESPACE);
    case 'userBearer':
      return uuidv5(state.getPassword(), UUIDV5_NAMESPACE);
    case 'saBearer':
      return uuidv5(stringify(state.getServiceAccountJwk()), UUIDV5_NAMESPACE);
    default:
      return null;
  }
}

export async function saveUserSessionToken({
  token,
  state,
}: {
  token: UserSessionMetaType;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `TokenCacheOps.saveUserSessionToken: start`,
      state,
    });
    const filename = getTokenCachePath({ state });
    const data = fs.readFileSync(filename, 'utf8');
    const tokenCache: TokenCacheInterface = JSON.parse(data);
    purgeExpiredTokens(tokenCache, state);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey(state);
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
  state,
}: {
  token: AccessTokenMetaType;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `TokenCacheOps.saveUserBearerToken: start`,
      state,
    });
    const filename = getTokenCachePath({ state });
    const data = fs.readFileSync(filename, 'utf8');
    const tokenCache: TokenCacheInterface = JSON.parse(data);
    purgeExpiredTokens(tokenCache, state);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey(state);
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
  state,
}: {
  token: AccessTokenMetaType;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `TokenCacheOps.saveSaBearerToken: start`,
      state,
    });
    const filename = getTokenCachePath({ state });
    const data = fs.readFileSync(filename, 'utf8');
    const tokenCache: TokenCacheInterface = JSON.parse(data);
    purgeExpiredTokens(tokenCache, state);
    const hostKey = getHostKey(state);
    const realmKey = getRealmKey(state);
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

export function purge({ state }: { state: State }): TokenCacheInterface {
  try {
    const filename = getTokenCachePath({ state });
    debugMessage({
      message: `TokenCacheOps.purge: purging expired tokens from existing token cache: ${filename}`,
      state,
    });
    const data = fs.readFileSync(filename, 'utf8');
    const tokenCache: TokenCacheInterface = JSON.parse(data);
    const purgedCache = purgeExpiredTokens(tokenCache, state);
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
