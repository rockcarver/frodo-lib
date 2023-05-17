/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    This step breaks down into 5 phases:
 *
 *    Phase 1: Record Group 1 of non-destructive tests
 *    Phase 2: Record Group 2 of non-destructive tests - Import all
 *    Phase 3: Record Group 1 of DESTRUCTIVE tests - Deletes by entity id
 *    Phase 4: Record Group 2 of DESTRUCTIVE tests - Delete all
 *    Phase 5: Record Group 3 of DESTRUCTIVE tests - Delete all raw (legacy API - pre 7.0)
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state variables required to connect to the
 *    env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record Saml2Ops
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record Saml2Ops
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE CONFIGURATION!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record Saml2Ops
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record Saml2Ops
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=5 FRODO_HOST=frodo-dev npm run test:record Saml2Ops
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update Saml2Ops
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only Saml2Ops
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { Saml2, state } from '../index';
import * as globalConfig from '../storage/StaticStorage';
import { Saml2ProiderLocation } from '../api/ApiTypes';
import {
  getSaml2ProviderImportData,
  getSaml2ProvidersImportData,
} from '../test/mocks/ForgeRockApiMockEngine';
import { encodeBase64Url } from '../api/utils/Base64';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

state.setDeploymentType(globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY);

async function stageProvider(provider: { entityId: string }, create = true) {
  // delete if exists, then create
  try {
    await Saml2.getSaml2Provider(provider.entityId);
    await Saml2.deleteSaml2Provider(provider.entityId);
  } catch (error) {
    if (error.isAxiosError) {
      console.log(
        `Error deleting provider '${provider.entityId}': ${error.message}`
      );
      console.dir(error.response?.data);
    }
  } finally {
    if (create) {
      try {
        await Saml2.importSaml2Provider(
          provider.entityId,
          getSaml2ProviderImportData(provider.entityId)
        );
      } catch (error) {
        console.log(
          `Error importing provider '${provider.entityId}': ${error.message}`
        );
        console.dir(error.response?.data);
      }
    }
  }
}

describe('Saml2Ops', () => {
  const provider1 = {
    entityId: 'iSPAzure',
    location: Saml2ProiderLocation.HOSTED,
    entityId64: encodeBase64Url('iSPAzure'),
  };
  const provider2 = {
    entityId: 'urn:federation:MicrosoftOnline',
    location: Saml2ProiderLocation.REMOTE,
    entityId64: encodeBase64Url('urn:federation:MicrosoftOnline'),
  };
  const provider3 = {
    entityId: 'https://idc.scheuber.io/am/saml2/IDPFedlet',
    location: Saml2ProiderLocation.HOSTED,
    entityId64: encodeBase64Url('https://idc.scheuber.io/am/saml2/IDPFedlet'),
  };
  const provider4 = {
    entityId: 'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/',
    location: Saml2ProiderLocation.REMOTE,
    entityId64: encodeBase64Url(
      'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/'
    ),
  };
  const provider5 = {
    entityId: 'https://idc.scheuber.io/am/saml2/IDPAzure',
    location: Saml2ProiderLocation.HOSTED,
    entityId64: encodeBase64Url('https://idc.scheuber.io/am/saml2/IDPAzure'),
  };
  const provider6 = {
    entityId: 'https://idc.scheuber.io/am/saml2/IDPBroadcom',
    location: Saml2ProiderLocation.HOSTED,
    entityId64: encodeBase64Url('https://idc.scheuber.io/am/saml2/IDPBroadcom'),
  };
  const provider7 = {
    entityId: 'idp',
    location: Saml2ProiderLocation.REMOTE,
    entityId64: encodeBase64Url('idp'),
  };
  const provider8 = {
    entityId: 'SPAzure',
    location: Saml2ProiderLocation.HOSTED,
    entityId64: encodeBase64Url('SPAzure'),
  };
  const provider9 = {
    entityId: 'volkerDevSP',
    location: Saml2ProiderLocation.HOSTED,
    entityId64: encodeBase64Url('volkerDevSP'),
  };
  const provider10 = {
    entityId: 'https://saml.mytestrun.com/sp',
    location: Saml2ProiderLocation.REMOTE,
    entityId64: encodeBase64Url('https://saml.mytestrun.com/sp'),
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await stageProvider(provider1);
      await stageProvider(provider2);
      await stageProvider(provider3);
      await stageProvider(provider4);
      await stageProvider(provider5, false);
      await stageProvider(provider6, false);
      await stageProvider(provider7, false);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await stageProvider(provider1, false);
      await stageProvider(provider2, false);
      await stageProvider(provider3, false);
      await stageProvider(provider4, false);
      await stageProvider(provider5, false);
      await stageProvider(provider6, false);
      await stageProvider(provider7, false);
      await stageProvider(provider8, false);
      await stageProvider(provider9, false);
      await stageProvider(provider10, false);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '5'
    ) {
      await stageProvider(provider1, false);
      await stageProvider(provider2, false);
      await stageProvider(provider7, false);
      await stageProvider(provider8, false);
      await stageProvider(provider9, false);
    }
    // Pahses 3 + 4
    else if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageProvider(provider1);
      await stageProvider(provider2);
      await stageProvider(provider3);
      await stageProvider(provider4);
      await stageProvider(provider5);
      await stageProvider(provider6);
      await stageProvider(provider7);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageProvider(provider1, false);
      await stageProvider(provider2, false);
      await stageProvider(provider3, false);
      await stageProvider(provider4, false);
      await stageProvider(provider5, false);
      await stageProvider(provider6, false);
      await stageProvider(provider7, false);
      await stageProvider(provider8, false);
      await stageProvider(provider9, false);
      await stageProvider(provider10, false);
    }
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('createSaml2ExportTemplate()', () => {
      test('0: Method is implemented', () => {
        expect(Saml2.createSaml2ExportTemplate).toBeDefined();
      });

      test('1: Create saml2 export template', () => {
        const response = Saml2.createSaml2ExportTemplate();
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('getSaml2ProviderStubs()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getSaml2ProviderStubs).toBeDefined();
      });

      test('1: Get saml2 provider stubs', async () => {
        const response = await Saml2.getSaml2ProviderStubs();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getProviderByLocationAndId()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getProviderByLocationAndId).toBeDefined();
      });

      test(`1: Get hosted provider '${provider1.entityId}'`, async () => {
        const response = await Saml2.getProviderByLocationAndId(
          provider1.location,
          provider1.entityId64
        );
        expect(response).toMatchSnapshot();
      });

      test(`2: Get remote provider '${provider2.entityId}'`, async () => {
        const response = await Saml2.getProviderByLocationAndId(
          provider2.location,
          provider2.entityId64
        );
        expect(response).toMatchSnapshot();
      });
    });

    describe('getProviderMetadataUrl()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getProviderMetadataUrl).toBeDefined();
      });

      test(`1: Get metadata url for hosted provider '${provider3.entityId}'`, async () => {
        const response = Saml2.getProviderMetadataUrl(provider3.entityId);
        expect(response).toMatch(new RegExp(`^${process.env.FRODO_HOST}`));
        const url = new URL(response);
        expect(url.pathname).toMatch('/am/saml2/jsp/exportmetadata.jsp');
        const searchParams = new URLSearchParams(url.search);
        expect(searchParams.get('entityid')).toMatch(provider3.entityId);
      });

      test(`2: Get metadata url for remote provider '${provider4.entityId}'`, async () => {
        const response = Saml2.getProviderMetadataUrl(provider4.entityId);
        expect(response).toMatch(new RegExp(`^${process.env.FRODO_HOST}`));
        const url = new URL(response);
        expect(url.pathname).toMatch('/am/saml2/jsp/exportmetadata.jsp');
        const searchParams = new URLSearchParams(url.search);
        expect(searchParams.get('entityid')).toMatch(provider4.entityId);
      });
    });

    describe('getProviderMetadata()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getProviderMetadata).toBeDefined();
      });

      test(`1: Get metadata for hosted provider '${provider1.entityId}'`, async () => {
        const response = await Saml2.getProviderMetadata(provider1.entityId);
        expect(response).toMatchSnapshot();
      });

      test(`2: Get metadata for remote provider '${provider4.entityId}'`, async () => {
        const response = await Saml2.getProviderMetadata(provider4.entityId);
        expect(response).toMatchSnapshot();
      });
    });

    describe('getSaml2ProviderStub()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getSaml2ProviderStub).toBeDefined();
      });

      test(`1: Get stub of hosted provider '${provider1.entityId}'`, async () => {
        const response = await Saml2.getSaml2ProviderStub(provider1.entityId);
        expect(response).toMatchSnapshot();
      });

      test(`2: Get stub of remote provider '${provider4.entityId}'`, async () => {
        const response = await Saml2.getSaml2ProviderStub(provider4.entityId);
        expect(response).toMatchSnapshot();
      });
    });

    describe('getSaml2Provider()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getSaml2Provider).toBeDefined();
      });

      test(`1: Get hosted provider '${provider1.entityId}'`, async () => {
        const response = await Saml2.getSaml2Provider(provider1.entityId);
        expect(response).toMatchSnapshot();
      });

      test(`2: Get remote provider '${provider4.entityId}'`, async () => {
        const response = await Saml2.getSaml2Provider(provider4.entityId);
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportSaml2Provider()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.exportSaml2Provider).toBeDefined();
      });

      test(`1: Export hosted provider '${provider1.entityId}'`, async () => {
        const response = await Saml2.exportSaml2Provider(provider1.entityId);
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export remote provider '${provider4.entityId}'`, async () => {
        const response = await Saml2.exportSaml2Provider(provider4.entityId);
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('exportSaml2Providers()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.exportSaml2Providers).toBeDefined();
      });

      test('1: Export saml2 entity providers', async () => {
        const response = await Saml2.exportSaml2Providers();
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('importSaml2Provider()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.importSaml2Provider).toBeDefined();
      });

      test(`1: Import hosted provider '${provider5.entityId}'`, async () => {
        expect.assertions(1);
        const response = await Saml2.importSaml2Provider(
          provider5.entityId,
          getSaml2ProviderImportData(provider5.entityId)
        );
        expect(response).toBeTruthy();
      });

      test(`2: Import hosted provider '${provider6.entityId}'`, async () => {
        expect.assertions(1);
        const response = await Saml2.importSaml2Provider(
          provider6.entityId,
          getSaml2ProviderImportData(provider6.entityId)
        );
        expect(response).toBeTruthy();
      });

      test(`3: Import remote provider '${provider7.entityId}' with metadata`, async () => {
        expect.assertions(1);
        const response = await Saml2.importSaml2Provider(
          provider7.entityId,
          getSaml2ProviderImportData(provider7.entityId)
        );
        expect(response).toBeTruthy();
      });
    });

    describe('getRawProviders()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getRawSaml2Providers).toBeDefined();
      });
    });

    describe('getRawProvider()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.getRawSaml2Provider).toBeDefined();
      });
    });

    describe('putRawProvider()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.putRawSaml2Provider).toBeDefined();
      });
    });
  }

  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('importSaml2Providers()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.importSaml2Providers).toBeDefined();
      });

      test('1: Import providers', async () => {
        expect.assertions(2);
        const response = await Saml2.importSaml2Providers(
          getSaml2ProvidersImportData()
        );
        expect(response.failures).toBe(0);
        expect(response.warnings).toBe(0);
      });
    });
  }

  // Phase 3
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3')
  ) {
    describe('deleteSaml2Provider()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.deleteSaml2Provider).toBeDefined();
      });

      test(`1: Delete hosted provider '${provider3.entityId}'`, async () => {
        const response = await Saml2.deleteSaml2Provider(provider3.entityId);
        expect(response).toMatchSnapshot();
      });

      test(`2: Delete remote provider '${provider4.entityId}'`, async () => {
        const response = await Saml2.deleteSaml2Provider(provider4.entityId);
        expect(response).toMatchSnapshot();
      });
    });

    describe('deleteRawSaml2Provider()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.deleteRawSaml2Provider).toBeDefined();
      });

      test(`1: Delete raw hosted provider '${provider1.entityId}'`, async () => {
        const response = await Saml2.deleteRawSaml2Provider(provider1.entityId);
        expect(response).toMatchSnapshot();
      });

      test(`2: Delete raw remote provider '${provider2.entityId}'`, async () => {
        const response = await Saml2.deleteRawSaml2Provider(provider2.entityId);
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 4
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4')
  ) {
    describe('deleteSaml2Providers()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.deleteSaml2Providers).toBeDefined();
      });

      test(`1: Delete all providers`, async () => {
        const response = await Saml2.deleteSaml2Providers();
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 5
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '5')
  ) {
    describe('deleteRawSaml2Providers()', () => {
      test('0: Method is implemented', async () => {
        expect(Saml2.deleteRawSaml2Providers).toBeDefined();
      });

      test(`1: Delete all raw providers`, async () => {
        const response = await Saml2.deleteRawSaml2Providers();
        expect(response).toMatchSnapshot();
      });
    });
  }
});
