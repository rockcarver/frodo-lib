import fs from 'fs';
import os from 'os';
import path from 'path';
import storage from '../storage/SessionStorage';
import DataProtection from './utils/DataProtection';
import {
  createObjectTable,
  createTable,
  debugMessage,
  printMessage,
  verboseMessage,
} from './utils/Console';
import { FRODO_CONNECTION_PROFILES_PATH_KEY } from '../storage/StaticStorage';
import { createJwkRsa, createJwks, getJwkRsaPublic, JwkRsa } from './JoseOps';
import { createServiceAccount } from './ServiceAccountOps';
import { ObjectSkeletonInterface } from '../api/ApiTypes';
import { saveJsonToFile } from './utils/ExportImportUtils';
import { isValidUrl } from './utils/OpsUtils';

const {
  getAuthenticationService,
  getAuthenticationHeaderOverrides,
  getConnectionProfilesPath: _getConnectionProfilesPath,
  getLogApiKey,
  getLogApiSecret,
  getPassword,
  getServiceAccountId,
  setServiceAccountId,
  getServiceAccountJwk,
  setServiceAccountJwk,
  getTenant,
  setTenant,
  getUsername,
} = storage.session;

const crypto = new DataProtection();

const fileOptions = {
  indentation: 4,
};

export interface SecureConnectionProfileInterface {
  tenant: string;
  username?: string | null;
  encodedPassword?: string | null;
  logApiKey?: string | null;
  encodedLogApiSecret?: string | null;
  authenticationService?: string | null;
  authenticationHeaderOverrides?: Record<string, string>;
  svcacctId?: string | null;
  encodedSvcacctJwk?: string | null;
  svcacctName?: string | null;
}

export interface ConnectionProfileInterface {
  tenant: string;
  username?: string | null;
  password?: string | null;
  logApiKey?: string | null;
  logApiSecret?: string | null;
  authenticationService?: string | null;
  authenticationHeaderOverrides?: Record<string, string>;
  svcacctId?: string | null;
  svcacctJwk?: JwkRsa;
  svcacctName?: string | null;
}

export interface ConnectionsFileInterface {
  [key: string]: SecureConnectionProfileInterface;
}

const legacyProfileFilename = '.frodorc';
const newProfileFilename = 'Connections.json';

/**
 * Get connection profiles file name
 * @returns {String} connection profiles file name
 */
export function getConnectionProfilesPath(): string {
  return (
    _getConnectionProfilesPath() ||
    process.env[FRODO_CONNECTION_PROFILES_PATH_KEY] ||
    `${os.homedir()}/.frodo/${newProfileFilename}`
  );
}

/**
 * Find connection profiles
 * @param {ConnectionsFileInterface} connectionProfiles connection profile object
 * @param {string} host host url or unique substring
 * @returns {SecureConnectionProfileInterface[]} Array of connection profiles
 */
function findConnectionProfiles(
  connectionProfiles: ConnectionsFileInterface,
  host: string
): SecureConnectionProfileInterface[] {
  const profiles: SecureConnectionProfileInterface[] = [];
  for (const tenant in connectionProfiles) {
    if (tenant.includes(host)) {
      const foundProfile = { ...connectionProfiles[tenant] };
      foundProfile.tenant = tenant;
      profiles.push(foundProfile);
    }
  }
  return profiles;
}

/**
 * List connection profiles
 * @param {boolean} long Long list format with details
 */
export function listConnectionProfiles(long = false) {
  const filename = getConnectionProfilesPath();
  try {
    const data = fs.readFileSync(filename, 'utf8');
    const connectionsData = JSON.parse(data);
    if (long) {
      const table = createTable(['Host', 'Username', 'Log API Key']);
      Object.keys(connectionsData).forEach((c) => {
        table.push([
          c,
          connectionsData[c].username,
          connectionsData[c].logApiKey,
        ]);
      });
      printMessage(table.toString(), 'data');
    } else {
      Object.keys(connectionsData).forEach((c) => {
        printMessage(`${c}`, 'data');
      });
    }
    printMessage(
      'Any unique substring of a saved host can be used as the value for host parameter in all commands',
      'info'
    );
  } catch (e) {
    printMessage(`No connections found in ${filename} (${e.message})`, 'error');
  }
}

/**
 * Migrate from .frodorc to Connections.json
 */
function migrateFromLegacyProfile() {
  const legacyPath = `${os.homedir()}/.frodo/${legacyProfileFilename}`;
  if (fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, `${os.homedir()}/.frodo/${newProfileFilename}`);
    // for now, just add a "deprecated" suffix. May delete the old file
    // in a future release
    fs.renameSync(legacyPath, `${legacyPath}.deprecated`);
  }
}

/**
 * Initialize connection profiles
 *
 * This method is called from app.ts and runs before any of the message handlers are registered.
 * Therefore none of the Console message functions will produce any output.
 */
export async function initConnectionProfiles() {
  // create connections.json file if it doesn't exist
  const filename = getConnectionProfilesPath();
  const folderName = path.dirname(filename);
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
    if (!fs.existsSync(filename)) {
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
        connectionsData[conn].encodedPassword = await crypto.encrypt(
          connectionsData[conn]['password']
        );
        delete connectionsData[conn]['password'];
      }
      if (connectionsData[conn]['logApiSecret']) {
        convert = true;
        connectionsData[conn].encodedLogApiSecret = await crypto.encrypt(
          connectionsData[conn]['logApiSecret']
        );
        delete connectionsData[conn]['logApiSecret'];
      }
      if (connectionsData[conn]['svcacctJwk']) {
        convert = true;
        connectionsData[conn].encodedSvcacctJwk = await crypto.encrypt(
          connectionsData[conn]['svcacctJwk']
        );
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
}

/**
 * Get connection profile by host
 * @param {String} host host tenant host url or unique substring
 * @returns {Object} connection profile or null
 */
export async function getConnectionProfileByHost(
  host: string
): Promise<ConnectionProfileInterface> {
  try {
    const filename = getConnectionProfilesPath();
    const connectionsData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const profiles = findConnectionProfiles(connectionsData, host);
    if (profiles.length == 0) {
      printMessage(
        `Profile for ${host} not found. Please specify credentials on command line`,
        'error'
      );
      return null;
    }
    if (profiles.length > 1) {
      printMessage(`Multiple matching profiles found.`, 'error');
      profiles.forEach((p) => {
        printMessage(`- ${p.tenant}`, 'error');
      });
      printMessage(`Please specify a unique sub-string`, 'error');
      return null;
    }
    return {
      tenant: profiles[0].tenant,
      username: profiles[0].username ? profiles[0].username : null,
      password: profiles[0].encodedPassword
        ? await crypto.decrypt(profiles[0].encodedPassword)
        : null,
      logApiKey: profiles[0].logApiKey ? profiles[0].logApiKey : null,
      logApiSecret: profiles[0].encodedLogApiSecret
        ? await crypto.decrypt(profiles[0].encodedLogApiSecret)
        : null,
      authenticationService: profiles[0].authenticationService
        ? profiles[0].authenticationService
        : null,
      authenticationHeaderOverrides: profiles[0].authenticationHeaderOverrides
        ? profiles[0].authenticationHeaderOverrides
        : {},
      svcacctId: profiles[0].svcacctId ? profiles[0].svcacctId : null,
      svcacctJwk: profiles[0].encodedSvcacctJwk
        ? await crypto.decrypt(profiles[0].encodedSvcacctJwk)
        : null,
    };
  } catch (e) {
    printMessage(
      `Can not read saved connection info, please specify credentials on command line: ${e}`,
      'error'
    );
    return null;
  }
}

/**
 * Get connection profile
 * @returns {Object} connection profile or null
 */
export async function getConnectionProfile(): Promise<ConnectionProfileInterface> {
  return getConnectionProfileByHost(getTenant());
}

/**
 * Save connection profile
 * @param {string} host host url for new profiles or unique substring for existing profiles
 * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
 */
export async function saveConnectionProfile(host: string): Promise<boolean> {
  const filename = getConnectionProfilesPath();
  verboseMessage(`Saving connection profile in ${filename}`);
  let profiles: ConnectionsFileInterface = {};
  let profile: SecureConnectionProfileInterface = { tenant: '' };
  try {
    fs.statSync(filename);
    const data = fs.readFileSync(filename, 'utf8');
    profiles = JSON.parse(data);

    // find tenant
    const found = findConnectionProfiles(profiles, host);

    // replace tenant in session with real tenant url if necessary
    if (found.length === 1) {
      profile = found[0];
      setTenant(profile.tenant);
      verboseMessage(`Existing profile: ${profile.tenant}`);
    }

    // connection profile not found, validate host is a real URL
    if (found.length === 0) {
      if (isValidUrl(host)) {
        setTenant(host);
        verboseMessage(`New profile: ${host}`);
      } else {
        printMessage(
          `No existing profile found matching '${host}'. Provide a valid URL as the host argument to create a new profile.`,
          'error'
        );
        return false;
      }
    }
  } catch (error) {
    verboseMessage(`New profiles file ${filename} with new profile ${host}`);
  }

  // user account
  if (getUsername()) profile.username = getUsername();
  if (getPassword())
    profile.encodedPassword = await crypto.encrypt(getPassword());

  // log API
  if (getLogApiKey()) profile.logApiKey = getLogApiKey();
  if (getLogApiSecret())
    profile.encodedLogApiSecret = await crypto.encrypt(getLogApiSecret());

  // service account
  if (getServiceAccountId()) profile.svcacctId = getServiceAccountId();
  if (getServiceAccountJwk())
    profile.encodedSvcacctJwk = await crypto.encrypt(getServiceAccountJwk());

  // advanced settings
  if (getAuthenticationService()) {
    profile.authenticationService = getAuthenticationService();
    printMessage(
      'Advanced setting: Authentication Service: ' + getAuthenticationService(),
      'info'
    );
  }
  if (
    getAuthenticationHeaderOverrides() &&
    Object.entries(getAuthenticationHeaderOverrides()).length
  ) {
    profile.authenticationHeaderOverrides = getAuthenticationHeaderOverrides();
    printMessage('Advanced setting: Authentication Header Overrides: ', 'info');
    printMessage(getAuthenticationHeaderOverrides(), 'info');
  }

  // remove the helper key 'tenant'
  delete profile.tenant;

  // update profiles
  profiles[getTenant()] = profile;

  // sort profiles
  const orderedProfiles = Object.keys(profiles)
    .sort()
    .reduce((obj, key) => {
      obj[key] = profiles[key];
      return obj;
    }, {});

  // save profiles
  saveJsonToFile(orderedProfiles, filename, false);
  verboseMessage(`Saved connection profile ${getTenant()} in ${filename}`);
  return true;
}

/**
 * Delete connection profile
 * @param {String} host host tenant host url or unique substring
 */
export function deleteConnectionProfile(host) {
  const filename = getConnectionProfilesPath();
  let connectionsData: ConnectionsFileInterface = {};
  fs.stat(filename, (err) => {
    if (err == null) {
      const data = fs.readFileSync(filename, 'utf8');
      connectionsData = JSON.parse(data);
      const profiles = findConnectionProfiles(connectionsData, host);
      if (profiles.length == 1) {
        delete connectionsData[profiles[0].tenant];
        fs.writeFileSync(filename, JSON.stringify(connectionsData, null, 2));
        printMessage(`Deleted connection profile ${profiles[0].tenant}`);
      } else {
        if (profiles.length > 1) {
          printMessage(`Multiple matching profiles found.`, 'error');
          profiles.forEach((p) => {
            printMessage(`- ${p.tenant}`, 'error');
          });
          printMessage(`Please specify a unique sub-string`, 'error');
          return null;
        } else {
          printMessage(`No connection profile ${host} found`);
        }
      }
    } else if (err.code === 'ENOENT') {
      printMessage(`Connection profile file ${filename} not found`);
    } else {
      printMessage(
        `Error in deleting connection profile: ${err.code}`,
        'error'
      );
    }
  });
}

/**
 * Describe connection profile
 * @param {string} host Host URL or unique substring
 * @param {boolean} showSecrets Whether secrets should be shown in clear text or not
 */
export async function describeConnectionProfile(
  host: string,
  showSecrets: boolean
) {
  const profile = await getConnectionProfileByHost(host);
  if (profile) {
    const present = '[present]';
    const jwk = profile.svcacctJwk;
    if (!showSecrets) {
      if (profile.password) profile.password = present;
      if (profile.logApiSecret) profile.logApiSecret = present;
      if (profile.svcacctJwk) (profile as unknown)['svcacctJwk'] = present;
    }
    if (!profile.username) {
      delete profile.username;
      delete profile.password;
    }
    if (!profile.logApiKey) {
      delete profile.logApiKey;
      delete profile.logApiSecret;
    }
    if (!profile.svcacctId) {
      delete profile.svcacctId;
      delete profile.svcacctJwk;
    }
    if (showSecrets && jwk) {
      (profile as unknown)['svcacctJwk'] = 'see below';
    }
    if (!profile.authenticationService) {
      delete profile.authenticationService;
    }
    const keyMap = {
      tenant: 'Host',
      username: 'Username',
      password: 'Password',
      logApiKey: 'Log API Key',
      logApiSecret: 'Log API Secret',
      authenticationService: 'Authentication Service',
      authenticationHeaderOverrides: 'Authentication Header Overrides',
      svcacctId: 'Service Account Id',
      svcacctJwk: 'Service Account JWK',
    };
    const table = createObjectTable(profile, keyMap);
    printMessage(table.toString(), 'data');
    if (showSecrets && jwk) {
      printMessage(jwk, 'data');
    }
  } else {
    printMessage(`No connection profile ${host} found`);
  }
}

/**
 * Create a new service account using auto-generated parameters
 * @returns {Promise<ObjectSkeletonInterface>} A promise resolving to a service account object
 */
export async function addNewServiceAccount(): Promise<ObjectSkeletonInterface> {
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: start`);
  const name = `Frodo-SA-${new Date().getTime()}`;
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: name=${name}...`);
  const description = `${getUsername()}'s Frodo Service Account`;
  const scope = ['fr:am:*', 'fr:idm:*', 'fr:idc:esv:*'];
  const jwkPrivate = await createJwkRsa();
  const jwkPublic = await getJwkRsaPublic(jwkPrivate);
  const jwks = createJwks(jwkPublic);
  const sa = await createServiceAccount(
    name,
    description,
    'Active',
    scope,
    jwks
  );
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: id=${sa._id}`);
  setServiceAccountId(sa._id);
  setServiceAccountJwk(jwkPrivate);
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: end`);
  return sa;
}
