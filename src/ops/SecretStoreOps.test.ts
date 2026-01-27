/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    Recording requires an available classic deployment, since secret stores
 *    can only be accessed in classic. Set FRODO_HOST and FRODO_REALM
 *    environment variables or alternatively FRODO_DEPLOY=classic
 *    in order to appropriately record requests to the classic deployment.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record SecretStoreOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update SecretStoreOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only SecretStoreOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly, setDefaultState } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as SecretStoreOps from "./SecretStoreOps";
import { state } from "../lib/FrodoLib";
import Constants from "../shared/Constants";
import { snapshotResultCallback } from "../test/utils/TestUtils";
import { SecretStoreMappingSkeleton } from "../api/SecretStoreApi";
import { SecretStoreExportInterface } from "./SecretStoreOps";

const ctx = autoSetupPolly();

describe('SecretStoreOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
    setDefaultState(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
  });

  describe('createSecretStoreExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretStoreOps.createSecretStoreExportTemplate).toBeDefined();
    });

    test('1: Create SecretStore Export Template', async () => {
      const response = SecretStoreOps.createSecretStoreExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('Cloud Tests', () => {
      const CLOUD_MAPPING_1: SecretStoreMappingSkeleton = {
        _id: 'am.services.oauth2.oidc.signing.EDDSA',
        secretId: 'am.services.oauth2.oidc.signing.EDDSA',
        aliases: [
          'esv-test-signing-cert'
        ]
      }

      beforeEach(() => {
        setDefaultState();
      });
      
      afterAll(async () => {
        await SecretStoreOps.deleteSecretStoreMapping({
          secretStoreId: 'ESV',
          secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
          secretId: CLOUD_MAPPING_1.secretId,
          globalConfig: false,
          state,
        });
      });

      describe('createSecretStoreMapping()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.createSecretStoreMapping).toBeDefined();
        });
        test('1: Create secret store mapping', async () => {
          try {
            await SecretStoreOps.deleteSecretStoreMapping({
              secretStoreId: 'ESV',
              secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
              secretId: CLOUD_MAPPING_1.secretId,
              globalConfig: false,
              state,
            });
          } catch (e) { /* Ignore error */ }
          const response = await SecretStoreOps.createSecretStoreMapping({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            secretStoreMappingData: CLOUD_MAPPING_1,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readSecretStore()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.readSecretStore).toBeDefined();
        });

        test('1: Read ESV secret store', async () => {
          const response = await SecretStoreOps.readSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readSecretStoreSchema()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.readSecretStoreSchema).toBeDefined();
        });

        test('1: Read ESV secret store schema', async () => {
          const response = await SecretStoreOps.readSecretStoreSchema({
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    
      describe('readSecretStores()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.readSecretStores).toBeDefined();
        });
    
        test('1: Read realm SecretStores', async () => {
          const response = await SecretStoreOps.readSecretStores({ globalConfig: false, state });
          expect(response).toMatchSnapshot();
        });
    
        test('2: Read global SecretStores', async () => {
          await expect(SecretStoreOps.readSecretStores({ globalConfig: true, state })).rejects.toThrow('Error reading alpha realm secret stores');
        });
      });

      describe('readSecretStoreMapping()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.readSecretStoreMapping).toBeDefined();
        });
    
        test('1: Read ESV secret store mapping', async () => {
          try {
            await SecretStoreOps.createSecretStoreMapping({
              secretStoreId: 'ESV',
              secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
              secretStoreMappingData: CLOUD_MAPPING_1,
              globalConfig: false,
              state,
            });
          } catch (e) {/* Ignore error since it means it already exists */}
          const response = await SecretStoreOps.readSecretStoreMapping({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            secretId: CLOUD_MAPPING_1.secretId,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readSecretStoreMappings()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.readSecretStoreMappings).toBeDefined();
        });

        test('1: Read ESV secret store mappings', async () => {
          const response = await SecretStoreOps.readSecretStoreMappings({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    
      describe('exportSecretStore()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.exportSecretStore).toBeDefined();
        });
        test('1: Export ESV secret store', async () => {
          const response = await SecretStoreOps.exportSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });
    
      describe('exportSecretStores()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.exportSecretStores).toBeDefined();
        });
    
        test('1: Export realm SecretStores', async () => {
          const response = await SecretStoreOps.exportSecretStores({ globalConfig: false, resultCallback: snapshotResultCallback, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
    
        test('2: Export global SecretStores', async () => {
          await expect(SecretStoreOps.exportSecretStores({ globalConfig: true, state })).rejects.toThrow('Error reading alpha realm secret stores');
        });
      });
    
      describe('updateSecretStore()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.updateSecretStore).toBeDefined();
        });
        test('1: Unable to update ESV secret store', async () => {
          const esvSecretStore = await SecretStoreOps.exportSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          const secretStoreData = {...esvSecretStore.secretstore.ESV}
          delete secretStoreData.mappings;
          secretStoreData.expiryDurationSeconds = 599;
          await expect(SecretStoreOps.updateSecretStore({
            secretStoreData,
            globalConfig: true,
            state,
          })).rejects.toThrow('Request failed with status code 403');
        });
      });
    
      describe('updateSecretStoreMapping()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.updateSecretStoreMapping).toBeDefined();
        });
        test('1: Update ESV secret store mapping', async () => {
          try {
            await SecretStoreOps.createSecretStoreMapping({
              secretStoreId: 'ESV',
              secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
              secretStoreMappingData: CLOUD_MAPPING_1,
              globalConfig: false,
              state,
            });
          } catch (e) {/* Ignore error since it means it already exists */}
          const secretStoreMappingData = {...CLOUD_MAPPING_1}
          secretStoreMappingData.aliases = ['esv-test'];
          const response = await SecretStoreOps.updateSecretStoreMapping({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            secretStoreMappingData: secretStoreMappingData,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    
      describe('importSecretStores()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.importSecretStores).toBeDefined();
        });
        test('1: Import ESV secret store', async () => {
          const secretStore = await SecretStoreOps.exportSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          const response = await SecretStoreOps.importSecretStores({
            importData: secretStore,
            globalConfig: false,
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            resultCallback: snapshotResultCallback,
            state,
          });
          expect(response).toMatchSnapshot();
        })
      });

      describe('deleteSecretStore()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.deleteSecretStore).toBeDefined();
        });
        test('1: Fail to delete ESV secret store', async () => {
          await expect(SecretStoreOps.deleteSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          })).rejects.toThrow('Delete operation is not available in PingOne Advanced Identity Cloud.');
        });
      });

      describe('deleteSecretStores()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.deleteSecretStores).toBeDefined();
        });
        test('1: Fail to delete secret stores', async () => {
          await expect(SecretStoreOps.deleteSecretStores({
            globalConfig: false,
            state,
          })).rejects.toThrow('Delete operation is not available in PingOne Advanced Identity Cloud.');
        });
      });

      describe('deleteSecretStoreMapping()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.deleteSecretStoreMapping).toBeDefined();
        });
        test('1: Delete ESV secret store mapping', async () => {
          try {
            await SecretStoreOps.createSecretStoreMapping({
              secretStoreId: 'ESV',
              secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
              secretStoreMappingData: CLOUD_MAPPING_1,
              globalConfig: false,
              state,
            });
          } catch (e) {/* Ignore error since it means it already exists */}
          const response = await SecretStoreOps.deleteSecretStoreMapping({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            secretId: CLOUD_MAPPING_1.secretId,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('deleteSecretStoreMappings()', () => {
        test('0: Method is implemented', async () => {
          expect(SecretStoreOps.deleteSecretStoreMappings).toBeDefined();
        });
        test('0: Delete ESV secret store mappings', async () => {
          const esvSecretStore = await SecretStoreOps.exportSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          const response = await SecretStoreOps.deleteSecretStoreMappings({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig: false,
            state,
          });
          await SecretStoreOps.importSecretStores({
            importData: esvSecretStore,
            globalConfig: true,
            state
          });
          expect(response).toMatchSnapshot();
        });
      });
    });
  }

  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('Classic Tests', () => {
      const CLASSIC_MAPPING_1: SecretStoreMappingSkeleton = {
        _id: 'am.uma.resource.labels.mtls.cert',
        secretId: 'am.uma.resource.labels.mtls.cert',
        aliases: [
          'new',
          'new2',
          'new3'
        ]
      }

      const CLASSIC_MAPPING_2: SecretStoreMappingSkeleton = {
        _id: 'am.applications.agents.remote.consent.request.signing.ES256',
        secretId: 'am.applications.agents.remote.consent.request.signing.ES256',
        aliases: [ 'es256test' ]
      }

      const CLASSIC_SECRET_STORE_1_ID = 'test-keystore';
      const CLASSIC_SECRET_STORE_2_ID = 'test-keystore-2';
      const CLASSIC_SECRET_STORES: SecretStoreExportInterface = {
        secretstore: {
          [CLASSIC_SECRET_STORE_1_ID]: {
            _id: CLASSIC_SECRET_STORE_1_ID,
            _type: {
              _id: 'KeyStoreSecretStore',
              collection: true,
              name: 'Keystore'
            },
            file: '/root/am/security/keystores/keystore.jceks',
            keyEntryPassword: 'entrypass',
            leaseExpiryDuration: 5,
            providerName: 'SunJCE',
            storePassword: 'storepass',
            storetype: 'JCEKS',
            mappings: [
              CLASSIC_MAPPING_1,
              CLASSIC_MAPPING_2
            ],
          },
          [CLASSIC_SECRET_STORE_2_ID]: {
            _id: CLASSIC_SECRET_STORE_2_ID,
            _type: {
              _id: 'FileSystemSecretStore',
              collection: true,
              name: 'File System Secret Volumes'
            },
            directory: '/root/am/security/secrets/encrypted',
            format: 'ENCRYPTED_PLAIN'
          }
        }
      }

      beforeEach(() => {
        setDefaultState(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
      });

      afterAll(async () => {
        await SecretStoreOps.deleteSecretStore({
          secretStoreId: CLASSIC_SECRET_STORE_1_ID,
          secretStoreTypeId: undefined,
          globalConfig: true,
          state,
        });
        await SecretStoreOps.deleteSecretStore({
          secretStoreId: CLASSIC_SECRET_STORE_2_ID,
          secretStoreTypeId: undefined,
          globalConfig: true,
          state,
        });
      });

      describe('createSecretStoreMapping()', () => {
        test('0: Create global secret store mapping', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          await SecretStoreOps.deleteSecretStoreMapping({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            secretId: CLASSIC_MAPPING_1.secretId,
            globalConfig: true,
            state,
          });
          const response = await SecretStoreOps.createSecretStoreMapping({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            secretStoreMappingData: CLASSIC_MAPPING_1,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readSecretStore()', () => {
        test('0: Read global secret store', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const response = await SecretStoreOps.readSecretStore({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readSecretStoreSchema()', () => {
        test('0: Read realm secret store schema', async () => {
          const response = await SecretStoreOps.readSecretStoreSchema({
            secretStoreTypeId: 'KeyStoreSecretStore',
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test('1: Read global secret store schema', async () => {
          const response = await SecretStoreOps.readSecretStoreSchema({
            secretStoreTypeId: 'EnvironmentAndSystemPropertySecretStore',
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    
      describe('readSecretStores()', () => {
        test('0: Read realm SecretStores', async () => {
          const response = await SecretStoreOps.readSecretStores({ globalConfig: false, state });
          expect(response).toMatchSnapshot();
        });
    
        test('1: Read global SecretStores', async () => {
          const response = await SecretStoreOps.readSecretStores({ globalConfig: true, state });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readSecretStoreMapping()', () => {
        test('0: Read global secret store mapping', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const response = await SecretStoreOps.readSecretStoreMapping({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            secretId: CLASSIC_MAPPING_1.secretId,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readSecretStoreMappings()', () => {
        test('0: Read global secret store mappings', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const response = await SecretStoreOps.readSecretStoreMappings({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    
      describe('exportSecretStore()', () => {
        test('0: Export global secret store', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const response = await SecretStoreOps.exportSecretStore({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });
    
      describe('exportSecretStores()', () => {
        test('0: Export realm SecretStores', async () => {
          const response = await SecretStoreOps.exportSecretStores({ globalConfig: false, resultCallback: snapshotResultCallback, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
    
        test('1: Export global SecretStores', async () => {
          const response = await SecretStoreOps.exportSecretStores({ globalConfig: true, resultCallback: snapshotResultCallback, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });
    
      describe('updateSecretStore()', () => {
        test('0: Update global secret store', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const secretStoreData = {...CLASSIC_SECRET_STORES.secretstore[CLASSIC_SECRET_STORE_1_ID]}
          delete secretStoreData.mappings;
          secretStoreData.leaseExpiryDuration = 6;
          const response = await SecretStoreOps.updateSecretStore({
            secretStoreData,
            globalConfig: true,
            state,
          });
          expect(response.leaseExpiryDuration).toBe(6);
          expect(response).toMatchSnapshot();
        });
      });
    
      describe('updateSecretStoreMapping()', () => {
        test('0: Update global secret store mapping', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const secretStoreMappingData = {...CLASSIC_MAPPING_1}
          secretStoreMappingData.aliases = CLASSIC_MAPPING_1.aliases.concat(['new4', 'new5']);
          const response = await SecretStoreOps.updateSecretStoreMapping({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: CLASSIC_SECRET_STORES.secretstore[CLASSIC_SECRET_STORE_1_ID]._type._id,
            secretStoreMappingData,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    
      describe('importSecretStores()', () => {
        test('0: Import global secret stores', async () => {
          const response = await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('deleteSecretStore()', () => {
        test('0: Delete global secret store', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const response = await SecretStoreOps.deleteSecretStoreMapping({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            secretId: CLASSIC_MAPPING_1.secretId,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('deleteSecretStores()', () => {
        test('0: Delete global secret stores', async () => {
          const globalSecretStores = await SecretStoreOps.exportSecretStores({
            globalConfig: true,
            state
          });
          const response = await SecretStoreOps.deleteSecretStores({
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          await SecretStoreOps.importSecretStores({
            importData: globalSecretStores,
            globalConfig: true,
            state
          });
          // This secretstore cannot be deleted, so verify it doesn't get returned
          expect(response.find(s => s._type._id === "EnvironmentAndSystemPropertySecretStore")).toBeUndefined()
          expect(response).toMatchSnapshot();
        });
      });

      describe('deleteSecretStoreMapping()', () => {
        test('0: Delete global secret store mapping', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const response = await SecretStoreOps.deleteSecretStoreMapping({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            secretId: CLASSIC_MAPPING_1.secretId,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('deleteSecretStoreMappings()', () => {
        test('0: Delete global secret store mappings', async () => {
          await SecretStoreOps.importSecretStores({
            importData: CLASSIC_SECRET_STORES,
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            globalConfig: true,
            resultCallback: snapshotResultCallback,
            state,
          });
          const response = await SecretStoreOps.deleteSecretStoreMappings({
            secretStoreId: CLASSIC_SECRET_STORE_1_ID,
            secretStoreTypeId: undefined,
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });
    });
  }
});
