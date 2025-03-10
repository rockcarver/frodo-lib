import fs from 'fs';
import os from 'os';
import path from 'path';

import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { debugMessage, printMessage, verboseMessage } from '../utils/Console';
import DataProtection from '../utils/DataProtection';
import { isValidUrl, saveJsonToFile } from '../utils/ExportImportUtils';
import { readServiceAccountScopes } from './cloud/EnvServiceAccountScopesOps';
import {
  createServiceAccount,
  getServiceAccount,
  SERVICE_ACCOUNT_DEFAULT_SCOPES,
} from './cloud/ServiceAccountOps';
import { FrodoError } from './FrodoError';
import { createJwkRsa, createJwks, getJwkRsaPublic, JwkRsa } from './JoseOps';

export type ConnectionProfile = {
  /**
   * Get connection profiles file name
   * @returns {string} connection profiles file name
   */
  getConnectionProfilesPath(): string;
  /**
   * Find connection profiles
   * @param {ConnectionsFileInterface} connectionProfiles connection profile object
   * @param {string} host host url or unique substring
   * @returns {SecureConnectionProfileInterface[]} Array of connection profiles
   */
  findConnectionProfiles(
    connectionProfiles: ConnectionsFileInterface,
    host: string
  ): SecureConnectionProfileInterface[];
  /**
   * Initialize connection profiles
   *
   * This method is called from app.ts and runs before any of the message handlers are registered.
   * Therefore none of the Console message functions will produce any output.
   */
  initConnectionProfiles(): Promise<void>;
  /**
   * Get connection profile by host
   * @param {String} host host tenant host url or unique substring
   * @returns {Object} connection profile or null
   */
  getConnectionProfileByHost(host: string): Promise<ConnectionProfileInterface>;
  /**
   * Get connection profile
   * @returns {Object} connection profile or null
   */
  getConnectionProfile(): Promise<ConnectionProfileInterface>;
  /**
   * Load a connection profile into library state
   * @param {string} host AM host URL or unique substring
   * @returns {Promise<boolean>} A promise resolving to true if successful
   */
  loadConnectionProfileByHost(host: string): Promise<boolean>;
  /**
   * Load a connection profile into library state
   * @returns {Promise<boolean>} A promise resolving to true if successful
   */
  loadConnectionProfile(): Promise<boolean>;
  /**
   * Save connection profile
   * @param {string} host host url for new profiles or unique substring for existing profiles
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  saveConnectionProfile(host: string): Promise<boolean>;
  /**
   * Delete connection profile
   * @param {string} host host tenant host url or unique substring
   */
  deleteConnectionProfile(host: string): void;
  /**
   * Create a new service account using auto-generated parameters
   * @returns {Promise<IdObjectSkeletonInterface>} A promise resolving to a service account object
   */
  addNewServiceAccount(): Promise<IdObjectSkeletonInterface>;
};

export default (state: State): ConnectionProfile => {
  return {
    getConnectionProfilesPath(): string {
      return getConnectionProfilesPath({ state });
    },
    findConnectionProfiles(
      connectionProfiles: ConnectionsFileInterface,
      host: string
    ): SecureConnectionProfileInterface[] {
      return findConnectionProfiles({
        connectionProfiles,
        host,
        state,
      });
    },
    async initConnectionProfiles() {
      initConnectionProfiles({ state });
    },
    async getConnectionProfileByHost(
      host: string
    ): Promise<ConnectionProfileInterface> {
      return getConnectionProfileByHost({ host, state });
    },
    async getConnectionProfile(): Promise<ConnectionProfileInterface> {
      return getConnectionProfile({ state });
    },
    async loadConnectionProfileByHost(host: string): Promise<boolean> {
      return loadConnectionProfileByHost({ host, state });
    },
    async loadConnectionProfile(): Promise<boolean> {
      return loadConnectionProfile({ state });
    },
    async saveConnectionProfile(host: string): Promise<boolean> {
      return saveConnectionProfile({ host, state });
    },
    deleteConnectionProfile(host: string): void {
      deleteConnectionProfile({ host, state });
    },
    async addNewServiceAccount(): Promise<IdObjectSkeletonInterface> {
      return addNewServiceAccount({ state });
    },
  };
};

const fileOptions = {
  indentation: 4,
};

export interface SecureConnectionProfileInterface {
  tenant: string;
  idmHost?: string;
  allowInsecureConnection?: boolean;
  deploymentType?: string;
  username?: string | null;
  encodedPassword?: string | null;
  logApiKey?: string | null;
  encodedLogApiSecret?: string | null;
  authenticationService?: string | null;
  authenticationHeaderOverrides?: Record<string, string>;
  adminClientId?: string | null;
  adminClientRedirectUri?: string | null;
  svcacctId?: string | null;
  encodedSvcacctJwk?: string | null;
  svcacctName?: string | null;
  svcacctScope?: string | null;
}

export interface ConnectionProfileInterface {
  tenant: string;
  idmHost?: string;
  allowInsecureConnection?: boolean;
  deploymentType?: string;
  username?: string | null;
  password?: string | null;
  logApiKey?: string | null;
  logApiSecret?: string | null;
  authenticationService?: string | null;
  authenticationHeaderOverrides?: Record<string, string>;
  adminClientId?: string | null;
  adminClientRedirectUri?: string | null;
  svcacctId?: string | null;
  svcacctJwk?: JwkRsa;
  svcacctName?: string | null;
  svcacctScope?: string | null;
}

export interface ConnectionsFileInterface {
  [key: string]: SecureConnectionProfileInterface;
}

const legacyProfileFilename = '.frodorc';
const newProfileFilename = 'Connections.json';

/**
 * Get connection profiles file name
 * @param {State} state library state
 * @returns {String} connection profiles file name
 */
export function getConnectionProfilesPath({ state }: { state: State }): string {
  debugMessage({
    message: `ConnectionProfileOps.getConnectionProfilesPath: start`,
    state,
  });
  const profilesPath =
    state.getConnectionProfilesPath() ||
    process.env[Constants.FRODO_CONNECTION_PROFILES_PATH_KEY] ||
    `${os.homedir()}/.frodo/${newProfileFilename}`;
  debugMessage({
    message: `ConnectionProfileOps.getConnectionProfilesPath: end [profilesPath=${profilesPath}]`,
    state,
  });
  return profilesPath;
}

/**
 * Find connection profiles
 * @param {ConnectionsFileInterface} connectionProfiles connection profile object
 * @param {string} host host url or unique substring
 * @param {State} state library state
 * @returns {SecureConnectionProfileInterface[]} Array of connection profiles
 */
function findConnectionProfiles({
  connectionProfiles,
  host,
  state,
}: {
  connectionProfiles: ConnectionsFileInterface;
  host: string;
  state: State;
}): SecureConnectionProfileInterface[] {
  const profiles: SecureConnectionProfileInterface[] = [];
  for (const tenant in connectionProfiles) {
    // debugMessage({
    //   message: `ConnectionProfileOps.findConnectionProfiles: tenant=${tenant}`,
    //   state,
    // });
    if (tenant.includes(host)) {
      debugMessage({
        message: `ConnectionProfileOps.findConnectionProfiles: '${host}' identifies '${tenant}', including in result set`,
        state,
      });
      const foundProfile = { ...connectionProfiles[tenant] };
      foundProfile.tenant = tenant;
      profiles.push(foundProfile);
    }
  }
  return profiles;
}

/**
 * Migrate from .frodorc to Connections.json
 */
function migrateFromLegacyProfile() {
  try {
    const legacyPath = `${os.homedir()}/.frodo/${legacyProfileFilename}`;
    const newPath = `${os.homedir()}/.frodo/${newProfileFilename}`;
    if (!fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      // no connections file (old or new), create empty new one
      fs.writeFileSync(
        newPath,
        JSON.stringify({}, null, fileOptions.indentation)
      );
    } else if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      // old exists, new one does not - so copy old to new one
      fs.copyFileSync(legacyPath, newPath);
      // for now, just add a "deprecated" suffix. May delete the old file
      // in a future release
      fs.renameSync(legacyPath, `${legacyPath}.deprecated`);
    }
    // in other cases, where
    // (both old and new exist) OR (only new one exists) don't do anything
  } catch (error) {
    throw new FrodoError(
      `Error migrating from legacy connection profile`,
      error
    );
  }
}

/**
 * Initialize connection profiles
 *
 * This method is called from app.ts and runs before any of the message handlers are registered.
 * Therefore none of the Console message functions will produce any output.
 * @param {State} state library state
 */
export async function initConnectionProfiles({ state }: { state: State }) {
  debugMessage({
    message: `ConnectionProfileOps.initConnectionProfiles: start`,
    state,
  });
  const dataProtection = new DataProtection({
    pathToMasterKey: state.getMasterKeyPath(),
    state,
  });
  try {
    // create connections.json file if it doesn't exist
    const filename = getConnectionProfilesPath({ state });
    const folderName = path.dirname(filename);
    if (!fs.existsSync(filename)) {
      if (!fs.existsSync(folderName)) {
        debugMessage({
          message: `ConnectionProfileOps.initConnectionProfiles: folder does not exist: ${folderName}, creating...`,
          state,
        });
        fs.mkdirSync(folderName, { recursive: true });
      }
      if (!fs.existsSync(filename)) {
        debugMessage({
          message: `ConnectionProfileOps.initConnectionProfiles: file does not exist: ${filename}, creating...`,
          state,
        });
        fs.writeFileSync(
          filename,
          JSON.stringify({}, null, fileOptions.indentation)
        );
      }
    }
    // encrypt the password and logApiSecret from clear text to aes-256-GCM
    else {
      migrateFromLegacyProfile();
      const data = fs.readFileSync(filename, 'utf8');
      const connectionsData: ConnectionsFileInterface = JSON.parse(data);
      let convert = false;
      for (const conn of Object.keys(connectionsData)) {
        if (connectionsData[conn]['password']) {
          convert = true;
          connectionsData[conn].encodedPassword = await dataProtection.encrypt(
            connectionsData[conn]['password']
          );
          delete connectionsData[conn]['password'];
        }
        if (connectionsData[conn]['logApiSecret']) {
          convert = true;
          connectionsData[conn].encodedLogApiSecret =
            await dataProtection.encrypt(connectionsData[conn]['logApiSecret']);
          delete connectionsData[conn]['logApiSecret'];
        }
        if (connectionsData[conn]['svcacctJwk']) {
          convert = true;
          connectionsData[conn].encodedSvcacctJwk =
            await dataProtection.encrypt(connectionsData[conn]['svcacctJwk']);
          delete connectionsData[conn]['svcacctJwk'];
        }
      }
      if (convert) {
        fs.writeFileSync(
          filename,
          JSON.stringify(connectionsData, null, fileOptions.indentation)
        );
      }
    }
    debugMessage({
      message: `ConnectionProfileOps.initConnectionProfiles: end`,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error initializing connection profiles`, error);
  }
}

/**
 * Get connection profile by host
 * @param {string} host host tenant host url or unique substring
 * @param {State} state library state
 * @returns {Promise<ConnectionProfileInterface>} connection profile
 */
export async function getConnectionProfileByHost({
  host,
  state,
}: {
  host: string;
  state: State;
}): Promise<ConnectionProfileInterface> {
  const dataProtection = new DataProtection({
    pathToMasterKey: state.getMasterKeyPath(),
    state,
  });
  const filename = getConnectionProfilesPath({ state });
  if (!fs.statSync(filename, { throwIfNoEntry: false })) {
    throw new FrodoError(`Connection profiles file ${filename} not found`);
  }
  const connectionsData = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const profiles = findConnectionProfiles({
    connectionProfiles: connectionsData,
    host,
    state,
  });
  if (profiles.length == 0) {
    throw new FrodoError(`No connection profile found matching '${host}'`);
  }
  if (profiles.length > 1) {
    throw new FrodoError(
      `Multiple matching connection profiles found matching '${host}':\n  - ${profiles
        .map((profile) => profile.tenant)
        .join(
          '\n  - '
        )}\nSpecify a sub-string uniquely identifying a single connection profile host URL.`
    );
  }
  return {
    tenant: profiles[0].tenant,
    idmHost: profiles[0].idmHost ? profiles[0].idmHost : null,
    allowInsecureConnection: profiles[0].allowInsecureConnection,
    deploymentType: profiles[0].deploymentType,
    username: profiles[0].username ? profiles[0].username : null,
    password: profiles[0].encodedPassword
      ? await dataProtection.decrypt(profiles[0].encodedPassword)
      : null,
    logApiKey: profiles[0].logApiKey ? profiles[0].logApiKey : null,
    logApiSecret: profiles[0].encodedLogApiSecret
      ? await dataProtection.decrypt(profiles[0].encodedLogApiSecret)
      : null,
    authenticationService: profiles[0].authenticationService
      ? profiles[0].authenticationService
      : null,
    authenticationHeaderOverrides: profiles[0].authenticationHeaderOverrides
      ? profiles[0].authenticationHeaderOverrides
      : {},
    adminClientId: profiles[0].adminClientId ? profiles[0].adminClientId : null,
    adminClientRedirectUri: profiles[0].adminClientRedirectUri
      ? profiles[0].adminClientRedirectUri
      : null,
    svcacctName: profiles[0].svcacctName ? profiles[0].svcacctName : null,
    svcacctId: profiles[0].svcacctId ? profiles[0].svcacctId : null,
    svcacctJwk: profiles[0].encodedSvcacctJwk
      ? await dataProtection.decrypt(profiles[0].encodedSvcacctJwk)
      : null,
    svcacctScope: profiles[0].svcacctScope ? profiles[0].svcacctScope : null,
  };
}

/**
 * Get connection profile
 * @param {Object} params Params object
 * @param {State} params.state State object
 * @returns {Promise<ConnectionProfileInterface>} A promise resolving to a connection profile or null
 */
export async function getConnectionProfile({
  state,
}: {
  state: State;
}): Promise<ConnectionProfileInterface> {
  return getConnectionProfileByHost({ host: state.getHost(), state });
}

/**
 * Load a connection profile into library state
 * @param {Object} params Params object
 * @param {string} params.host AM host URL or unique substring
 * @param {State} params.state State object
 * @returns {Promise<boolean>} A promise resolving to true if successful
 */
export async function loadConnectionProfileByHost({
  host,
  state,
}: {
  host: string;
  state: State;
}): Promise<boolean> {
  const conn = await getConnectionProfileByHost({ host, state });
  state.setHost(conn.tenant);
  state.setIdmHost(state.getIdmHost() || conn.idmHost);
  state.setAllowInsecureConnection(conn.allowInsecureConnection);
  state.setDeploymentType(state.getDeploymentType() || conn.deploymentType);
  state.setAdminClientId(state.getAdminClientId() || conn.adminClientId);
  state.setAdminClientRedirectUri(
    state.getAdminClientRedirectUri() || conn.adminClientRedirectUri
  );
  state.setUsername(conn.username);
  state.setPassword(conn.password);
  state.setAuthenticationService(conn.authenticationService);
  state.setAuthenticationHeaderOverrides(conn.authenticationHeaderOverrides);
  state.setServiceAccountId(conn.svcacctId);
  state.setServiceAccountJwk(conn.svcacctJwk);
  state.setServiceAccountScope(conn.svcacctScope);
  return true;
}

/**
 * Load a connection profile into library state
 * @param {Object} params Params object
 * @param {State} params.state State object
 * @returns {Promise<boolean>} A promise resolving to true if successful
 */
export async function loadConnectionProfile({
  state,
}: {
  state: State;
}): Promise<boolean> {
  return loadConnectionProfileByHost({ host: state.getHost(), state });
}

/**
 * Save connection profile
 * @param {string} host host url for new profiles or unique substring for existing profiles
 * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
 */
export async function saveConnectionProfile({
  host,
  state,
}: {
  host: string;
  state: State;
}): Promise<boolean> {
  try {
    debugMessage({
      message: `ConnectionProfileOps.saveConnectionProfile: start`,
      state,
    });
    const dataProtection = new DataProtection({
      pathToMasterKey: state.getMasterKeyPath(),
      state,
    });
    const filename = getConnectionProfilesPath({ state });
    debugMessage({
      message: `Saving connection profile in ${filename}`,
      state,
    });
    let profiles: ConnectionsFileInterface = {};
    let profile: SecureConnectionProfileInterface = { tenant: '' };
    if (fs.statSync(filename, { throwIfNoEntry: false })) {
      const data = fs.readFileSync(filename, 'utf8');
      profiles = JSON.parse(data);

      // find tenant
      const found = findConnectionProfiles({
        connectionProfiles: profiles,
        host,
        state,
      });

      // replace tenant in session with real tenant url if necessary
      if (found.length === 1) {
        profile = found[0];
        state.setHost(profile.tenant);
        verboseMessage({
          message: `Existing profile: ${profile.tenant}`,
          state,
        });
        debugMessage({ message: profile, state });
      }

      // connection profile not found, validate host is a real URL
      if (found.length === 0) {
        if (isValidUrl(host)) {
          state.setHost(host);
          debugMessage({ message: `New profile: ${host}`, state });
        } else {
          throw new FrodoError(
            `No existing profile found matching '${host}'. Provide a valid URL as the host argument to create a new profile.`
          );
        }
      }
    } else {
      debugMessage({
        message: `New profiles file ${filename} with new profile ${host}`,
        state,
      });
    }

    // idm host
    if (state.getIdmHost()) profile.idmHost = state.getIdmHost();

    // allow insecure connection
    if (state.getAllowInsecureConnection())
      profile.allowInsecureConnection = state.getAllowInsecureConnection();

    // deployment type
    if (state.getDeploymentType())
      profile.deploymentType = state.getDeploymentType();

    // admin client id
    if (state.getAdminClientId())
      profile.adminClientId = state.getAdminClientId();

    // admin client redirect uri
    if (state.getAdminClientRedirectUri())
      profile.adminClientRedirectUri = state.getAdminClientRedirectUri();

    // user account
    if (state.getUsername()) profile.username = state.getUsername();
    if (state.getPassword())
      profile.encodedPassword = await dataProtection.encrypt(
        state.getPassword()
      );

    // log API
    if (state.getLogApiKey()) profile.logApiKey = state.getLogApiKey();
    if (state.getLogApiSecret())
      profile.encodedLogApiSecret = await dataProtection.encrypt(
        state.getLogApiSecret()
      );

    // service account
    if (state.getServiceAccountId()) {
      profile.svcacctId = state.getServiceAccountId();
      if (state.getBearerToken()) {
        profile.svcacctName = (
          await getServiceAccount({
            serviceAccountId: state.getServiceAccountId(),
            state,
          })
        ).name;
      }
    }
    if (state.getServiceAccountJwk()) {
      profile.encodedSvcacctJwk = await dataProtection.encrypt(
        state.getServiceAccountJwk()
      );
    }
    if (
      state.getUseBearerTokenForAmApis() &&
      state.getBearerTokenMeta() &&
      state.getBearerTokenMeta().scope !== profile.svcacctScope
    ) {
      profile.svcacctScope = state.getBearerTokenMeta().scope;
    }
    // update existing service account profile
    if (state.getBearerToken() && profile.svcacctId && !profile.svcacctName) {
      profile.svcacctName = (
        await getServiceAccount({ serviceAccountId: profile.svcacctId, state })
      ).name;
      debugMessage({
        message: `ConnectionProfileOps.saveConnectionProfile: added missing service account name`,
        state,
      });
    }

    // advanced settings
    if (state.getAuthenticationService()) {
      profile.authenticationService = state.getAuthenticationService();
      printMessage({
        message:
          'Advanced setting: Authentication Service: ' +
          state.getAuthenticationService(),
        type: 'info',
        state,
      });
    }
    if (
      state.getAuthenticationHeaderOverrides() &&
      Object.entries(state.getAuthenticationHeaderOverrides()).length
    ) {
      profile.authenticationHeaderOverrides =
        state.getAuthenticationHeaderOverrides();
      printMessage({
        message: 'Advanced setting: Authentication Header Overrides: ',
        type: 'info',
        state,
      });
      printMessage({
        message: state.getAuthenticationHeaderOverrides(),
        type: 'info',
        state,
      });
    }

    // remove the helper key 'tenant'
    delete profile.tenant;

    // update profiles
    profiles[state.getHost()] = profile;

    // sort profiles
    const orderedProfiles = Object.keys(profiles)
      .sort()
      .reduce((obj, key) => {
        obj[key] = profiles[key];
        return obj;
      }, {});

    // save profiles
    saveJsonToFile({
      data: orderedProfiles,
      filename,
      includeMeta: false,
      state,
    });
    verboseMessage({
      message: `Saved connection profile ${state.getHost()} in ${filename}`,
      state,
    });
    debugMessage({
      message: `ConnectionProfileOps.saveConnectionProfile: end [true]`,
      state,
    });
    return true;
  } catch (error) {
    throw new FrodoError(`Error saving connection profile`, error);
  }
}

/**
 * Delete connection profile
 * @param {String} host host tenant host url or unique substring
 */
export function deleteConnectionProfile({
  host,
  state,
}: {
  host: string;
  state: State;
}) {
  const filename = getConnectionProfilesPath({ state });
  let connectionsData: ConnectionsFileInterface = {};
  if (!fs.statSync(filename, { throwIfNoEntry: false })) {
    throw new FrodoError(`Connection profiles file ${filename} not found`);
  }
  const data = fs.readFileSync(filename, 'utf8');
  connectionsData = JSON.parse(data);
  const profiles = findConnectionProfiles({
    connectionProfiles: connectionsData,
    host,
    state,
  });
  if (profiles.length == 0) {
    throw new FrodoError(`No connection profile found matching '${host}'`);
  }
  if (profiles.length > 1) {
    throw new FrodoError(
      `Multiple matching connection profiles found matching '${host}':\n  - ${profiles
        .map((profile) => profile.tenant)
        .join(
          '\n  - '
        )}\nSpecify a sub-string uniquely identifying a single connection profile host URL.`
    );
  }
  delete connectionsData[profiles[0].tenant];
  fs.writeFileSync(filename, JSON.stringify(connectionsData, null, 2));
}

/**
 * Create a new service account using auto-generated parameters
 * @returns {Promise<IdObjectSkeletonInterface>} A promise resolving to a service account object
 */
export async function addNewServiceAccount({
  state,
}: {
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    debugMessage({
      message: `ConnectionProfileOps.addNewServiceAccount: start`,
      state,
    });
    const name = `Frodo-SA-${new Date().getTime()}`;
    debugMessage({
      message: `ConnectionProfileOps.addNewServiceAccount: name=${name}...`,
      state,
    });
    const description = `${state.getUsername()}'s Frodo Service Account`;
    const availableScopes = (await readServiceAccountScopes({
      flatten: true,
      state,
    })) as string[];
    const scope = SERVICE_ACCOUNT_DEFAULT_SCOPES.filter((scope) =>
      availableScopes.includes(scope)
    );
    const jwkPrivate = await createJwkRsa();
    const jwkPublic = await getJwkRsaPublic(jwkPrivate);
    const jwks = createJwks(jwkPublic);
    const sa = await createServiceAccount({
      name,
      description,
      accountStatus: 'active',
      scopes: scope,
      jwks,
      state,
    });
    debugMessage({
      message: `ConnectionProfileOps.addNewServiceAccount: id=${sa._id}`,
      state,
    });
    state.setServiceAccountId(sa._id);
    state.setServiceAccountJwk(jwkPrivate);
    debugMessage({
      message: `ConnectionProfileOps.addNewServiceAccount: end`,
      state,
    });
    return sa;
  } catch (error) {
    throw new FrodoError(`Error creating new service account`, error);
  }
}
