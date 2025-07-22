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
import { FrodoError, state } from '../index';
import * as ConnectionProfileOps from './ConnectionProfileOps';
import Constants from '../shared/Constants';

const exampleHost = 'https://openam-tenant-name.forgeblocks.com/am';
const exampleUsername = 'frodo.baggins@shire.me';
const examplePassword = 'G@nd@lfTheW153';
const exampleConnectionProfile = {
  tenant: exampleHost,
  username: exampleUsername,
  encodedPassword: examplePassword,
  allowInsecureConnection: false,
  deploymentType: 'classic',
};

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

  beforeEach(() => {
    fs.writeFileSync(connectionProfilePath1, JSON.stringify({}));
    fs.writeFileSync(connectionProfilePath2, JSON.stringify({}));
    fs.writeFileSync(connectionProfilePath3, JSON.stringify({}));
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

  describe('findConnectionProfiles()', () => {
    test.only('1: Find connection profile by alias', async () => {
      const tenant = exampleHost
      const alias = 'unique-alias';
      const host = alias;
      const connectionProfiles = {
        [tenant]: {
          ...exampleConnectionProfile,
          alias,
        },
      };
      fs.writeFileSync(
        connectionProfilePath1,
        JSON.stringify(connectionProfiles, null, 2)
      );

      const connections = ConnectionProfileOps.findConnectionProfiles({
        connectionProfiles,
        host,
        state,
      });
      expect(connections).toHaveLength(1);
      expect(connections[0].tenant).toBe(tenant);
      expect(connections[0].alias).toBe(alias);
    });

    test('2: Default to substring matching after failing to find connection profile by alias', async () => {
      const tenant = exampleHost;
      const host = 'name';
      const connectionProfiles = {
        [tenant]: {
          ...exampleConnectionProfile,
        },
      };
      fs.writeFileSync(
        connectionProfilePath1,
        JSON.stringify(connectionProfiles, null, 2)
      );

      const connections = ConnectionProfileOps.findConnectionProfiles({
        connectionProfiles,
        host,
        state,
      });
      expect(connections).toHaveLength(1);
      expect(connections[0].tenant).toBe(tenant);
    });

    test('3: Fail to find a match by alias or substring', async () => {
      const host = 'nonexistent'
      const tenant = exampleHost;
      const connectionProfiles = {
        [tenant]: {
          ...exampleConnectionProfile,
        },
      };
      fs.writeFileSync(
        connectionProfilePath1,
        JSON.stringify(connectionProfiles, null, 2)
      );

      const connections = ConnectionProfileOps.findConnectionProfiles({
        connectionProfiles,
        host,
        state,
      });
      expect(connections).toHaveLength(0);
    });
  });

  describe('saveConnectionProfile()', () => {
    test('1: Create connection profiles in location from state field', async () => {
      const host = exampleHost;
      const user = exampleUsername;
      const password = examplePassword;

      state.setHost(host);
      state.setDeploymentType(Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY);
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
      expect(connections[host].username).toEqual(user);
      expect(connections[host].encodedPassword).toBeTruthy();
    });

    test(`2: Create connection profiles in location from env ${Constants.FRODO_MASTER_KEY_PATH_KEY}`, async () => {
      const host = exampleHost;
      const user = exampleUsername;
      const password = examplePassword;
      // set the hard-coded master key
      process.env[Constants.FRODO_CONNECTION_PROFILES_PATH_KEY] =
        connectionProfilePath2;

      state.setHost(host);
      state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
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
      expect(connections[host].username).toEqual(user);
      expect(connections[host].encodedPassword).toBeTruthy();
    });

    test(`3: Use Master Key from env ${Constants.FRODO_MASTER_KEY_KEY}`, async () => {
      const host = exampleHost;
      const user = exampleUsername;
      const password = examplePassword;
      const masterKey = 'bxnQlhcU5VfyDs+BBPhRhK09yHaNtdIIk85HUMKBnqg=';
      // set the hard-coded master key
      process.env[Constants.FRODO_MASTER_KEY_KEY] = masterKey;

      state.setHost(host);
      state.setDeploymentType(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
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
      expect(connections[host].username).toEqual(user);
      expect(connections[host].encodedPassword).toBeTruthy();
    });

    test(`4: Save a new connection with a unique alias`, async () => {
      const host = exampleHost;
      const alias = 'unique-alias';
      const user = exampleUsername;
      const password = examplePassword;

      state.setConnectionProfilesPath(connectionProfilePath1);
      state.setHost(host);
      state.setAlias(alias);
      state.setUsername(user);
      state.setPassword(password);
      state.setDeploymentType(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
      await ConnectionProfileOps.saveConnectionProfile({ host, state });
      const connections = JSON.parse(
        fs.readFileSync(connectionProfilePath1, 'utf8')
      );
      expect(connections[host]).toBeTruthy();
      expect(connections[host].alias).toEqual(alias);
      expect(connections[host].username).toEqual(user);
      expect(connections[host].encodedPassword).toBeTruthy();
    });

    test(`5: Fail to save a new connection with a conflicting alias`, async () => {
      const host1 = 'https://openam-tenant1.forgeblocks.com/am';
      const host2 = 'https://openam-tenant2.forgeblocks.com/am';
      const alias = 'conflicting-alias';
      const user = exampleUsername;
      const password = examplePassword;

      state.setConnectionProfilesPath(connectionProfilePath1);
      state.setHost(host1);
      state.setAlias(alias);
      state.setUsername(user);
      state.setPassword(password);
      state.setDeploymentType(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
      await ConnectionProfileOps.saveConnectionProfile({ host: host1, state });

      state.setHost(host2);
      state.setAlias(alias);
      state.setUsername(user);
      state.setPassword(password);
      state.setDeploymentType(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);

      try {
        await ConnectionProfileOps.saveConnectionProfile({
          host: host2,
          state,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(FrodoError);
        const error = e as FrodoError;
        expect(error.message).toBe('Error saving connection profile');
        expect(error.originalErrors[0]?.message).toBe(
          `Alias '${alias}' is already in use by connection profile '${host1}'. Please use a unique alias.`
        );
      }
      expect.assertions(3);
    });
  });

  describe('setConnectionProfileAlias()', () => {
    test(`1: Set unique alias for existing connection profile`, async () => {
      const host = exampleHost;
      const alias = 'unique-alias';
      const connectionProfile = {
        [host]: {
          ...exampleConnectionProfile,
        },
      };
      fs.writeFileSync(
        connectionProfilePath1,
        JSON.stringify(connectionProfile, null, 2)
      );

      state.setConnectionProfilesPath(connectionProfilePath1);
      state.setHost(host);
      state.setAlias(alias);
      await ConnectionProfileOps.setConnectionProfileAlias({
        host,
        alias,
        state,
      });
      const connections = JSON.parse(
        fs.readFileSync(connectionProfilePath1, 'utf8')
      );
      expect(connections[host]).toBeTruthy();
      expect(connections[host].alias).toEqual(alias);
    });

    test(`2: Fail to set a conflicting alias to an existing connection profile`, async () => {
      const host1 = 'https://openam-tenant1.forgeblocks.com/am';
      const host2 = 'https://openam-tenant2.forgeblocks.com/am';
      const alias = 'conflicting-alias';

      const connectionProfiles = {
        [host1]: {
          ...exampleConnectionProfile,
          tenant: host1,
        },
        [host2]: {
          ...exampleConnectionProfile,
          tenant: host2,
        },
      };
      fs.writeFileSync(
        connectionProfilePath1,
        JSON.stringify(connectionProfiles, null, 2)
      );

      state.setConnectionProfilesPath(connectionProfilePath1);
      state.setHost(host1);
      state.setAlias(alias);
      await ConnectionProfileOps.setConnectionProfileAlias({
        host: host1,
        alias,
        state,
      });

      state.setHost(host2);
      try {
        await ConnectionProfileOps.setConnectionProfileAlias({
          host: host2,
          alias,
          state,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(FrodoError);
        const error = e as FrodoError;
        expect(error.message).toBe(
          `Alias '${alias}' is already in use by connection profile '${host1}'. Please use a unique alias.`
        );
      }
      expect.assertions(2);
    });
  });

  describe('deleteConnectionProfileAlias()', () => {
    test(`1: Delete the alias of an existing connection profile`, async () => {
      const host = exampleHost;
      const alias = 'unique-alias';

      const connectionProfile = {
        [host]: {
          ...exampleConnectionProfile,
          alias: alias,
        },
      };
      fs.writeFileSync(
        connectionProfilePath1,
        JSON.stringify(connectionProfile, null, 2)
      );

      state.setConnectionProfilesPath(connectionProfilePath1);
      state.setHost(host);
      await ConnectionProfileOps.deleteConnectionProfileAlias({
        host,
        state,
      });
      const connections = JSON.parse(
        fs.readFileSync(connectionProfilePath1, 'utf8')
      );
      expect(connections[host]).toBeTruthy();
      expect(connections[host].alias).toBeUndefined();
    });

    test(`2: Fail to delete the nonexistent alias of an exisiting connection profile`, async () => {
      const host = exampleHost;
      const connectionProfile = {
        [host]: {
          ...exampleConnectionProfile,
        },
      };
      fs.writeFileSync(
        connectionProfilePath1,
        JSON.stringify(connectionProfile, null, 2)
      );

      state.setConnectionProfilesPath(connectionProfilePath1);
      state.setHost(host);
      try {
        await ConnectionProfileOps.deleteConnectionProfileAlias({
          host,
          state,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(FrodoError);
        const error = e as FrodoError;
        expect(error.message).toBe(
          `No alias is set for connection profile '${host}'`
        );
      }
      expect.assertions(2);
    });
  });
});
