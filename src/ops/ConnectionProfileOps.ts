import fs from 'fs';
import os from 'os';
import path from 'path';
import storage from '../storage/SessionStorage';
import DataProtection from './utils/DataProtection';
import { createObjectTable, createTable, printMessage } from './utils/Console';
import { FRODO_CONNECTION_PROFILES_PATH_KEY } from '../storage/StaticStorage';

const dataProtection = new DataProtection();

const fileOptions = {
  indentation: 4,
};

const legacyProfileFilename = '.frodorc';
const newProfileFilename = 'Connections.json';
/**
 * Get connection profiles file name
 * @returns {String} connection profiles file name
 */
export function getConnectionProfilesPath(): string {
  return (
    storage.session.getConnectionProfilesPath() ||
    process.env[FRODO_CONNECTION_PROFILES_PATH_KEY] ||
    `${os.homedir()}/.frodo/${newProfileFilename}`
  );
}

/**
 * Find connection profile
 * @param {Object} connectionProfiles connection profile object
 * @param {String} host tenant host url or unique substring
 * @returns {Object} connection profile object or null
 */
function findConnectionProfile(connectionProfiles, host) {
  const profiles = [];
  for (const tenant in connectionProfiles) {
    if (tenant.includes(host)) {
      const foundProfile = connectionProfiles[tenant];
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
 * @returns {String} connections profile filename
 */
function migrateFromLegacyProfile() {
  const legacyPath = `${os.homedir()}/.frodo/${legacyProfileFilename}`;
  if (fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, `${os.homedir()}/.frodo/${newProfileFilename}`);
    // for now, just add a "deprecated" suffix. May delete the old file
    // in a future release
    fs.renameSync(legacyPath, `${legacyPath}.deprecated`);
  }
  return;
}

/**
 * Initialize connection profiles
 */
export function initConnectionProfiles() {
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
  // encrypt the password from clear text to aes-256-GCM
  else {
    migrateFromLegacyProfile();
    const data = fs.readFileSync(filename, 'utf8');
    const connectionsData = JSON.parse(data);
    let convert = false;
    Object.keys(connectionsData).forEach(async (conn) => {
      if (connectionsData[conn].password) {
        convert = true;
        connectionsData[conn].encodedPassword = await dataProtection.encrypt(
          connectionsData[conn].password
        ); // Buffer.from(connectionsData[conn].password).toString('base64');
        delete connectionsData[conn].password;
      }
    });
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
export async function getConnectionProfileByHost(host) {
  try {
    const filename = getConnectionProfilesPath();
    const connectionsData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const profiles = findConnectionProfile(connectionsData, host);
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
        ? await dataProtection.decrypt(profiles[0].encodedPassword)
        : null,
      key: profiles[0].logApiKey ? profiles[0].logApiKey : null,
      secret: profiles[0].logApiSecret ? profiles[0].logApiSecret : null,
      authenticationService: profiles[0].authenticationService
        ? profiles[0].authenticationService
        : null,
      authenticationHeaderOverrides: profiles[0].authenticationHeaderOverrides
        ? profiles[0].authenticationHeaderOverrides
        : {},
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
export async function getConnectionProfile() {
  return getConnectionProfileByHost(storage.session.getTenant());
}

/**
 * Save connection profile
 */
export async function saveConnectionProfile() {
  const filename = getConnectionProfilesPath();
  printMessage(`Saving creds in ${filename}...`);
  let connectionsData = {};
  let existingData = {};
  try {
    fs.statSync(filename);
    const data = fs.readFileSync(filename, 'utf8');
    connectionsData = JSON.parse(data);
    if (connectionsData[storage.session.getTenant()]) {
      existingData = connectionsData[storage.session.getTenant()];
      printMessage(
        `Updating connection profile ${storage.session.getTenant()}`
      );
    } else
      printMessage(`Adding connection profile ${storage.session.getTenant()}`);
  } catch (e) {
    printMessage(
      `Creating connection profiles file ${filename} with ${storage.session.getTenant()}`
    );
  }
  if (storage.session.getUsername())
    existingData['username'] = storage.session.getUsername();
  if (storage.session.getPassword())
    existingData['encodedPassword'] = await dataProtection.encrypt(
      storage.session.getPassword()
    );
  if (storage.session.getLogApiKey())
    existingData['logApiKey'] = storage.session.getLogApiKey();
  if (storage.session.getLogApiSecret())
    existingData['logApiSecret'] = storage.session.getLogApiSecret();

  // advanced settings
  if (storage.session.getAuthenticationService()) {
    existingData['authenticationService'] =
      storage.session.getAuthenticationService();
    printMessage(
      'Advanced setting: Authentication Service: ' +
        storage.session.getAuthenticationService(),
      'info'
    );
  }
  if (storage.session.getAuthenticationHeaderOverrides()) {
    existingData['authenticationHeaderOverrides'] =
      storage.session.getAuthenticationHeaderOverrides();
    printMessage('Advanced setting: Authentication Header Overrides: ', 'info');
    printMessage(storage.session.getAuthenticationHeaderOverrides(), 'info');
  }

  connectionsData[storage.session.getTenant()] = existingData;

  fs.writeFileSync(filename, JSON.stringify(connectionsData, null, 2));
}

/**
 * Delete connection profile
 * @param {String} host host tenant host url or unique substring
 */
export function deleteConnectionProfile(host) {
  const filename = getConnectionProfilesPath();
  let connectionsData = {};
  fs.stat(filename, (err) => {
    if (err == null) {
      const data = fs.readFileSync(filename, 'utf8');
      connectionsData = JSON.parse(data);
      const profiles = findConnectionProfile(connectionsData, host);
      if (profiles.length == 1) {
        printMessage(`Deleting connection profile ${profiles[0].tenant}`);
        delete connectionsData[profiles[0].tenant];
        fs.writeFileSync(filename, JSON.stringify(connectionsData, null, 2));
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

export async function describeConnectionProfile(host, showSecrets) {
  const profile = await getConnectionProfileByHost(host);
  if (profile) {
    if (!showSecrets) {
      delete profile.password;
      delete profile.secret;
    }
    if (!profile.key) {
      delete profile.key;
      delete profile.secret;
    }
    const keyMap = {
      tenant: 'Host',
      username: 'Username',
      password: 'Password',
      key: 'Log API Key',
      secret: 'Log API Secret',
      authenticationService: 'Authentication Service',
      authenticationHeaderOverrides: 'Authentication Header Overrides',
    };
    const table = createObjectTable(profile, keyMap);
    printMessage(table.toString(), 'data');
  } else {
    printMessage(`No connection profile ${host} found`);
  }
}
