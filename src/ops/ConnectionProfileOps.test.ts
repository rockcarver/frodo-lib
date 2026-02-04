/**
 * Run tests
 *
 *        npm run test:only ConnectionProfileOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import fs from 'fs';
import { homedir } from 'os';
import { state } from '../index';
import * as ConnectionProfileOps from './ConnectionProfileOps';
import Constants from '../shared/Constants';

describe('ConnectionProfileOps', () => {
  const connectionProfilePath1 = `${homedir()}/connections1.json`;
  const connectionProfilePath2 = `${homedir()}/connections2.json`;
  const connectionProfilePath3 = `${homedir()}/connections3.json`;

  // delete all connection profile files before running the tests
  beforeAll(() => {
    try {
      fs.unlinkSync(connectionProfilePath1);
    } catch (error) {
      // ignore
    }
    try {
      fs.unlinkSync(connectionProfilePath2);
    } catch (error) {
      // ignore
    }
    try {
      fs.unlinkSync(connectionProfilePath3);
    } catch (error) {
      // ignore
    }
  });

  // clean up all connection profile files after running the tests
  afterAll(() => {
    try {
      fs.unlinkSync(connectionProfilePath1);
    } catch (error) {
      // ignore
    }
    try {
      fs.unlinkSync(connectionProfilePath2);
    } catch (error) {
      // ignore
    }
    try {
      fs.unlinkSync(connectionProfilePath3);
    } catch (error) {
      // ignore
    }
  });

  describe('saveConnectionProfile()', () => {
    test('1: Create connection profiles in location from state field', async () => {
      const host = 'https://openam-tenant-name.forgeblocks.com/am';
      const user = 'frodo.baggins@shire.me';
      const password = 'G@nd@lfTheW153';

      state.setHost(host);
      state.setDeploymentType(Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY);
      // Even though IGA is not part of forgeops deployments, we want to check it is not set to the connection profile
      state.setIsIGA(true);
      state.setUsername(user);
      state.setPassword(password);
      state.setConnectionProfilesPath(connectionProfilePath1);
      await ConnectionProfileOps.saveConnectionProfile({ host, state });
      expect(fs.existsSync(connectionProfilePath1)).toBeTruthy();
      const connections = JSON.parse(
        fs.readFileSync(connectionProfilePath1, 'utf8')
      );
      expect(connections).toBeTruthy();
      expect(connections[host]).toBeTruthy();
      expect(connections[host].deploymentType).toEqual(
        Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY
      );
      expect(connections[host].isIGA).toBeUndefined();
      expect(connections[host].username).toEqual(user);
      expect(connections[host].encodedPassword).toBeTruthy();
    });

    test(`2: Create connection profiles in location from env ${Constants.FRODO_MASTER_KEY_PATH_KEY}`, async () => {
      const host = 'https://openam-tenant-name.forgeblocks.com/am';
      const user = 'frodo.baggins@shire.me';
      const password = 'G@nd@lfTheW153';
      // set the hard-coded master key
      process.env[Constants.FRODO_CONNECTION_PROFILES_PATH_KEY] =
        connectionProfilePath2;

      state.setHost(host);
      state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
      state.setIsIGA(true);
      state.setUsername(user);
      state.setPassword(password);
      state.setConnectionProfilesPath('');
      await ConnectionProfileOps.saveConnectionProfile({ host, state });
      expect(ConnectionProfileOps.getConnectionProfilesPath({ state })).toEqual(
        connectionProfilePath2
      );
      expect(fs.existsSync(connectionProfilePath2)).toBeTruthy();
      const connections: ConnectionProfileOps.ConnectionsFileInterface =
        JSON.parse(fs.readFileSync(connectionProfilePath2, 'utf8'));
      expect(connections).toBeTruthy();
      expect(connections[host]).toBeTruthy();
      expect(connections[host].deploymentType).toEqual(
        Constants.CLOUD_DEPLOYMENT_TYPE_KEY
      );
      expect(connections[host].isIGA).toEqual(true);
      expect(connections[host].username).toEqual(user);
      expect(connections[host].encodedPassword).toBeTruthy();
    });

    test(`3: Use Master Key from env ${Constants.FRODO_MASTER_KEY_KEY}`, async () => {
      const host = 'https://openam-tenant-name.forgeblocks.com/am';
      const user = 'frodo.baggins@shire.me';
      const password = 'G@nd@lfTheW153';
      const masterKey = 'bxnQlhcU5VfyDs+BBPhRhK09yHaNtdIIk85HUMKBnqg=';
      // set the hard-coded master key
      process.env[Constants.FRODO_MASTER_KEY_KEY] = masterKey;

      state.setHost(host);
      state.setDeploymentType(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
      // Even though IGA is not part of classic deployments, we want to check it is not set to the connection profile
      state.setIsIGA(false);
      state.setUsername(user);
      state.setPassword(password);
      state.setConnectionProfilesPath(connectionProfilePath3);
      await ConnectionProfileOps.saveConnectionProfile({ host, state });
      expect(fs.existsSync(connectionProfilePath3)).toBeTruthy();
      const connections = JSON.parse(
        fs.readFileSync(connectionProfilePath3, 'utf8')
      );
      expect(connections).toBeTruthy();
      expect(connections[host]).toBeTruthy();
      expect(connections[host].deploymentType).toEqual(
        Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
      );
      expect(connections[host].isIGA).toBeUndefined();
      expect(connections[host].username).toEqual(user);
      expect(connections[host].encodedPassword).toBeTruthy();
    });
  });
});
