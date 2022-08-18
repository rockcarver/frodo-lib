import fs from 'fs';
import { homedir } from 'os';
import { ConnectionProfile, state } from '../index.js';
import {
  FRODO_CONNECTION_PROFILES_PATH_KEY,
  FRODO_MASTER_KEY_PATH_KEY,
  FRODO_MASTER_KEY_KEY,
} from '../storage/StaticStorage.js';

describe('ConnectionProfileOps.js', () => {
  test('saveConnectionProfile() 1: Create connection profiles in location from state field', async () => {
    const host = 'https://openam-tenant-name.forgeblocks.com/am';
    const user = 'frodo.baggins@shire.me';
    const password = 'G@nd@lfTheW153';
    const connectionProfilePath = `${homedir()}/connections1.json`;

    state.default.session.setTenant(host);
    state.default.session.setUsername(user);
    state.default.session.setPassword(password);
    state.default.session.setConnectionProfilesPath(connectionProfilePath);
    await ConnectionProfile.saveConnectionProfile();
    expect(fs.existsSync(connectionProfilePath)).toBeTruthy();
    const connections = JSON.parse(
      fs.readFileSync(connectionProfilePath, {
        options: 'utf8',
        indentation: 4,
      })
    );
    expect(connections).toBeTruthy();
    expect(connections[host]).toBeTruthy();
    expect(connections[host].username).toEqual(user);
    expect(connections[host].encodedPassword).toBeTruthy();
  });

  test(`saveConnectionProfile() 2: Create connection profiles in location from env ${FRODO_MASTER_KEY_PATH_KEY}`, async () => {
    const host = 'https://openam-tenant-name.forgeblocks.com/am';
    const user = 'frodo.baggins@shire.me';
    const password = 'G@nd@lfTheW153';
    const connectionProfilePath = `${homedir()}/connections2.json`;
    // set the hard-coded master key
    process.env[FRODO_CONNECTION_PROFILES_PATH_KEY] = connectionProfilePath;

    state.default.session.setTenant(host);
    state.default.session.setUsername(user);
    state.default.session.setPassword(password);
    state.default.session.setConnectionProfilesPath(null);
    await ConnectionProfile.saveConnectionProfile();
    expect(ConnectionProfile.getConnectionProfilesPath()).toEqual(
      connectionProfilePath
    );
    expect(fs.existsSync(connectionProfilePath)).toBeTruthy();
    const connections = JSON.parse(
      fs.readFileSync(connectionProfilePath, {
        options: 'utf8',
        indentation: 4,
      })
    );
    expect(connections).toBeTruthy();
    expect(connections[host]).toBeTruthy();
    expect(connections[host].username).toEqual(user);
    expect(connections[host].encodedPassword).toBeTruthy();
  });

  test(`saveConnectionProfile() 3: Use Master Key from env ${FRODO_MASTER_KEY_KEY}`, async () => {
    const host = 'https://openam-tenant-name.forgeblocks.com/am';
    const user = 'frodo.baggins@shire.me';
    const password = 'G@nd@lfTheW153';
    const connectionProfilePath = `${homedir()}/connections3.json`;
    const masterKey = 'bxnQlhcU5VfyDs+BBPhRhK09yHaNtdIIk85HUMKBnqg=';
    // set the hard-coded master key
    process.env[FRODO_MASTER_KEY_KEY] = masterKey;

    state.default.session.setTenant(host);
    state.default.session.setUsername(user);
    state.default.session.setPassword(password);
    state.default.session.setConnectionProfilesPath(connectionProfilePath);
    await ConnectionProfile.saveConnectionProfile();
    expect(fs.existsSync(connectionProfilePath)).toBeTruthy();
    const connections = JSON.parse(
      fs.readFileSync(connectionProfilePath, {
        options: 'utf8',
        indentation: 4,
      })
    );
    expect(connections).toBeTruthy();
    expect(connections[host]).toBeTruthy();
    expect(connections[host].username).toEqual(user);
    expect(connections[host].encodedPassword).toBeTruthy();
  });
});
